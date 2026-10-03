import { math, toTex, toStr, evalReal, variablesOf, type MathNode } from "../mathjs";
import { numTex, numText, polyTex, roundSig } from "../format";
import { findRealRoots, close } from "../numeric";
import { polyCoeffs, rationalParts } from "../poly";
import { CAS, toCas } from "../cas";
import type { SolverOutput, Step, Formula, VerificationCheck, Category } from "../types";
import { verificationFrom } from "../types";
import { polynomialRoots, quadraticRoots, quadraticFactoringSteps, completingSquareSteps, realRoot, type Root } from "./roots";

const TRIG = /\b(sin|cos|tan|sec|csc|cot)\(/;

function hasVarIn(node: MathNode, v: string, pred: (n: MathNode) => boolean): boolean {
  let found = false;
  node.traverse((n) => {
    if (!found && pred(n) && variablesOf(n).includes(v)) found = true;
  });
  return found;
}

/** Domain restrictions implied by denominators, logs and even roots. */
export function domainRestrictions(node: MathNode, v: string): { tex: string[]; ok: (x: number) => boolean } {
  const tex: string[] = [];
  const tests: ((x: number) => boolean)[] = [];
  node.traverse((n) => {
    if (n.type === "OperatorNode" && (n as unknown as { op: string }).op === "/") {
      const den = (n as unknown as { args: MathNode[] }).args[1];
      if (variablesOf(den).includes(v)) {
        const c = polyCoeffs(den, v);
        if (c && c.length === 2) tex.push(`${v} \\neq ${numTex(-c[1] / c[0])}`);
        else if (c && c.length === 3) {
          const zs = findRealRoots((x) => c[0] * x * x + c[1] * x + c[2], -1000, 1000, 40000);
          zs.forEach((z) => tex.push(`${v} \\neq ${numTex(z)}`));
        } else tex.push(`${toTex(den)} \\neq 0`);
        const f = den.compile();
        tests.push((x) => {
          const d = Number(f.evaluate({ [v]: x }));
          return Number.isFinite(d) && Math.abs(d) > 1e-12;
        });
      }
    }
    if (n.type === "FunctionNode") {
      const fn = n as unknown as { fn: { name: string }; args: MathNode[] };
      const arg = fn.args[0];
      if (!arg || !variablesOf(arg).includes(v)) return;
      if (["log", "log10", "log2"].includes(fn.fn.name)) {
        tex.push(`${toTex(arg)} > 0`);
        const f = arg.compile();
        tests.push((x) => Number(f.evaluate({ [v]: x })) > 0);
      }
      if (fn.fn.name === "sqrt") {
        tex.push(`${toTex(arg)} \\geq 0`);
        const f = arg.compile();
        tests.push((x) => Number(f.evaluate({ [v]: x })) >= -1e-12);
      }
    }
  });
  return { tex: [...new Set(tex)], ok: (x) => tests.every((t) => { try { return t(x); } catch { return false; } }) };
}

function rootsAnswer(roots: Root[], v: string): { latex: string; text: string; decimal?: string } {
  const real = roots.filter((r) => !r.im);
  if (!roots.length) return { latex: "\\text{No solution}", text: "No solution" };
  const latex = roots.map((r) => `${v} = ${r.tex}`).join(",\\quad ");
  const text = roots.map((r) => `${v} = ${r.text}`).join(", ");
  const inexact = real.filter((r) => r.exact && !/^-?\d+$/.test(r.text));
  const decimal = inexact.length ? real.map((r) => `${v} ≈ ${roundSig(r.value, 8)}`).join(", ") : undefined;
  return { latex, text, decimal };
}

function substitutionChecks(lhs: MathNode, rhs: MathNode, v: string, roots: Root[]): VerificationCheck[] {
  const fl = lhs.compile();
  const fr = rhs.compile();
  return roots.map((r) => {
    try {
      const x = r.im ? math.complex(r.value, r.im) : r.value;
      const L = fl.evaluate({ [v]: x });
      const R = fr.evaluate({ [v]: x });
      const diff = math.abs(math.subtract(L, R) as never) as unknown as number;
      const scale = Math.max(1, Number(math.abs(L as never)));
      const ok = Number(diff) <= 1e-7 * scale;
      return {
        label: `Substitute ${v} = ${r.text} into the original equation`,
        passed: ok,
        detail: r.im ? (ok ? "Both sides agree" : "Mismatch") : `LHS = ${roundSig(Number(L), 8)}, RHS = ${roundSig(Number(R), 8)}`,
      };
    } catch {
      return { label: `Substitute ${v} = ${r.text}`, passed: false, detail: "Could not evaluate" };
    }
  });
}

function categorize(f: MathNode, v: string, degree: number | null): { category: Category; topic: string } {
  const s = toStr(f);
  if (degree === 1) return { category: "equation", topic: "Linear equation" };
  if (degree === 2) return { category: "equation", topic: "Quadratic equation" };
  if (degree !== null && degree >= 3) return { category: "polynomial", topic: `Polynomial equation (degree ${degree})` };
  if (TRIG.test(s)) return { category: "trigonometry", topic: "Trigonometric equation" };
  if (/\blog(10|2)?\(/.test(s)) return { category: "logarithm", topic: "Logarithmic equation" };
  if (hasVarIn(f, v, (n) => n.type === "OperatorNode" && (n as unknown as { op: string }).op === "^" && variablesOf((n as unknown as { args: MathNode[] }).args[1]).includes(v)) || /\bexp\(/.test(s))
    return { category: "exponent", topic: "Exponential equation" };
  if (/sqrt\(|nthRoot\(/.test(s)) return { category: "equation", topic: "Radical equation" };
  if (/abs\(/.test(s)) return { category: "equation", topic: "Absolute value equation" };
  return { category: "equation", topic: "Equation" };
}

/** Detect the fundamental period of a trig equation f(x) = 0. */
function detectPeriod(f: (x: number) => number): number | null {
  const candidates = [Math.PI / 4, Math.PI / 3, Math.PI / 2, (2 * Math.PI) / 3, Math.PI, 2 * Math.PI, 4 * Math.PI, 6 * Math.PI];
  const pts = [0.3, 0.71, 1.13, 2.29, 3.7];
  for (const p of candidates) {
    if (pts.every((x) => { const a = f(x); const b = f(x + p); return Number.isFinite(a) && Number.isFinite(b) && close(a, b, 1e-9); })) return p;
  }
  return null;
}

export async function solveEquation(lhsStr: string, rhsStr: string, v: string): Promise<SolverOutput> {
  const lhs = math.parse(lhsStr);
  const rhs = math.parse(rhsStr);
  const f = math.parse(`(${lhsStr}) - (${rhsStr})`);
  const eqTex = `${toTex(lhs)} = ${toTex(rhs)}`;
  const steps: Step[] = [{ title: "Write the equation", latex: eqTex }];
  const formulas: Formula[] = [];
  const coeffs = polyCoeffs(f, v);
  const degree = coeffs ? coeffs.length - 1 : null;
  const cat = categorize(f, v, degree);
  const category = cat.category;
  let topic = cat.topic;
  let roots: Root[] = [];
  let alternative: SolverOutput["alternative"];
  const restrictions = domainRestrictions(f, v);
  const warnings: string[] = [];
  let explanation = "";

  if (coeffs && degree !== null) {
    if (degree === 0) {
      const isIdentity = Math.abs(coeffs[0]) < 1e-12;
      steps.push({
        title: "Simplify",
        latex: `${numTex(coeffs[0])} = 0`,
        text: isIdentity ? "The variable cancels and the statement is always true." : "The variable cancels and the statement is false.",
      });
      return {
        interpreted: eqTex,
        category: "equation",
        topic: "Linear equation",
        answer: isIdentity ? { latex: `\\text{All real numbers } ${v} \\in \\mathbb{R}`, text: "All real numbers (identity)" } : { latex: "\\text{No solution}", text: "No solution (contradiction)" },
        steps,
        formulas,
        explanation: isIdentity ? "Both sides are equal for every value of the variable, so this is an identity." : "The two sides can never be equal, so the equation has no solution.",
        verification: verificationFrom([{ label: "Both sides reduce to constants", passed: true }]),
      };
    }
    const lc = polyCoeffs(lhs, v);
    const rc = polyCoeffs(rhs, v);
    if (degree === 1) {
      const [a, b] = coeffs;
      if (lc && rc) {
        const simplified = `${polyTex(lc, v)} = ${polyTex(rc, v)}`;
        if (simplified !== eqTex) steps.push({ title: "Simplify each side", latex: simplified, text: "Distribute and combine like terms on each side." });
      }
      steps.push({
        title: "Collect variable terms on one side and constants on the other",
        latex: `${numTex(a) === "1" ? "" : numTex(a) === "-1" ? "-" : numTex(a)}${v} = ${numTex(-b)}`,
        text: "Use inverse operations: add or subtract the same quantity on both sides.",
      });
      const r = -b / a;
      if (Math.abs(a - 1) > 1e-12) steps.push({ title: `Divide both sides by ${numText(a)}`, latex: `${v} = \\frac{${numTex(-b)}}{${numTex(a)}} = ${numTex(r)}` });
      roots = [realRoot(r)];
      formulas.push({ name: "Linear equation", latex: `a${v} + b = 0 \;\\Rightarrow\; ${v} = -\\frac{b}{a}` });
      explanation = `This is a linear equation. Isolate $${v}$ by moving all variable terms to one side and constants to the other, then divide by the coefficient of $${v}$.`;
      alternative = {
        title: "Graphical method",
        steps: [
          { title: "Graph both sides", text: `Graph $y = ${toTex(lhs)}$ and $y = ${toTex(rhs)}$ on the same axes.` },
          { title: "Find the intersection", text: `The lines intersect where $${v} = ${numTex(r)}$, which is the solution.` },
        ],
      };
    } else if (degree === 2) {
      const [a, b, c] = coeffs;
      steps.push({ title: "Write in standard form", latex: `${polyTex(coeffs, v)} = 0`, text: "Move every term to one side so the other side is zero." });
      const q = quadraticRoots(a, b, c, v);
      steps.push(...q.steps);
      formulas.push(...q.formulas);
      roots = q.roots;
      explanation = `This is a quadratic equation. After writing it in standard form $a${v}^2+b${v}+c=0$, the discriminant tells us how many real solutions exist, and the quadratic formula gives them exactly.`;
      const factoring = quadraticFactoringSteps(a, b, c, v);
      alternative = factoring
        ? { title: "Factoring", steps: factoring }
        : { title: "Completing the square", steps: completingSquareSteps(a, b, c, v) };
    } else {
      steps.push({ title: "Write in standard form", latex: `${polyTex(coeffs, v)} = 0` });
      const p = polynomialRoots(coeffs, v);
      steps.push(...p.steps);
      formulas.push(...p.formulas);
      roots = p.roots;
      explanation = `This is a polynomial equation of degree ${degree}. We search for rational roots, divide them out with synthetic division, and solve the remaining factor.`;
      const factored = await CAS.factor(toCas(f));
      if (factored) alternative = { title: "Factor completely", steps: [{ title: "Factored form", latex: `${toTex(factored)} = 0` }, { title: "Zero product property", text: "Set each factor equal to zero and solve." }] };
    }
  } else {
    const rp = rationalParts(f, v);
    if (rp && rp.den.length > 1) {
      // Rational equation
      topic = "Rational equation";
      steps.push({ title: "State restrictions", latex: restrictions.tex.join(",\\quad ") || "\\text{none}", text: "Values that make a denominator zero are excluded from the solution set." });
      steps.push({ title: "Combine into a single fraction", latex: `\\frac{${polyTex(rp.num, v)}}{${polyTex(rp.den, v)}} = 0` });
      steps.push({ title: "Multiply both sides by the denominator", latex: `${polyTex(rp.num, v)} = 0`, text: "A fraction is zero exactly when its numerator is zero (and the denominator is not)." });
      if (rp.num.length <= 1) {
        roots = [];
      } else {
        const p = polynomialRoots(rp.num, v);
        steps.push(...p.steps);
        formulas.push(...p.formulas);
        roots = p.roots;
      }
      const rejected = roots.filter((r) => !r.im && !restrictions.ok(r.value));
      if (rejected.length) {
        steps.push({ title: "Reject extraneous solutions", text: `${rejected.map((r) => `$${v} = ${r.tex}$`).join(", ")} makes a denominator zero, so it is not a solution.` });
        roots = roots.filter((r) => !rejected.includes(r));
      }
      explanation = "This is a rational equation. Multiply through by the least common denominator to clear fractions, solve the resulting polynomial, then discard any solution that makes an original denominator zero.";
      formulas.push({ name: "Zero of a fraction", latex: "\\frac{P}{Q} = 0 \\iff P = 0,\; Q \\neq 0" });
    } else {
      // General transcendental / radical equation
      const s = toStr(f);
      const fn = f.compile();
      const F = (x: number) => {
        try {
          const val = fn.evaluate({ [v]: x });
          return typeof val === "number" ? val : NaN;
        } catch {
          return NaN;
        }
      };
      if (restrictions.tex.length) steps.push({ title: "Domain restrictions", latex: restrictions.tex.join(",\\quad ") });
      if (topic === "Exponential equation") {
        steps.push({ title: "Isolate the exponential expression", text: "Get the term with the variable in the exponent alone on one side." });
        steps.push({ title: "Take the logarithm of both sides", text: "Use $\\log(a^u) = u\\log(a)$ to bring the exponent down.", latex: "a^{u} = c \;\\Rightarrow\; u = \\frac{\\ln c}{\\ln a}" });
        formulas.push({ name: "Power rule of logarithms", latex: "\\ln(a^u) = u\\ln a" });
      } else if (topic === "Logarithmic equation") {
        steps.push({ title: "Combine logarithms", text: "Use the product, quotient and power rules to write a single logarithm on each side." });
        steps.push({ title: "Rewrite in exponential form", latex: "\\log_b(u) = c \;\\Rightarrow\; u = b^{c}" });
        formulas.push({ name: "Definition of logarithm", latex: "\\log_b(u) = c \\iff b^c = u" });
      } else if (topic === "Radical equation") {
        steps.push({ title: "Isolate the radical", text: "Move every term without the root to the other side." });
        steps.push({ title: "Square both sides", text: "Squaring can introduce extraneous solutions, so every candidate must be checked in the original equation." });
      } else if (topic === "Absolute value equation") {
        steps.push({ title: "Split into cases", latex: "|u| = c \;\\Rightarrow\; u = c \;\\text{ or }\; u = -c \\quad (c \\geq 0)" });
        formulas.push({ name: "Absolute value", latex: "|u| = c \\iff u = \\pm c" });
      } else if (category === "trigonometry") {
        steps.push({ title: "Isolate the trigonometric function", text: "Rearrange so a single trig function equals a constant." });
        steps.push({ title: "Find reference angles", text: "Use the unit circle (or inverse trig) to find all angles in one period." });
        formulas.push({ name: "Unit circle", latex: "\\sin^2\\theta + \\cos^2\\theta = 1" });
      }

      // Exact candidates from the CAS
      const exact = (await CAS.solve(`${toCas(lhs)}=${toCas(rhs)}`, v)) ?? [];
      const candidates: Root[] = [];
      const rejected: Root[] = [];
      for (const sol of exact) {
        try {
          const val = evalReal(sol);
          if (!Number.isFinite(val)) continue;
          const r: Root = { tex: toTex(sol), text: sol.replace(/\s+/g, ""), value: val, exact: true };
          const known = realRoot(val);
          if (known.exact || r.tex.length > 40) Object.assign(r, { tex: known.exact ? known.tex : r.tex, text: known.exact ? known.text : r.text });
          const ok = restrictions.ok(val) && Number.isFinite(F(val)) && Math.abs(F(val)) < 1e-7 * Math.max(1, Math.abs(val));
          (ok ? candidates : rejected).push(r);
        } catch {
          /* ignore unparsable */
        }
      }
      if (category === "trigonometry") {
        const period = detectPeriod(F);
        const base = findRealRoots(F, 0, period ?? 2 * Math.PI, 20000).filter((x) => x < (period ?? 2 * Math.PI) - 1e-9);
        roots = base.map((x) => realRoot(x));
        if (roots.length) {
          const p = period ?? 2 * Math.PI;
          const pTex = numTex(p);
          steps.push({
            title: `Solutions in one period [0, ${numText(p)})`,
            latex: roots.map((r) => `${v} = ${r.tex}`).join(",\\quad "),
          });
          steps.push({ title: "Add the period for the general solution", latex: roots.map((r) => `${v} = ${r.tex} + ${pTex === "1" ? "" : pTex}k`).join(",\\quad ") + ",\\quad k \\in \\mathbb{Z}" });
          explanation = "Trigonometric equations have infinitely many solutions because trig functions are periodic. Find every solution in one period, then add integer multiples of the period.";
          const checks = substitutionChecks(lhs, rhs, v, roots);
          return {
            interpreted: eqTex,
            category,
            topic,
            answer: {
              latex: roots.map((r) => `${v} = ${r.tex} + ${pTex}k`).join(",\; ") + ",\; k \\in \\mathbb{Z}",
              text: roots.map((r) => `${v} = ${r.text} + ${numText(p)}k`).join(", ") + " (k any integer)",
              decimal: roots.map((r) => `${v} ≈ ${roundSig(r.value, 8)}`).join(", "),
            },
            steps,
            formulas,
            explanation,
            verification: verificationFrom(checks),
            restrictions: restrictions.tex,
            graph: { expressions: [toStr(lhs), toStr(rhs)], points: roots.map((r) => ({ x: r.value, y: evalReal(lhs, { [v]: r.value }) })) },
          };
        }
      }
      const numeric = findRealRoots(F, -100, 100, 40000).filter((x) => restrictions.ok(x));
      roots = [...candidates];
      for (const x of numeric) {
        if (!roots.some((r) => Math.abs(r.value - x) < 1e-6 * Math.max(1, Math.abs(x)))) {
          const rr = realRoot(x);
          roots.push(rr.exact ? rr : { tex: `\\approx ${roundSig(x, 8)}`, text: `≈ ${roundSig(x, 8)}`, value: x, exact: false });
        }
      }
      roots.sort((a, b) => a.value - b.value);
      if (rejected.length) {
        steps.push({ title: "Check for extraneous solutions", text: `${rejected.map((r) => `$${v} = ${r.tex}$`).join(", ")} does not satisfy the original equation and is rejected.` });
      }
      steps.push({
        title: "Solve",
        latex: roots.length ? roots.map((r) => `${v} = ${r.tex}`).join(",\\quad ") : "\\text{No real solution}",
        text: candidates.length ? "Solving algebraically and checking each candidate gives:" : "Solving numerically (the solutions are refined to high precision) gives:",
      });
      if (!candidates.length && roots.length) warnings.push("Some solutions were found numerically; they are accurate approximations rather than exact forms.");
      if (/abs\(/.test(s) || /sqrt\(/.test(s)) formulas.push({ name: "Check every candidate", latex: "\\text{Substitute back into the original equation}" });
      explanation ||= `Rearrange the equation to isolate $${v}$, then verify every candidate in the original equation since some algebraic steps can introduce extraneous solutions.`;
    }
  }

  roots.sort((p, q) => (p.im ? 1 : 0) - (q.im ? 1 : 0) || p.value - q.value || (p.im ?? 0) - (q.im ?? 0));
  const checks = substitutionChecks(lhs, rhs, v, roots);
  const realRoots = roots.filter((r) => !r.im);
  if (roots.length && !realRoots.length) warnings.push("This equation has no real solutions; the solutions shown are complex numbers.");
  steps.push({
    title: "Final answer",
    latex: roots.length ? roots.map((r) => `${v} = ${r.tex}`).join(",\\quad ") : "\\text{No solution}",
  });
  return {
    interpreted: eqTex,
    category,
    topic,
    answer: rootsAnswer(roots, v),
    steps,
    formulas,
    explanation,
    verification: verificationFrom(checks),
    alternative,
    restrictions: restrictions.tex.length ? restrictions.tex : undefined,
    warnings: warnings.length ? warnings : undefined,
    graph: {
      expressions: [toStr(lhs), toStr(rhs)].filter((e) => e !== "0"),
      points: realRoots.map((r) => ({ x: r.value, y: evalReal(lhs, { [v]: r.value }), label: `${v}=${r.text}` })),
    },
  };
}
