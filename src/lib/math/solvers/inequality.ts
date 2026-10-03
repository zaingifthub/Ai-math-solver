import { math, toTex, toStr, type MathNode } from "../mathjs";
import { numTex, numText, polyTex } from "../format";
import { findRealRoots } from "../numeric";
import { polyCoeffs, rationalParts } from "../poly";
import type { SolverOutput, Step, VerificationCheck } from "../types";
import { verificationFrom } from "../types";
import { polynomialRoots } from "./roots";
import type { Relation } from "../normalize";

const OP_TEX: Record<string, string> = { "<": "<", ">": ">", "<=": "\\leq", ">=": "\\geq", "!=": "\\neq" };
const flip: Record<string, Relation> = { "<": ">", ">": "<", "<=": ">=", ">=": "<=", "!=": "!=", "=": "=" };

function holds(val: number, op: Relation): boolean {
  switch (op) {
    case "<": return val < 0;
    case ">": return val > 0;
    case "<=": return val <= 0;
    case ">=": return val >= 0;
    case "!=": return val !== 0;
    default: return val === 0;
  }
}

interface Interval { lo: number; hi: number; loClosed: boolean; hiClosed: boolean }

function intervalTex(iv: Interval): string {
  const lo = iv.lo === -Infinity ? "-\\infty" : numTex(iv.lo);
  const hi = iv.hi === Infinity ? "\\infty" : numTex(iv.hi);
  if (iv.lo === iv.hi) return `\\{${lo}\\}`;
  return `${iv.loClosed ? "[" : "("}${lo}, ${hi}${iv.hiClosed ? "]" : ")"}`;
}
function intervalText(iv: Interval): string {
  const lo = iv.lo === -Infinity ? "-∞" : numText(iv.lo);
  const hi = iv.hi === Infinity ? "∞" : numText(iv.hi);
  if (iv.lo === iv.hi) return `{${lo}}`;
  return `${iv.loClosed ? "[" : "("}${lo}, ${hi}${iv.hiClosed ? "]" : ")"}`;
}

/** Merge adjacent intervals that share a closed endpoint. */
function merge(ivs: Interval[]): Interval[] {
  const out: Interval[] = [];
  for (const iv of ivs) {
    const last = out[out.length - 1];
    if (last && last.hi === iv.lo && (last.hiClosed || iv.loClosed)) {
      last.hi = iv.hi;
      last.hiClosed = iv.hiClosed;
    } else out.push({ ...iv });
  }
  return out;
}

export function solveInequality(lhsStr: string, op: Relation, rhsStr: string, v: string): SolverOutput {
  const lhs = math.parse(lhsStr);
  const rhs = math.parse(rhsStr);
  const f = math.parse(`(${lhsStr}) - (${rhsStr})`);
  const ineqTex = `${toTex(lhs)} ${OP_TEX[op]} ${toTex(rhs)}`;
  const steps: Step[] = [{ title: "Write the inequality", latex: ineqTex }];
  const fc = f.compile();
  const F = (x: number) => {
    try {
      const r = fc.evaluate({ [v]: x });
      return typeof r === "number" ? r : NaN;
    } catch {
      return NaN;
    }
  };
  const coeffs = polyCoeffs(f, v);

  // Linear: show the classic inverse-operation steps (including the sign flip)
  if (coeffs && coeffs.length === 2) {
    const [a, b] = coeffs;
    steps.push({ title: "Collect terms", latex: `${numTex(a) === "1" ? "" : numTex(a) === "-1" ? "-" : numTex(a)}${v} ${OP_TEX[op]} ${numTex(-b)}`, text: "Move variable terms to the left and constants to the right." });
    const bound = -b / a;
    const finalOp = a < 0 ? flip[op] : op;
    steps.push({
      title: `Divide both sides by ${numText(a)}`,
      latex: `${v} ${OP_TEX[finalOp]} ${numTex(bound)}`,
      text: a < 0 ? "Dividing by a negative number **reverses** the inequality sign." : "Dividing by a positive number keeps the inequality direction.",
    });
    const iv: Interval =
      finalOp === "<" || finalOp === "<="
        ? { lo: -Infinity, hi: bound, loClosed: false, hiClosed: finalOp === "<=" }
        : { lo: bound, hi: Infinity, loClosed: finalOp === ">=", hiClosed: false };
    const checks: VerificationCheck[] = [
      { label: `Test point inside the solution (${v} = ${numText(iv.lo === -Infinity ? bound - 1 : bound + 1)})`, passed: holds(F(iv.lo === -Infinity ? bound - 1 : bound + 1), op) },
      { label: `Test point outside the solution (${v} = ${numText(iv.lo === -Infinity ? bound + 1 : bound - 1)})`, passed: !holds(F(iv.lo === -Infinity ? bound + 1 : bound - 1), op) },
    ];
    return {
      interpreted: ineqTex,
      category: "inequality",
      topic: "Linear inequality",
      answer: { latex: `${v} ${OP_TEX[finalOp]} ${numTex(bound)} \\quad\\Leftrightarrow\\quad ${v} \\in ${intervalTex(iv)}`, text: `${v} ${finalOp} ${numText(bound)}  (interval ${intervalText(iv)})` },
      steps,
      formulas: [{ name: "Multiplying by a negative", latex: "a < b,\; c < 0 \\Rightarrow ac > bc" }],
      explanation: "Solve a linear inequality like an equation, but remember to reverse the inequality sign whenever you multiply or divide both sides by a negative number.",
      verification: verificationFrom(checks),
      graph: { expressions: [toStr(lhs), toStr(rhs)] },
    };
  }

  // General: critical points + sign chart
  steps.push({ title: "Move everything to one side", latex: `${toTex(f)} ${OP_TEX[op]} 0` });
  let critical: number[] = [];
  let poles: number[] = [];
  const rp = rationalParts(f, v);
  if (rp) {
    const numRoots = rp.num.length > 1 ? polynomialRoots(rp.num, v).roots.filter((r) => !r.im).map((r) => r.value) : [];
    const denRoots = rp.den.length > 1 ? polynomialRoots(rp.den, v).roots.filter((r) => !r.im).map((r) => r.value) : [];
    critical = numRoots;
    poles = denRoots;
    steps.push({
      title: "Find the critical points",
      latex: rp.den.length > 1 ? `\\frac{${polyTex(rp.num, v)}}{${polyTex(rp.den, v)}} ${OP_TEX[op]} 0` : `${polyTex(rp.num, v)} ${OP_TEX[op]} 0`,
      text: `Zeros of the numerator: ${numRoots.length ? numRoots.map((r) => `$${numTex(r)}$`).join(", ") : "none"}${denRoots.length ? `; zeros of the denominator (excluded): ${denRoots.map((r) => `$${numTex(r)}$`).join(", ")}` : ""}.`,
    });
  } else {
    critical = findRealRoots(F, -100, 100, 40000);
    // detect discontinuities (sign changes where |f| is large)
    const samples = 4000;
    for (let i = 0; i < samples; i++) {
      const x0 = -100 + (200 * i) / samples;
      const x1 = x0 + 200 / samples;
      const a = F(x0);
      const b = F(x1);
      if (Number.isFinite(a) !== Number.isFinite(b)) poles.push(Number.isFinite(a) ? x1 : x0);
    }
    steps.push({ title: "Find the critical points", text: `Solve $${toTex(f)} = 0$: ${critical.length ? critical.map((r) => `$${numTex(r)}$`).join(", ") : "no real zeros"}.` });
  }
  const points = [...new Set([...critical, ...poles].map((x) => +x.toFixed(12)))].sort((a, b) => a - b);
  const bounds = [-Infinity, ...points, Infinity];
  const intervals: Interval[] = [];
  const rows: string[] = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    const lo = bounds[i];
    const hi = bounds[i + 1];
    const test = lo === -Infinity ? (hi === Infinity ? 0 : hi - 1) : hi === Infinity ? lo + 1 : (lo + hi) / 2;
    const val = F(test);
    const ok = Number.isFinite(val) && holds(val, op);
    rows.push(`${intervalTex({ lo, hi, loClosed: false, hiClosed: false })} & ${numTex(test)} & ${Number.isFinite(val) ? (val > 0 ? "+" : val < 0 ? "-" : "0") : "\\text{undef}"} & ${ok ? "\\checkmark" : "\\times"}`);
    if (ok) intervals.push({ lo, hi, loClosed: false, hiClosed: false });
  }
  steps.push({
    title: "Build a sign chart",
    latex: `\\begin{array}{c|c|c|c} \\text{Interval} & \\text{Test } ${v} & \\text{Sign} & \\text{Satisfies?} \\\\ \\hline ${rows.join(" \\\\ ")} \\end{array}`,
    text: "Pick a test value in each interval; the sign of the expression is constant between critical points.",
  });
  // endpoints for non-strict inequalities
  if (op === "<=" || op === ">=") {
    for (const c of critical) {
      if (poles.some((p) => Math.abs(p - c) < 1e-12)) continue;
      const left = intervals.find((iv) => iv.hi === c);
      const right = intervals.find((iv) => iv.lo === c);
      if (left) left.hiClosed = true;
      if (right) right.loClosed = true;
      if (!left && !right) intervals.push({ lo: c, hi: c, loClosed: true, hiClosed: true });
    }
    intervals.sort((a, b) => a.lo - b.lo);
    if (critical.length) steps.push({ title: "Include the endpoints", text: "Because the inequality is non-strict, zeros of the expression are included (but never zeros of a denominator)." });
  }
  const merged = merge(intervals);
  const answerTex = merged.length ? merged.map(intervalTex).join(" \\cup ") : "\\varnothing";
  const answerText = merged.length ? merged.map(intervalText).join(" ∪ ") : "No solution";
  steps.push({ title: "Write the solution set", latex: `${v} \\in ${answerTex}` });

  const checks: VerificationCheck[] = [];
  for (const iv of merged.slice(0, 4)) {
    const t = iv.lo === -Infinity ? (iv.hi === Infinity ? 0.5 : iv.hi - 0.5) : iv.hi === Infinity ? iv.lo + 0.5 : (iv.lo + iv.hi) / 2;
    checks.push({ label: `Test ${v} = ${numText(t)} (inside)`, passed: holds(F(t), op) });
  }
  return {
    interpreted: ineqTex,
    category: "inequality",
    topic: rp ? (rp.den.length > 1 ? "Rational inequality" : "Polynomial inequality") : "Inequality",
    answer: { latex: `${v} \\in ${answerTex}`, text: answerText },
    steps,
    formulas: [{ name: "Sign analysis", latex: "f \\text{ keeps its sign between consecutive critical points}" }],
    explanation: "Move everything to one side, find where the expression is zero or undefined, then test one value in each interval to see where the inequality holds.",
    verification: verificationFrom(checks),
    graph: { expressions: [toStr(f as MathNode)] },
  };
}
