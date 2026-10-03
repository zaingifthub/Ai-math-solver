import { math, toTex, toStr, variablesOf, evalReal, pickVariable, type MathNode } from "../mathjs";
import { numTex, numText, polyTex, polyStr, roundSig } from "../format";
import { samplePoints, close } from "../numeric";
import { CAS, toCas } from "../cas";
import { polyCoeffs, rationalParts } from "../poly";
import type { SolverOutput, Step, Formula, VerificationCheck, Category } from "../types";
import { verificationFrom, MathInputError } from "../types";
import { bestForm, pretty } from "../pretty";
import { domainRestrictions } from "./equation";
import { polynomialRoots } from "./roots";

function equivalent(a: MathNode, b: MathNode): VerificationCheck {
  const vars = [...new Set([...variablesOf(a), ...variablesOf(b)])];
  const fa = a.compile();
  const fb = b.compile();
  let tested = 0;
  let passed = 0;
  for (const x of samplePoints(8, -2.7, 3.3)) {
    const scope = Object.fromEntries(vars.map((v, i) => [v, x + i * 0.61]));
    try {
      const va = Number(fa.evaluate(scope));
      const vb = Number(fb.evaluate(scope));
      if (!Number.isFinite(va) || !Number.isFinite(vb)) continue;
      tested++;
      if (close(va, vb, 1e-8)) passed++;
    } catch {
      /* skip */
    }
  }
  return { label: "Equivalent to the original at random sample points", passed: tested > 0 && passed === tested, detail: `${passed}/${tested} points` };
}

async function factorTex(coeffs: number[], v: string): Promise<string> {
  const f = await CAS.factor(polyStr(coeffs, v).replace(/\s+/g, ""));
  return f ? toTex(f) : polyTex(coeffs, v);
}

function topicFor(node: MathNode): { category: Category; topic: string } {
  const s = toStr(node);
  if (/\blog(10|2)?\(/.test(s)) return { category: "logarithm", topic: "Logarithmic expression" };
  if (/sin|cos|tan|sec|csc|cot/.test(s)) return { category: "trigonometry", topic: "Trigonometric expression" };
  if (/\^/.test(s) && !polyCoeffs(node, pickVariable(variablesOf(node)) ?? "x")) return { category: "exponent", topic: "Exponents" };
  return { category: "algebra", topic: "Algebraic expression" };
}

export async function solveSimplify(exprStr: string, mode: "simplify" | "expand" | "factor"): Promise<SolverOutput> {
  const node = math.parse(exprStr);
  const vars = variablesOf(node);
  const v = pickVariable(vars) ?? "x";
  const steps: Step[] = [{ title: "Start with the expression", latex: toTex(node) }];
  const formulas: Formula[] = [];
  let result: MathNode;
  let { category, topic } = topicFor(node);

  if (mode === "expand") {
    topic = "Expanding expressions";
    category = "polynomial";
    const r = await CAS.expand(toCas(node));
    if (!r) throw new MathInputError("Could not expand this expression.");
    result = math.parse(r);
    const coeffs = vars.length === 1 ? polyCoeffs(result, v) : null;
    if (coeffs) result = math.parse(polyStr(coeffs, v));
    formulas.push({ name: "Distributive property", latex: "a(b + c) = ab + ac" }, { name: "Binomial square", latex: "(a + b)^2 = a^2 + 2ab + b^2" });
    steps.push({ title: "Distribute (multiply every term by every term)", text: "Use the distributive property / FOIL, then combine like terms." });
    steps.push({ title: "Combine like terms", latex: coeffs ? polyTex(coeffs, v) : toTex(r) });
  } else if (mode === "factor") {
    topic = "Factoring";
    category = "polynomial";
    const coeffs = vars.length === 1 ? polyCoeffs(node, v) : null;
    const r = await CAS.factor(toCas(node));
    if (!r) throw new MathInputError("Could not factor this expression.");
    result = pretty(math.parse(r));
    if (coeffs) {
      steps.push({ title: "Write in standard form", latex: polyTex(coeffs, v) });
      const ints = coeffs.every((c) => Number.isInteger(c));
      if (ints) {
        const g = coeffs.reduce((a, c) => { let x = Math.abs(a), y = Math.abs(c); while (y) [x, y] = [y, x % y]; return x; }, 0);
        if (g > 1) steps.push({ title: "Factor out the GCF", latex: `${g}\\left(${polyTex(coeffs.map((c) => c / g), v)}\\right)` });
      }
      if (coeffs.length === 3) {
        const [a, b, c] = coeffs;
        steps.push({ title: "Find two numbers", text: `Look for two numbers whose product is $ac = ${numTex(a * c)}$ and whose sum is $b = ${numTex(b)}$.` });
        formulas.push({ name: "Factoring trinomials", latex: "x^2 + bx + c = (x + p)(x + q),\; pq = c,\; p + q = b" });
      } else if (coeffs.length > 3) {
        const pr = polynomialRoots(coeffs, v);
        steps.push(...pr.steps.filter((s) => /Rational|Test|Synthetic/.test(s.title)).slice(0, 6));
        formulas.push({ name: "Factor theorem", latex: "P(r) = 0 \\iff (x - r) \\mid P(x)" });
      }
    }
    formulas.push({ name: "Difference of squares", latex: "a^2 - b^2 = (a - b)(a + b)" });
    steps.push({ title: "Factored form", latex: toTex(result) });
  } else {
    const rp = vars.length === 1 ? rationalParts(node, v) : null;
    const casR = await CAS.simplify(toCas(node));
    let simplified: MathNode = math.simplify(node);
    if (casR) {
      const c = math.parse(casR);
      if (toStr(c).length < toStr(simplified).length) simplified = c;
    }
    result = await bestForm(simplified);
    if (rp && rp.den.length > 1) {
      topic = "Rational expressions";
      const r = domainRestrictions(node, v);
      steps.push({ title: "Factor numerator and denominator", latex: `\\frac{${(await factorTex(rp.num, v))}}{${(await factorTex(rp.den, v))}}` });
      steps.push({ title: "Cancel common factors", latex: toTex(result) });
      if (r.tex.length) steps.push({ title: "Note the restrictions", latex: r.tex.join(",\; "), text: "Values excluded from the original expression remain excluded after cancelling." });
      formulas.push({ name: "Cancelling factors", latex: "\\frac{ab}{ac} = \\frac{b}{c},\; a \\neq 0" });
    } else {
      steps.push({ title: "Combine like terms and apply identities", latex: toTex(result) });
      if (category === "exponent") formulas.push({ name: "Exponent rules", latex: "a^m a^n = a^{m+n},\; (a^m)^n = a^{mn},\; a^{-n} = \\frac{1}{a^n}" });
      if (category === "logarithm") formulas.push({ name: "Log rules", latex: "\\log(ab) = \\log a + \\log b,\; \\log(a^n) = n\\log a" });
      if (category === "trigonometry") formulas.push({ name: "Pythagorean identity", latex: "\\sin^2 x + \\cos^2 x = 1" });
    }
  }
  const check = equivalent(node, result);
  return {
    interpreted: `\\text{${mode}} \; ${toTex(node)}`,
    category,
    topic,
    answer: { latex: toTex(result), text: toStr(result) },
    steps,
    formulas,
    explanation:
      mode === "factor"
        ? "Factoring rewrites an expression as a product. Start by pulling out a greatest common factor, then look for patterns (trinomials, difference of squares, grouping)."
        : mode === "expand"
          ? "Expanding removes parentheses by distributing multiplication over addition and then combining like terms."
          : "Simplifying combines like terms, cancels common factors and applies identities to write the expression in its most compact form.",
    verification: verificationFrom([check]),
    graph: vars.length === 1 && v === "x" ? { expressions: [toStr(node)] } : undefined,
  };
}

export function solveEvaluateAt(exprStr: string, scope: Record<string, number>): SolverOutput {
  const node = math.parse(exprStr);
  const subst = node.transform((n) => (n.type === "SymbolNode" && (n as unknown as { name: string }).name in scope ? new math.ParenthesisNode(new math.ConstantNode(scope[(n as unknown as { name: string }).name])) : n));
  const val = evalReal(node, scope);
  if (!Number.isFinite(val)) throw new MathInputError("The expression is undefined at that value.");
  return {
    interpreted: `${toTex(node)}\\Big|_{${Object.entries(scope).map(([k, x]) => `${k}=${numTex(x)}`).join(",")}}`,
    category: "function",
    topic: "Evaluating functions",
    answer: { latex: numTex(val), text: numText(val), decimal: roundSig(val, 10) },
    steps: [
      { title: "Substitute", latex: toTex(subst) },
      { title: "Evaluate", latex: `= ${numTex(val)}` },
    ],
    formulas: [{ name: "Function evaluation", latex: "f(a) \\text{ means replace every } x \\text{ with } a" }],
    explanation: "Replace each occurrence of the variable with the given value and simplify using the order of operations.",
    verification: verificationFrom([{ label: "Evaluated numerically", passed: true, detail: roundSig(val, 12) }]),
  };
}

function restrictedPoints(tex: string[], v: string): number[] {
  const out: number[] = [];
  for (const t of tex) {
    const m = new RegExp(`^${v} \\\\neq (.+)$`).exec(t);
    if (!m) continue;
    const val = evalReal(m[1].replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, "($1)/($2)"));
    if (Number.isFinite(val)) out.push(val);
  }
  return out;
}

export type FunctionTask = "domain" | "inverse" | "vertex" | "intercepts" | "analyze";

export async function solveFunction(exprStr: string, task: FunctionTask, v = "x"): Promise<SolverOutput> {
  const node = math.parse(exprStr);
  const fTex = `f(${v}) = ${toTex(node)}`;
  const steps: Step[] = [{ title: "Function", latex: fTex }];
  const coeffs = polyCoeffs(node, v);
  if (task === "vertex") {
    if (!coeffs || coeffs.length !== 3) throw new MathInputError("The vertex is defined for quadratic functions.");
    const [a, b, c] = coeffs;
    const h = -b / (2 * a);
    const k = a * h * h + b * h + c;
    steps.push({ title: "Find h = −b/(2a)", latex: `h = -\\frac{${numTex(b)}}{2(${numTex(a)})} = ${numTex(h)}` });
    steps.push({ title: "Find k = f(h)", latex: `k = f(${numTex(h)}) = ${numTex(k)}` });
    steps.push({ title: "Vertex form", latex: `f(${v}) = ${numTex(a) === "1" ? "" : numTex(a)}\\left(${v} ${h >= 0 ? "-" : "+"} ${numTex(Math.abs(h))}\\right)^2 ${k >= 0 ? "+" : "-"} ${numTex(Math.abs(k))}` });
    return {
      interpreted: fTex, category: "function", topic: "Vertex of a parabola",
      answer: { latex: `(${numTex(h)}, ${numTex(k)})`, text: `(${numText(h)}, ${numText(k)})` },
      steps, formulas: [{ name: "Vertex", latex: "h = -\\frac{b}{2a},\; k = f(h)" }],
      explanation: `The vertex is the ${a > 0 ? "minimum" : "maximum"} point of the parabola; its x-coordinate is $-b/(2a)$.`,
      verification: verificationFrom([{ label: "f(h ± 1) are equal (symmetry)", passed: close(evalReal(node, { [v]: h + 1 }), evalReal(node, { [v]: h - 1 })) }]),
      graph: { expressions: [toStr(node)], points: [{ x: h, y: k, label: "vertex" }] },
    };
  }
  if (task === "inverse") {
    const sols = await CAS.solve(`${toCas(node)}=y__`, v);
    if (!sols || !sols.length) throw new MathInputError("Could not find an inverse for this function.");
    const inv = await bestForm(math.parse(sols[0].replace(/y__/g, v)));
    steps.push({ title: "Replace f(x) with y", latex: `y = ${toTex(node)}` });
    steps.push({ title: "Solve for x", latex: `${v} = ${toTex(await bestForm(math.parse(sols[0].replace(/y__/g, "y"))))}` });
    steps.push({ title: "Swap x and y", latex: `f^{-1}(${v}) = ${toTex(inv)}` });
    const test = 0.73;
    const composed = evalReal(inv, { [v]: evalReal(node, { [v]: test }) });
    return {
      interpreted: fTex, category: "function", topic: "Inverse function",
      answer: { latex: `f^{-1}(${v}) = ${toTex(inv)}`, text: `f^-1(${v}) = ${toStr(inv)}` },
      steps, formulas: [{ name: "Inverse", latex: "f(f^{-1}(x)) = x" }],
      explanation: "To find an inverse, write y = f(x), solve for x, then swap the roles of x and y.",
      warnings: sols.length > 1 ? ["The function is not one-to-one on its whole domain; restrict the domain to choose a branch."] : undefined,
      verification: verificationFrom([{ label: "f⁻¹(f(x)) = x at a test point", passed: close(composed, test, 1e-7) }]),
      graph: v === "x" ? { expressions: [toStr(node), toStr(inv), "x"] } : undefined,
    };
  }
  // domain / intercepts / analyze
  const restr = domainRestrictions(node, v);
  steps.push({ title: "Domain restrictions", latex: restr.tex.length ? restr.tex.join(",\; ") : "\\text{none — all real numbers}" });
  const yInt = evalReal(node, { [v]: 0 });
  let zeros: number[] = [];
  if (coeffs && coeffs.length > 1) zeros = polynomialRoots(coeffs, v).roots.filter((r) => !r.im).map((r) => r.value);
  else {
    const { findRealRoots } = await import("../numeric");
    const fc = node.compile();
    zeros = findRealRoots((x) => { try { return Number(fc.evaluate({ [v]: x })); } catch { return NaN; } }, -50, 50, 20000);
  }
  steps.push({ title: "y-intercept", latex: Number.isFinite(yInt) ? `f(0) = ${numTex(yInt)}` : "\\text{none (0 not in domain)}" });
  steps.push({ title: "x-intercepts (zeros)", latex: zeros.length ? zeros.map((z) => `${v} = ${numTex(z)}`).join(",\; ") : "\\text{none}" });
  const domainTex = restr.tex.length ? `\\{${v} \\in \\mathbb{R} : ${restr.tex.join(",\; ")}\\}` : "(-\\infty, \\infty)";
  return {
    interpreted: fTex,
    category: "function",
    topic: task === "domain" ? "Domain of a function" : "Function analysis",
    answer: task === "domain" ? { latex: domainTex, text: restr.tex.length ? `All real ${v} with ${restr.tex.join(", ").replace(/\\neq/g, "≠").replace(/\\geq/g, "≥")}` : "All real numbers" } : { latex: `\\text{Domain: } ${domainTex};\; \\text{zeros: } ${zeros.map(numTex).join(", ") || "none"};\; y\\text{-int: } ${Number.isFinite(yInt) ? numTex(yInt) : "none"}`, text: `zeros ${zeros.map(numText).join(", ") || "none"}; y-intercept ${Number.isFinite(yInt) ? numText(yInt) : "none"}` },
    steps,
    formulas: [{ name: "Domain rules", latex: "\\text{denominator} \\neq 0,\; \\sqrt{u}: u \\geq 0,\; \\log u: u > 0" }],
    explanation: "The domain excludes values that make a denominator zero, a square root negative, or a logarithm's argument non-positive.",
    verification: verificationFrom([
      ...zeros.slice(0, 4).map((z) => ({ label: `f(${numText(z)}) = 0`, passed: Math.abs(evalReal(node, { [v]: z })) < 1e-7 })),
      ...restrictedPoints(restr.tex, v).map((x) => ({ label: `f is undefined at ${v} = ${numText(x)}`, passed: !Number.isFinite(evalReal(node, { [v]: x })) })),
      { label: "Defined at a point inside the domain", passed: samplePoints(5, -3, 3).some((x) => restr.ok(x) && Number.isFinite(evalReal(node, { [v]: x }))) },
    ]),
    restrictions: restr.tex,
    graph: v === "x" ? { expressions: [toStr(node)], points: [...zeros.map((z) => ({ x: z, y: 0 })), ...(Number.isFinite(yInt) ? [{ x: 0, y: yInt }] : [])] } : undefined,
  };
}
