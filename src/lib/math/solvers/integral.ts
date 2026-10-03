import { math, toTex, toStr, variablesOf, evalReal, compile, type MathNode } from "../mathjs";
import { numTex, roundSig, numText } from "../format";
import { integrateImproper, samplePoints, close, numDerivative } from "../numeric";
import { CAS, toCas } from "../cas";
import { rationalParts, polyCoeffs } from "../poly";
import type { SolverOutput, Step, Formula, VerificationCheck } from "../types";
import { verificationFrom, MathInputError } from "../types";
import { bestForm } from "../pretty";

const F_POWER: Formula = { name: "Power rule for integrals", latex: "\\int x^n\\,dx = \\frac{x^{n+1}}{n+1} + C,\; n \\neq -1" };
const F_LN: Formula = { name: "Reciprocal rule", latex: "\\int \\frac{1}{x}\\,dx = \\ln|x| + C" };
const F_EXP: Formula = { name: "Exponential rule", latex: "\\int e^{x}\\,dx = e^{x} + C" };
const F_TRIG: Formula = { name: "Basic trig integrals", latex: "\\int \\sin x\\,dx = -\\cos x + C,\; \\int \\cos x\\,dx = \\sin x + C" };
const F_LINEAR: Formula = { name: "Linearity", latex: "\\int [a f(x) + b g(x)]\\,dx = a\\int f\\,dx + b\\int g\\,dx" };
const F_PARTS: Formula = { name: "Integration by parts", latex: "\\int u\\,dv = uv - \\int v\\,du" };
const F_SUB: Formula = { name: "u-substitution", latex: "\\int f(g(x))\\,g'(x)\\,dx = \\int f(u)\\,du" };
const F_FTC: Formula = { name: "Fundamental Theorem of Calculus", latex: "\\int_a^b f(x)\\,dx = F(b) - F(a)" };
const F_PF: Formula = { name: "Partial fractions", latex: "\\frac{P(x)}{(x-a)(x-b)} = \\frac{A}{x-a} + \\frac{B}{x-b}" };

function unwrap(n: MathNode): MathNode {
  while (n.type === "ParenthesisNode") n = (n as unknown as { content: MathNode }).content;
  return n;
}

function splitSum(n: MathNode): MathNode[] {
  const u = unwrap(n);
  if (u.type === "OperatorNode") {
    const o = u as unknown as { op: string; args: MathNode[] };
    if (o.args.length === 2 && o.op === "+") return [...splitSum(o.args[0]), ...splitSum(o.args[1])];
    if (o.args.length === 2 && o.op === "-") return [...splitSum(o.args[0]), ...splitSum(new math.OperatorNode("-", "unaryMinus", [o.args[1]]))];
  }
  return [u];
}

/** Classify the technique a term needs (used to explain steps and choose formulas). */
function technique(term: MathNode, v: string): { name: string; formula: Formula; hint: string } {
  const s = toStr(term);
  const coeffs = polyCoeffs(term, v);
  if (coeffs) return { name: "Power rule", formula: F_POWER, hint: "Raise the power by one and divide by the new power." };
  const rp = rationalParts(term, v);
  if (rp && rp.den.length > 1) {
    if (rp.den.length === 2 && rp.num.length === 1) return { name: "Reciprocal rule", formula: F_LN, hint: "A constant over a linear expression integrates to a natural logarithm." };
    return { name: "Partial fractions", formula: F_PF, hint: "Decompose the rational function into simpler fractions, then integrate each one." };
  }
  const hasPoly = /\bx\b|\^/.test(s.replace(new RegExp(`\\b${v}\\b`, "g"), "x"));
  const hasTrans = /(sin|cos|exp|e \^|log)\(?/.test(s);
  if (unwrap(term).type === "OperatorNode" && (unwrap(term) as unknown as { op: string }).op === "*" && hasPoly && hasTrans) {
    const factors = (unwrap(term) as unknown as { args: MathNode[] }).args;
    const nonConst = factors.filter((f) => variablesOf(f).includes(v));
    if (nonConst.length >= 2) {
      // f(g(x))·g'(x)? check derivative relationship → substitution, else parts
      for (const f of nonConst) {
        const uf = unwrap(f);
        if (uf.type === "FunctionNode" || (uf.type === "OperatorNode" && (uf as unknown as { op: string }).op === "^")) {
          const inner = unwrap((uf as unknown as { args: MathNode[] }).args[uf.type === "FunctionNode" ? 0 : 1] ?? uf);
          if (inner.type !== "SymbolNode" && variablesOf(inner).includes(v)) {
            try {
              const g = math.derivative(inner, v);
              const others = nonConst.filter((o) => o !== f);
              const ratio = math.simplify(math.parse(`(${others.map(toStr).join("*")})/(${toStr(g)})`));
              if (!variablesOf(ratio).includes(v)) return { name: "u-substitution", formula: F_SUB, hint: `Let $u = ${toTex(inner)}$, so $du = ${toTex(g)}\\,d${v}$.` };
            } catch {
              /* fall through */
            }
          }
        }
      }
      return { name: "Integration by parts", formula: F_PARTS, hint: "Choose $u$ by LIATE (Logs, Inverse trig, Algebraic, Trig, Exponential) and let $dv$ be the rest." };
    }
  }
  if (/sin|cos|tan|sec|csc|cot/.test(s)) return { name: "Trigonometric integral", formula: F_TRIG, hint: "Use a standard trig antiderivative (and the chain rule in reverse for inner linear terms)." };
  if (/exp|e \^/.test(s)) return { name: "Exponential rule", formula: F_EXP, hint: "The exponential is its own antiderivative (divide by the inner coefficient)." };
  if (/log/.test(s)) return { name: "Integration by parts", formula: F_PARTS, hint: "Let $u = \\ln$ and $dv = d" + v + "$." };
  return { name: "Standard integral", formula: F_LINEAR, hint: "Use a table of standard antiderivatives." };
}

/** Antiderivative of a single node via the CAS, with partial-fraction fallback for real-valued results. */
async function antiderivative(node: MathNode, v: string): Promise<string | null> {
  const casExpr = toCas(node);
  let res = await CAS.integrate(casExpr, v);
  const isComplex = (s: string) => /(^|[^a-z])i([^a-z]|$)/.test(s);
  if (!res || isComplex(res)) {
    const pf = await CAS.partfrac(casExpr, v);
    if (pf) {
      const parts = splitSum(math.parse(pf));
      const pieces: string[] = [];
      for (const p of parts) {
        const r = await CAS.integrate(toCas(p), v);
        if (!r || isComplex(r)) return null;
        pieces.push(`(${r})`);
      }
      res = pieces.join(" + ");
    } else return null;
  }
  return res;
}

export interface IntegralRequest {
  expr: string;
  variable: string;
  lower?: string;
  upper?: string;
}

export async function solveIntegral(req: IntegralRequest): Promise<SolverOutput> {
  const node = math.parse(req.expr);
  const v = req.variable;
  const definite = req.lower !== undefined && req.upper !== undefined;
  const a = definite ? evalReal(req.lower!.replace(/^-?inf(inity)?$/i, (m) => (m.startsWith("-") ? "-Infinity" : "Infinity"))) : NaN;
  const b = definite ? evalReal(req.upper!.replace(/^-?inf(inity)?$/i, (m) => (m.startsWith("-") ? "-Infinity" : "Infinity"))) : NaN;
  if (definite && (Number.isNaN(a) || Number.isNaN(b))) throw new MathInputError("The integration bounds must be numbers.");
  const boundTex = (x: number, raw: string) => (Number.isFinite(x) ? toTex(raw) : x > 0 ? "\\infty" : "-\\infty");
  const interpreted = definite
    ? `\\int_{${boundTex(a, req.lower!)}}^{${boundTex(b, req.upper!)}} ${toTex(node)}\\,d${v}`
    : `\\int ${toTex(node)}\\,d${v}`;
  const steps: Step[] = [{ title: "Set up the integral", latex: interpreted }];
  const formulas: Formula[] = [];
  const terms = splitSum(node);

  if (terms.length > 1) {
    formulas.push(F_LINEAR);
    steps.push({
      title: "Split using linearity",
      text: "The integral of a sum is the sum of the integrals.",
      latex: terms.map((t) => `\\int ${toTex(t)}\\,d${v}`).join(" + "),
    });
  }
  const pieces: string[] = [];
  let failed = false;
  for (const t of terms.slice(0, 10)) {
    const tech = technique(t, v);
    if (!formulas.includes(tech.formula)) formulas.push(tech.formula);
    if (tech.name === "Partial fractions") {
      const pf = await CAS.partfrac(toCas(t), v);
      if (pf) steps.push({ title: "Partial fraction decomposition", latex: `${toTex(t)} = ${toTex(pf)}` });
    }
    const r = await antiderivative(t, v);
    if (!r) {
      failed = true;
      break;
    }
    pieces.push(r);
    steps.push({ title: tech.name, text: tech.hint, latex: `\\int ${toTex(t)}\\,d${v} = ${toTex(await bestForm(r, { cas: false }))}` });
  }
  let F: MathNode | null = null;
  if (!failed) {
    try {
      F = await bestForm(math.parse(pieces.map((p) => `(${p})`).join(" + ")));
    } catch {
      F = math.parse(pieces.join(" + "));
    }
  }
  const f = compile(node);
  const fNum = (x: number) => {
    try {
      const r = f.evaluate({ [v]: x });
      return typeof r === "number" ? r : NaN;
    } catch {
      return NaN;
    }
  };
  const checks: VerificationCheck[] = [];

  if (!definite) {
    if (!F) {
      throw new MathInputError("This integral has no elementary antiderivative (or it could not be found). Try a definite integral to get a numerical value.");
    }
    const Fc = compile(F);
    const Fn = (x: number) => {
      try {
        const r = Fc.evaluate({ [v]: x });
        return typeof r === "number" ? r : NaN;
      } catch {
        return NaN;
      }
    };
    let tested = 0;
    let passed = 0;
    for (const x of samplePoints(9, 0.15, 3.4)) {
      const lhs = numDerivative(Fn, x);
      const rhs = fNum(x);
      if (!Number.isFinite(lhs) || !Number.isFinite(rhs)) continue;
      tested++;
      if (close(lhs, rhs, 1e-4)) passed++;
    }
    checks.push({ label: "Differentiating the answer returns the integrand", passed: tested > 0 && passed === tested, detail: `${passed}/${tested} sample points` });
    const usesLn = /\blog\(/.test(toStr(F));
    steps.push({ title: "Add the constant of integration", latex: `\\int ${toTex(node)}\\,d${v} = ${toTex(F)} + C` });
    return {
      interpreted,
      category: "integral",
      topic: "Indefinite integral",
      answer: { latex: `${toTex(F)} + C`, text: `${toStr(F)} + C` },
      steps,
      formulas,
      explanation: "Find a function whose derivative is the integrand. Every antiderivative differs by a constant, so add $+C$.",
      verification: verificationFrom(checks),
      warnings: usesLn ? ["Here $\\ln$ denotes the natural logarithm; for arguments that can be negative use $\\ln|u|$."] : undefined,
      graph: v === "x" ? { expressions: [toStr(node), toStr(F)] } : undefined,
    };
  }

  // Definite integral
  formulas.push(F_FTC);
  const numeric = integrateImproper(fNum, a, b);
  let exactValue: number | null = null;
  let exactTex: string | null = null;
  if (F) {
    const evalAt = async (x: number, raw: string): Promise<number> => {
      if (Number.isFinite(x)) return evalReal(F!, { [v]: x });
      const lim = await CAS.limit(toCas(F!), v, x > 0 ? "Infinity" : "-Infinity");
      return lim ? evalReal(lim) : NaN;
      void raw;
    };
    const Fb = await evalAt(b, req.upper!);
    const Fa = await evalAt(a, req.lower!);
    // Guard against discontinuities inside [a, b] (FTC requires continuity)
    const singular = samplePoints(41, Math.max(a, -1e3), Math.min(b, 1e3)).some((x) => !Number.isFinite(fNum(x)));
    if (Number.isFinite(Fb) && Number.isFinite(Fa) && !singular) {
      exactValue = Fb - Fa;
      steps.push({ title: "Find an antiderivative", latex: `F(${v}) = ${toTex(F)}` });
      steps.push({
        title: "Evaluate F(b) − F(a)",
        latex: `F(${boundTex(b, req.upper!)}) - F(${boundTex(a, req.lower!)}) = ${numTex(Fb)} - \\left(${numTex(Fa)}\\right) = ${numTex(exactValue)}`,
      });
      exactTex = numTex(exactValue);
    }
  }
  if (exactValue === null) {
    if (!Number.isFinite(numeric)) throw new MathInputError("This integral does not converge (it diverges).");
    steps.push({ title: "Evaluate numerically", text: "No closed-form antiderivative applies on this interval, so the integral is computed with adaptive Simpson's rule.", latex: `\\approx ${roundSig(numeric, 10)}` });
    formulas.push({ name: "Simpson's rule", latex: "\\int_a^b f\\,dx \\approx \\frac{h}{3}\\left[f_0 + 4f_1 + 2f_2 + \\cdots + f_n\\right]" });
  }
  const value = exactValue ?? numeric;
  if (exactValue !== null && Number.isFinite(numeric)) {
    checks.push({ label: "Matches numerical integration (adaptive Simpson)", passed: close(exactValue, numeric, 1e-5), detail: `≈ ${roundSig(numeric, 10)}` });
  } else checks.push({ label: "Computed by adaptive numerical integration", passed: Number.isFinite(numeric), detail: `≈ ${roundSig(numeric, 10)}` });
  if (F) checks.push({ label: "Antiderivative found symbolically", passed: true });
  return {
    interpreted,
    category: "integral",
    topic: Number.isFinite(a) && Number.isFinite(b) ? "Definite integral" : "Improper integral",
    answer: {
      latex: `${interpreted} = ${exactTex ?? `\\approx ${roundSig(value, 10)}`}`,
      text: exactTex ? numText(value) : `≈ ${roundSig(value, 10)}`,
      decimal: roundSig(value, 10),
    },
    steps,
    formulas,
    explanation: "A definite integral measures signed area under the curve. Find an antiderivative and evaluate it at the upper and lower limits, then subtract.",
    verification: verificationFrom(checks),
    graph: v === "x" ? { expressions: [toStr(node)], xRange: Number.isFinite(a) && Number.isFinite(b) ? [Math.min(a, b) - 1, Math.max(a, b) + 1] : undefined } : undefined,
  };
}
