import { math, toTex, toStr, variablesOf, compile, type MathNode } from "../mathjs";
import { roundSig } from "../format";
import { numDerivative, samplePoints, close } from "../numeric";
import type { SolverOutput, Step, Formula, VerificationCheck } from "../types";
import { verificationFrom, MathInputError } from "../types";
import { bestForm } from "../pretty";

const RULES: Record<string, Formula> = {
  constant: { name: "Constant rule", latex: "\\frac{d}{dx}[c] = 0" },
  power: { name: "Power rule", latex: "\\frac{d}{dx}[x^n] = n x^{n-1}" },
  constMultiple: { name: "Constant multiple rule", latex: "\\frac{d}{dx}[c f(x)] = c f'(x)" },
  sum: { name: "Sum rule", latex: "\\frac{d}{dx}[f \\pm g] = f' \\pm g'" },
  product: { name: "Product rule", latex: "\\frac{d}{dx}[f g] = f' g + f g'" },
  quotient: { name: "Quotient rule", latex: "\\frac{d}{dx}\\left[\\frac{f}{g}\\right] = \\frac{f' g - f g'}{g^2}" },
  chain: { name: "Chain rule", latex: "\\frac{d}{dx}[f(g(x))] = f'(g(x))\\, g'(x)" },
  exp: { name: "Exponential rule", latex: "\\frac{d}{dx}[e^{x}] = e^{x},\\quad \\frac{d}{dx}[a^{x}] = a^{x}\\ln a" },
  log: { name: "Logarithm rule", latex: "\\frac{d}{dx}[\\ln x] = \\frac{1}{x}" },
  sin: { name: "Derivative of sine", latex: "\\frac{d}{dx}[\\sin x] = \\cos x" },
  cos: { name: "Derivative of cosine", latex: "\\frac{d}{dx}[\\cos x] = -\\sin x" },
  tan: { name: "Derivative of tangent", latex: "\\frac{d}{dx}[\\tan x] = \\sec^2 x" },
  sqrt: { name: "Square root rule", latex: "\\frac{d}{dx}[\\sqrt{x}] = \\frac{1}{2\\sqrt{x}}" },
  inverseTrig: { name: "Inverse trig derivatives", latex: "\\frac{d}{dx}[\\arctan x] = \\frac{1}{1+x^2},\; \\frac{d}{dx}[\\arcsin x] = \\frac{1}{\\sqrt{1-x^2}}" },
};

type Rule = keyof typeof RULES;

function unwrap(n: MathNode): MathNode {
  while (n.type === "ParenthesisNode") n = (n as unknown as { content: MathNode }).content;
  return n;
}

function dependsOn(n: MathNode, v: string) {
  return variablesOf(n).includes(v);
}

/** Identify the primary differentiation rule for a node. */
function ruleFor(node: MathNode, v: string): { rule: Rule; note?: string } {
  const n = unwrap(node);
  if (!dependsOn(n, v)) return { rule: "constant" };
  if (n.type === "SymbolNode") return { rule: "power" };
  if (n.type === "OperatorNode") {
    const o = n as unknown as { op: string; args: MathNode[] };
    if (o.args.length === 1) return ruleFor(o.args[0], v);
    if (o.op === "+" || o.op === "-") return { rule: "sum" };
    if (o.op === "*") {
      const deps = o.args.filter((a) => dependsOn(a, v)).length;
      return deps > 1 ? { rule: "product" } : { rule: "constMultiple" };
    }
    if (o.op === "/") return dependsOn(o.args[1], v) ? { rule: "quotient" } : { rule: "constMultiple" };
    if (o.op === "^") {
      const [base, exp] = o.args.map(unwrap);
      if (dependsOn(exp, v)) return { rule: "exp", note: base.type === "SymbolNode" && (base as unknown as { name: string }).name === "e" ? "e" : "a" };
      if (base.type === "SymbolNode") return { rule: "power" };
      return { rule: "chain", note: "power" };
    }
  }
  if (n.type === "FunctionNode") {
    const f = n as unknown as { fn: { name: string }; args: MathNode[] };
    const inner = unwrap(f.args[0]);
    const simple = inner.type === "SymbolNode";
    const name = f.fn.name;
    if (!simple) return { rule: "chain", note: name };
    if (name === "log" || name === "log10" || name === "log2") return { rule: "log" };
    if (name === "exp") return { rule: "exp", note: "e" };
    if (name === "sin" || name === "cos" || name === "tan") return { rule: name as Rule };
    if (name === "sqrt") return { rule: "sqrt" };
    if (name.startsWith("a")) return { rule: "inverseTrig" };
    return { rule: "chain", note: name };
  }
  return { rule: "power" };
}

function d(node: MathNode, v: string): MathNode {
  return math.simplify(math.derivative(node, v));
}

function dTex(v: string) {
  return `\\frac{d}{d${v}}`;
}

/** Produce explained steps for differentiating node. Depth-limited recursion through sums/products/quotients/chains. */
function explain(node: MathNode, v: string, used: Set<Rule>, depth = 0): Step[] {
  const n = unwrap(node);
  const { rule } = ruleFor(n, v);
  used.add(rule);
  const steps: Step[] = [];
  const res = d(n, v);
  if (depth > 2) {
    steps.push({ title: RULES[rule].name, latex: `${dTex(v)}\\left[${toTex(n)}\\right] = ${toTex(res)}` });
    return steps;
  }
  if (rule === "sum") {
    const terms: MathNode[] = [];
    const collect = (x: MathNode, sign: 1 | -1) => {
      const u = unwrap(x);
      if (u.type === "OperatorNode" && ["+", "-"].includes((u as unknown as { op: string }).op) && (u as unknown as { args: MathNode[] }).args.length === 2) {
        const [a, b] = (u as unknown as { args: MathNode[] }).args;
        collect(a, sign);
        collect(b, (u as unknown as { op: string }).op === "-" ? (-sign as 1 | -1) : sign);
      } else terms.push(sign === 1 ? u : new math.OperatorNode("-", "unaryMinus", [u]));
    };
    collect(n, 1);
    steps.push({
      title: "Apply the sum rule",
      text: "Differentiate each term separately.",
      latex: `${dTex(v)}\\left[${toTex(n)}\\right] = ${terms.map((t) => `${dTex(v)}\\left[${toTex(t)}\\right]`).join(" + ")}`,
    });
    for (const t of terms.slice(0, 8)) {
      const r = ruleFor(t, v);
      used.add(r.rule);
      if (r.rule === "product" || r.rule === "quotient" || r.rule === "chain") steps.push(...explain(t, v, used, depth + 1));
      else steps.push({ title: `${RULES[r.rule].name}`, latex: `${dTex(v)}\\left[${toTex(t)}\\right] = ${toTex(d(t, v))}` });
    }
  } else if (rule === "product") {
    const o = n as unknown as { args: MathNode[] };
    const [f, g] = o.args;
    const fp = d(f, v);
    const gp = d(g, v);
    steps.push({
      title: "Apply the product rule",
      text: `Let $f = ${toTex(f)}$ and $g = ${toTex(g)}$.`,
      latex: `f' = ${toTex(fp)},\\quad g' = ${toTex(gp)}`,
    });
    steps.push({ title: "Combine", latex: `f'g + fg' = \\left(${toTex(fp)}\\right)\\left(${toTex(g)}\\right) + \\left(${toTex(f)}\\right)\\left(${toTex(gp)}\\right)` });
  } else if (rule === "quotient") {
    const o = n as unknown as { args: MathNode[] };
    const [f, g] = o.args;
    const fp = d(f, v);
    const gp = d(g, v);
    steps.push({ title: "Apply the quotient rule", text: `Let $f = ${toTex(f)}$ (numerator) and $g = ${toTex(g)}$ (denominator).`, latex: `f' = ${toTex(fp)},\\quad g' = ${toTex(gp)}` });
    steps.push({ title: "Substitute into the formula", latex: `\\frac{f'g - fg'}{g^2} = \\frac{\\left(${toTex(fp)}\\right)\\left(${toTex(g)}\\right) - \\left(${toTex(f)}\\right)\\left(${toTex(gp)}\\right)}{\\left(${toTex(g)}\\right)^2}` });
  } else if (rule === "chain") {
    let inner: MathNode | null = null;
    if (n.type === "FunctionNode") inner = (n as unknown as { args: MathNode[] }).args[0];
    else if (n.type === "OperatorNode") inner = (n as unknown as { args: MathNode[] }).args[0];
    if (inner) {
      const u = unwrap(inner);
      const outer = n.transform((x) => (x === inner ? new math.SymbolNode("u") : x));
      const outerD = math.simplify(math.derivative(outer, "u"));
      const innerD = d(u, v);
      steps.push({
        title: "Apply the chain rule",
        text: `Let $u = ${toTex(u)}$, so the outer function is $${toTex(outer)}$.`,
        latex: `\\frac{d}{du}\\left[${toTex(outer)}\\right] = ${toTex(outerD)},\\qquad \\frac{du}{d${v}} = ${toTex(innerD)}`,
      });
      steps.push({ title: "Multiply outer and inner derivatives", latex: `${dTex(v)}\\left[${toTex(n)}\\right] = ${toTex(outerD.transform((x) => (x.type === "SymbolNode" && (x as unknown as { name: string }).name === "u" ? new math.ParenthesisNode(u) : x)))} \\cdot ${toTex(innerD)}` });
    }
  } else {
    steps.push({ title: RULES[rule].name, latex: `${dTex(v)}\\left[${toTex(n)}\\right] = ${toTex(res)}` });
  }
  return steps;
}

export interface DerivativeRequest {
  expr: string;
  variable: string;
  order?: number;
  at?: number;
}

export async function solveDerivative(req: DerivativeRequest): Promise<SolverOutput> {
  const node = math.parse(req.expr);
  const v = req.variable;
  const order = Math.min(Math.max(req.order ?? 1, 1), 10);
  const vars = variablesOf(node);
  const partial = vars.filter((x) => x !== v).length > 0;
  const opTex = order === 1 ? (partial ? `\\frac{\\partial}{\\partial ${v}}` : dTex(v)) : partial ? `\\frac{\\partial^{${order}}}{\\partial ${v}^{${order}}}` : `\\frac{d^{${order}}}{d${v}^{${order}}}`;
  const interpreted = `${opTex}\\left[${toTex(node)}\\right]`;
  const used = new Set<Rule>();
  const steps: Step[] = [{ title: "Differentiate", latex: interpreted, text: partial ? `Treat ${vars.filter((x) => x !== v).map((x) => `$${x}$`).join(", ")} as constant${vars.length > 2 ? "s" : ""}.` : undefined }];

  let current = node;
  const results: MathNode[] = [];
  for (let k = 1; k <= order; k++) {
    if (order > 1) steps.push({ title: `Derivative #${k}`, latex: `${dTex(v)}\\left[${toTex(current)}\\right]` });
    if (k === 1 || order <= 3) steps.push(...explain(current, v, used));
    let next: MathNode;
    try {
      next = d(current, v);
    } catch (e) {
      throw new MathInputError(`Cannot differentiate this expression: ${(e as Error).message}`);
    }
    steps.push({ title: k === order ? "Simplify" : `Result of derivative #${k}`, latex: `${k === 1 ? "" : `f^{(${k})}(${v}) = `}${toTex(next)}` });
    results.push(next);
    current = next;
  }
  const result = current;
  const display = await bestForm(result);
  if (toStr(display) !== toStr(result)) steps.push({ title: "Simplify", latex: toTex(display) });

  // Verification: compare symbolic derivative to a high-order finite difference at sample points
  const checks: VerificationCheck[] = [];
  if (order <= 2) {
    const otherScope = Object.fromEntries(vars.filter((x) => x !== v).map((x, i) => [x, 1.3 + i * 0.7]));
    const fPrev = compile(order === 1 ? node : results[order - 2]);
    const fRes = compile(result);
    const fNum = (x: number) => {
      try {
        return Number(fPrev.evaluate({ ...otherScope, [v]: x }));
      } catch {
        return NaN;
      }
    };
    let tested = 0;
    let passed = 0;
    for (const x of samplePoints(9, -2.5, 3.5)) {
      let sym: number;
      try {
        sym = Number(fRes.evaluate({ ...otherScope, [v]: x }));
      } catch {
        continue;
      }
      const num = numDerivative(fNum, x);
      if (!Number.isFinite(sym) || !Number.isFinite(num)) continue;
      tested++;
      if (close(sym, num, 1e-4)) passed++;
    }
    if (tested) checks.push({ label: "Matches numerical differentiation at sample points", passed: passed === tested, detail: `${passed}/${tested} points agree` });
  }
  checks.push({ label: "Computed symbolically with rule-based differentiation", passed: true });

  let atValue: number | undefined;
  if (req.at !== undefined) {
    try {
      atValue = Number(compile(result).evaluate({ [v]: req.at }));
      steps.push({ title: `Evaluate at ${v} = ${req.at}`, latex: `f${"'".repeat(Math.min(order, 3))}(${req.at}) = ${roundSig(atValue, 10)}` });
    } catch {
      /* ignore */
    }
  }

  const formulas = [...used].filter((r) => r !== "constant" || used.size === 1).map((r) => RULES[r]);
  const resultTex = toTex(display);
  return {
    interpreted,
    category: "derivative",
    topic: partial ? "Partial derivative" : order > 1 ? `Higher-order derivative (order ${order})` : "Derivative",
    answer: {
      latex: atValue !== undefined ? `${resultTex}\\Big|_{${v}=${req.at}} = ${roundSig(atValue, 10)}` : `${opTex}\\left[${toTex(node)}\\right] = ${resultTex}`,
      text: atValue !== undefined ? `${toStr(display)} ; value at ${v}=${req.at}: ${roundSig(atValue, 10)}` : toStr(display),
    },
    steps,
    formulas,
    explanation: `Break the function into simpler pieces and apply the matching differentiation rules${used.has("chain") ? " — use the chain rule whenever one function is nested inside another" : ""}.`,
    verification: verificationFrom(checks),
    graph: !partial ? { expressions: [toStr(node), toStr(result)].map((e) => (v === "x" ? e : e)) } : undefined,
  };
}

/** Implicit differentiation dy/dx for F(x, y) = 0. */
export async function solveImplicit(lhs: string, rhs: string, x = "x", y = "y"): Promise<SolverOutput> {
  const F = math.parse(`(${lhs}) - (${rhs})`);
  const Fx = math.simplify(math.derivative(F, x));
  const Fy = math.simplify(math.derivative(F, y));
  const result = await bestForm(math.simplify(math.parse(`-(${toStr(Fx)})/(${toStr(Fy)})`)));
  const interpreted = `${toTex(lhs)} = ${toTex(rhs)}`;
  const steps: Step[] = [
    { title: "Write the relation", latex: interpreted },
    { title: `Differentiate both sides with respect to ${x}`, text: `Treat $${y}$ as a function of $${x}$; each derivative of a $${y}$ term picks up a factor $\\frac{d${y}}{d${x}}$ (chain rule).` },
    { title: "Partial derivatives", latex: `F_{${x}} = ${toTex(Fx)},\\qquad F_{${y}} = ${toTex(Fy)}` },
    { title: `Solve for dy/dx`, latex: `\\frac{d${y}}{d${x}} = -\\frac{F_{${x}}}{F_{${y}}} = ${toTex(result)}` },
  ];
  return {
    interpreted,
    category: "derivative",
    topic: "Implicit differentiation",
    answer: { latex: `\\frac{d${y}}{d${x}} = ${toTex(result)}`, text: `dy/dx = ${toStr(result)}` },
    steps,
    formulas: [RULES.chain, { name: "Implicit derivative", latex: "\\frac{dy}{dx} = -\\frac{F_x}{F_y}" }],
    explanation: "When y is defined implicitly, differentiate every term with respect to x (using the chain rule on y-terms) and solve for dy/dx.",
    verification: verificationFrom([{ label: "Derived from F_x and F_y symbolically", passed: true }]),
  };
}
