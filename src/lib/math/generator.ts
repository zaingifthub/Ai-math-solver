/**
 * Practice problem generator. Problems are constructed backwards from a chosen
 * answer, so the correct answer is known exactly; the engine can still be used
 * to produce full worked solutions.
 */
import { numTex, numText, polyTex, polyStr, fracTex, gcd } from "./format";

export type AnswerKind = "number" | "set" | "expression" | "antiderivative" | "pair";

export interface PracticeAnswer {
  kind: AnswerKind;
  display: string; // LaTeX
  values?: number[];
  expr?: string;
  variable?: string;
}

export interface PracticeProblem {
  id: string;
  topic: string;
  difficulty: 1 | 2 | 3;
  instruction: string;
  prompt: string; // LaTeX
  solveInput: string; // engine input for the worked solution
  answer: PracticeAnswer;
  hint: string;
}

export const PRACTICE_TOPICS = [
  { id: "arithmetic", label: "Order of operations", group: "Foundations" },
  { id: "fractions", label: "Fractions", group: "Foundations" },
  { id: "percentages", label: "Percentages", group: "Foundations" },
  { id: "linear-equations", label: "Linear equations", group: "Algebra" },
  { id: "quadratic-equations", label: "Quadratic equations", group: "Algebra" },
  { id: "systems", label: "Systems of equations", group: "Algebra" },
  { id: "inequalities", label: "Inequalities", group: "Algebra" },
  { id: "exponents", label: "Exponents", group: "Algebra" },
  { id: "logarithms", label: "Logarithms", group: "Algebra" },
  { id: "factoring", label: "Factoring", group: "Algebra" },
  { id: "trigonometry", label: "Trigonometry", group: "Trigonometry" },
  { id: "derivatives", label: "Derivatives", group: "Calculus" },
  { id: "integrals", label: "Integrals", group: "Calculus" },
  { id: "limits", label: "Limits", group: "Calculus" },
  { id: "statistics", label: "Statistics", group: "Statistics" },
  { id: "probability", label: "Probability", group: "Statistics" },
  { id: "geometry", label: "Geometry", group: "Geometry" },
  { id: "matrices", label: "Matrices", group: "Linear algebra" },
] as const;

export type PracticeTopic = (typeof PRACTICE_TOPICS)[number]["id"];

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type R = () => number;
const int = (r: R, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
const nz = (r: R, lo: number, hi: number) => {
  let x = 0;
  while (x === 0) x = int(r, lo, hi);
  return x;
};
const pick = <T,>(r: R, arr: readonly T[]): T => arr[Math.floor(r() * arr.length)];
const signed = (x: number) => (x < 0 ? `- ${Math.abs(x)}` : `+ ${x}`);

type Gen = (r: R, d: 1 | 2 | 3) => Omit<PracticeProblem, "id" | "topic" | "difficulty">;

const GENERATORS: Record<PracticeTopic, Gen> = {
  arithmetic: (r, d) => {
    const a = int(r, 2, 9 * d), b = int(r, 2, 9), c = int(r, 2, 6 + 3 * d), e = int(r, 1, 5);
    const expr = d === 1 ? `${a} + ${b} * ${c}` : d === 2 ? `(${a} + ${b}) * ${c} - ${e}^2` : `${a} - ${b} * (${c} - ${e})^2 / ${e}`;
    const val = Function(`return ${expr.replace(/\^/g, "**")}`)() as number;
    return { instruction: "Evaluate.", prompt: expr.replace(/\*/g, "\\times "), solveInput: expr, answer: { kind: "number", display: numTex(val), values: [val] }, hint: "Parentheses first, then exponents, then × and ÷, then + and −." };
  },
  fractions: (r, d) => {
    const b = int(r, 2, 6 + 2 * d), dd = int(r, 2, 6 + 2 * d), a = int(r, 1, b - 1), c = int(r, 1, dd - 1);
    const op = pick(r, d === 1 ? ["+", "-"] : ["+", "-", "*", "/"]);
    const num = op === "+" ? a * dd + c * b : op === "-" ? a * dd - c * b : op === "*" ? a * c : a * dd;
    const den = op === "+" || op === "-" ? b * dd : op === "*" ? b * dd : b * c;
    const g = gcd(num, den) || 1;
    return { instruction: "Compute and simplify.", prompt: `\\frac{${a}}{${b}} ${op === "*" ? "\\times" : op === "/" ? "\\div" : op} \\frac{${c}}{${dd}}`, solveInput: `${a}/${b} ${op} ${c}/${dd}`, answer: { kind: "number", display: fracTex(num / g, den / g), values: [num / den] }, hint: op === "+" || op === "-" ? "Use a common denominator." : op === "/" ? "Multiply by the reciprocal." : "Multiply numerators and denominators." };
  },
  percentages: (r, d) => {
    const p = pick(r, d === 1 ? [10, 20, 25, 50] : [5, 12, 15, 30, 35, 40, 75]);
    const base = int(r, 2, 20) * (d === 3 ? 7 : 10);
    const val = (p / 100) * base;
    return { instruction: "Compute.", prompt: `${p}\\% \\text{ of } ${base}`, solveInput: `${p}% of ${base}`, answer: { kind: "number", display: numTex(val), values: [val] }, hint: `Convert ${p}% to a decimal (${p / 100}) and multiply.` };
  },
  "linear-equations": (r, d) => {
    const x = int(r, -10, 10), a = nz(r, -9, 9), b = int(r, -15, 15);
    if (d === 1) return { instruction: "Solve for x.", prompt: `${a === 1 ? "" : a === -1 ? "-" : a}x ${signed(b)} = ${a * x + b}`, solveInput: `${a}x + ${b} = ${a * x + b}`, answer: { kind: "set", display: `x = ${x}`, values: [x], variable: "x" }, hint: "Undo the addition first, then divide by the coefficient." };
    const c = nz(r, -6, 6) || 2;
    const cc = c === a ? c + 1 : c;
    const e = (a - cc) * x + b;
    const k = d === 3 ? int(r, 2, 4) : 1;
    return { instruction: "Solve for x.", prompt: `${k === 1 ? "" : `${k}(`}${a}x ${signed(b)}${k === 1 ? "" : ")"} = ${k * cc}x ${signed(k * e)}`.replace(/= 1x/, "= x"), solveInput: `${k}*(${a}x + ${b}) = ${k * cc}x + ${k * e}`, answer: { kind: "set", display: `x = ${x}`, values: [x], variable: "x" }, hint: "Distribute, collect x-terms on one side, constants on the other." };
  },
  "quadratic-equations": (r, d) => {
    const p = int(r, -9, 9), q = int(r, -9, 9), a = d === 3 ? nz(r, 2, 3) : 1;
    const coeffs = [a, -a * (p + q), a * p * q];
    const roots = [...new Set([p, q])].sort((x, y) => x - y);
    return { instruction: "Solve for x.", prompt: `${polyTex(coeffs)} = 0`, solveInput: `${polyStr(coeffs)} = 0`, answer: { kind: "set", display: roots.map((x) => `x = ${x}`).join(",\; "), values: roots, variable: "x" }, hint: "Try factoring: find two numbers whose product is c/a and sum is −b/a." };
  },
  systems: (r, d) => {
    const x = int(r, -6, 6), y = int(r, -6, 6);
    let a = nz(r, -5, 5), b = nz(r, -5, 5), c = nz(r, -5, 5), e = nz(r, -5, 5);
    if (a * e - b * c === 0) { a += 1; e += d; }
    if (a * e - b * c === 0) { b += 2; }
    const term = (k: number, v: string, first: boolean) => `${first ? (k < 0 ? "-" : "") : k < 0 ? " - " : " + "}${Math.abs(k) === 1 ? "" : Math.abs(k)}${v}`;
    const e1 = `${term(a, "x", true)}${term(b, "y", false)} = ${a * x + b * y}`;
    const e2 = `${term(c, "x", true)}${term(e, "y", false)} = ${c * x + e * y}`;
    return { instruction: "Solve the system.", prompt: `\\begin{cases} ${e1} \\\\ ${e2} \\end{cases}`, solveInput: `${e1}; ${e2}`, answer: { kind: "pair", display: `x = ${x},\; y = ${y}`, values: [x, y] }, hint: "Use elimination: scale one equation so a variable cancels when you add them." };
  },
  inequalities: (r) => {
    const a = nz(r, -6, 6), x = int(r, -8, 8), b = int(r, -10, 10);
    const op = pick(r, ["<", ">", "<=", ">="] as const);
    const flipped = a < 0 ? ({ "<": ">", ">": "<", "<=": ">=", ">=": "<=" } as const)[op] : op;
    const tex = { "<": "<", ">": ">", "<=": "\\le", ">=": "\\ge" };
    return { instruction: "Solve the inequality. Answer like x > 3.", prompt: `${a}x ${signed(b)} ${tex[op]} ${a * x + b}`, solveInput: `${a}x + ${b} ${op} ${a * x + b}`, answer: { kind: "expression", display: `x ${tex[flipped]} ${x}`, expr: `x ${flipped} ${x}` }, hint: a < 0 ? "Dividing by a negative number flips the inequality sign." : "Isolate x with inverse operations." };
  },
  exponents: (r, d) => {
    const base = int(r, 2, 5), m = int(r, 1, 4), n = int(r, 1, 3 + d);
    const val = base ** (m + n) / base ** (d === 3 ? n : 0);
    const prompt = d === 3 ? `\\frac{${base}^{${m}} \\cdot ${base}^{${n}}}{${base}^{${n}}}` : `${base}^{${m}} \\cdot ${base}^{${n}}`;
    return { instruction: "Evaluate.", prompt, solveInput: d === 3 ? `${base}^${m} * ${base}^${n} / ${base}^${n}` : `${base}^${m} * ${base}^${n}`, answer: { kind: "number", display: numTex(val), values: [val] }, hint: "When multiplying powers with the same base, add the exponents." };
  },
  logarithms: (r, d) => {
    const b = int(r, 2, 5), k = int(r, d === 1 ? 1 : -2, 4);
    const arg = b ** k;
    if (d === 3) {
      const x = int(r, 2, 4);
      return { instruction: "Solve for x.", prompt: `\\log_{${b}}(x) = ${x}`, solveInput: `log_${b}(x) = ${x}`, answer: { kind: "set", display: `x = ${b ** x}`, values: [b ** x], variable: "x" }, hint: "Rewrite in exponential form: log_b(x) = c means x = b^c." };
    }
    return { instruction: "Evaluate.", prompt: `\\log_{${b}}\\left(${numTex(arg)}\\right)`, solveInput: `log_${b}(${numText(arg)})`, answer: { kind: "number", display: String(k), values: [k] }, hint: `Ask: ${b} to what power gives ${numText(arg)}?` };
  },
  factoring: (r) => {
    const p = nz(r, -9, 9), q = nz(r, -9, 9);
    const coeffs = [1, -(p + q), p * q];
    return { instruction: "Factor completely.", prompt: polyTex(coeffs), solveInput: `factor ${polyStr(coeffs)}`, answer: { kind: "expression", display: `(x ${p > 0 ? "-" : "+"} ${Math.abs(p)})(x ${q > 0 ? "-" : "+"} ${Math.abs(q)})`, expr: `(x - (${p}))*(x - (${q}))`, variable: "x" }, hint: `Find two numbers that multiply to ${p * q} and add to ${-(p + q)}.` };
  },
  trigonometry: (r, d) => {
    const angles = [[0, "0"], [30, "\\frac{\\pi}{6}"], [45, "\\frac{\\pi}{4}"], [60, "\\frac{\\pi}{3}"], [90, "\\frac{\\pi}{2}"], [120, "\\frac{2\\pi}{3}"], [135, "\\frac{3\\pi}{4}"], [150, "\\frac{5\\pi}{6}"], [180, "\\pi"]] as const;
    const [deg, rad] = pick(r, d === 1 ? angles.slice(0, 5) : angles);
    const fn = pick(r, d === 1 ? ["sin", "cos"] : ["sin", "cos", "tan"] as const);
    if (fn === "tan" && deg === 90) return GENERATORS.trigonometry(r, d);
    const val = Math[fn as "sin"]((deg * Math.PI) / 180);
    const v = Math.abs(val) < 1e-12 ? 0 : val;
    return { instruction: "Find the exact value.", prompt: `\\${fn}\\left(${d === 1 ? `${deg}^\\circ` : rad}\\right)`, solveInput: `${fn}(${d === 1 ? `${deg} deg` : `${deg}*pi/180`})`, answer: { kind: "number", display: numTex(v), values: [v] }, hint: "Use the unit circle and the reference angle." };
  },
  derivatives: (r, d) => {
    const a = nz(r, -5, 6), n = int(r, 2, 5), b = int(r, -6, 6), k = int(r, 2, 4);
    if (d === 1) return { instruction: "Differentiate with respect to x.", prompt: `\\frac{d}{dx}\\left[${a}x^{${n}} ${signed(b)}x\\right]`, solveInput: `derivative of ${a}x^${n} + ${b}x`, answer: { kind: "expression", display: `${a * n}x^{${n - 1}} ${signed(b)}`, expr: `${a * n}*x^${n - 1} + ${b}`, variable: "x" }, hint: "Power rule: bring the exponent down and subtract one." };
    if (d === 2) return { instruction: "Differentiate with respect to x.", prompt: `\\frac{d}{dx}\\left[\\sin(${k}x)\\right]`, solveInput: `derivative of sin(${k}x)`, answer: { kind: "expression", display: `${k}\\cos(${k}x)`, expr: `${k}*cos(${k}*x)`, variable: "x" }, hint: "Chain rule: derivative of the outside times derivative of the inside." };
    return { instruction: "Differentiate with respect to x.", prompt: `\\frac{d}{dx}\\left[x^{${n}} e^{${k}x}\\right]`, solveInput: `derivative of x^${n}*e^(${k}x)`, answer: { kind: "expression", display: `${n}x^{${n - 1}}e^{${k}x} + ${k}x^{${n}}e^{${k}x}`, expr: `${n}*x^${n - 1}*e^(${k}*x) + ${k}*x^${n}*e^(${k}*x)`, variable: "x" }, hint: "Product rule: f′g + fg′." };
  },
  integrals: (r, d) => {
    const n = int(r, 1, 4), a = int(r, 1, 4) * (n + 1), k = int(r, 2, 4);
    if (d === 3) {
      const lo = int(r, 0, 1), hi = lo + int(r, 1, 3);
      const val = (a / (n + 1)) * (hi ** (n + 1) - lo ** (n + 1));
      return { instruction: "Evaluate the definite integral.", prompt: `\\int_{${lo}}^{${hi}} ${a}x^{${n}}\\,dx`, solveInput: `integrate ${a}x^${n} dx from ${lo} to ${hi}`, answer: { kind: "number", display: numTex(val), values: [val] }, hint: "Find the antiderivative, then compute F(b) − F(a)." };
    }
    if (d === 2) return { instruction: "Find the antiderivative.", prompt: `\\int \\cos(${k}x)\\,dx`, solveInput: `integrate cos(${k}x) dx`, answer: { kind: "antiderivative", display: `\\frac{1}{${k}}\\sin(${k}x) + C`, expr: `sin(${k}*x)/${k}`, variable: "x" }, hint: "Reverse chain rule: divide by the inner coefficient." };
    return { instruction: "Find the antiderivative.", prompt: `\\int ${a}x^{${n}}\\,dx`, solveInput: `integrate ${a}x^${n} dx`, answer: { kind: "antiderivative", display: `${numTex(a / (n + 1))}x^{${n + 1}} + C`, expr: `${a / (n + 1)}*x^${n + 1}`, variable: "x" }, hint: "Power rule for integrals: add one to the exponent and divide by it." };
  },
  limits: (r, d) => {
    const p = nz(r, -6, 6), q = int(r, -5, 5);
    if (d === 1) { const c = int(r, -4, 4); return { instruction: "Evaluate the limit.", prompt: `\\lim_{x \\to ${c}} (x^2 ${signed(q)}x)`, solveInput: `limit of x^2 + ${q}x as x -> ${c}`, answer: { kind: "number", display: numTex(c * c + q * c), values: [c * c + q * c] }, hint: "Polynomials are continuous: substitute directly." }; }
    if (d === 2) return { instruction: "Evaluate the limit.", prompt: `\\lim_{x \\to ${p}} \\frac{x^2 - ${p * p}}{x ${p > 0 ? "-" : "+"} ${Math.abs(p)}}`, solveInput: `limit of (x^2 - ${p * p})/(x - (${p})) as x -> ${p}`, answer: { kind: "number", display: numTex(2 * p), values: [2 * p] }, hint: "Factor the difference of squares and cancel." };
    const k = int(r, 2, 6);
    return { instruction: "Evaluate the limit.", prompt: `\\lim_{x \\to 0} \\frac{\\sin(${k}x)}{x}`, solveInput: `limit of sin(${k}x)/x as x -> 0`, answer: { kind: "number", display: String(k), values: [k] }, hint: "Use sin(u)/u → 1 as u → 0." };
  },
  statistics: (r, d) => {
    const n = 4 + d * 2;
    const data = Array.from({ length: n }, () => int(r, 1, 20));
    const kind = pick(r, d === 1 ? ["mean", "median"] : ["mean", "median", "range"] as const);
    const sorted = [...data].sort((a, b) => a - b);
    const val = kind === "mean" ? data.reduce((s, x) => s + x, 0) / n : kind === "median" ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[n - 1] - sorted[0];
    return { instruction: `Find the ${kind}.`, prompt: `\\{${data.join(", ")}\\}`, solveInput: `${kind} of ${data.join(", ")}`, answer: { kind: "number", display: numTex(val), values: [val] }, hint: kind === "median" ? "Sort the data; with an even count, average the two middle values." : kind === "mean" ? "Add all values and divide by how many there are." : "Largest minus smallest." };
  },
  probability: (r, d) => {
    const n = int(r, 4, 6 + 2 * d), k = int(r, 2, Math.min(4, n - 1));
    let c = 1;
    for (let i = 1; i <= k; i++) c = (c * (n - k + i)) / i;
    if (d === 3) {
      let p = 1; for (let i = 0; i < k; i++) p *= n - i;
      return { instruction: "How many ordered arrangements (permutations)?", prompt: `P(${n}, ${k})`, solveInput: `P(${n},${k})`, answer: { kind: "number", display: String(p), values: [p] }, hint: "P(n, r) = n!/(n − r)!" };
    }
    return { instruction: `In how many ways can you choose ${k} items from ${n}?`, prompt: `\\binom{${n}}{${k}}`, solveInput: `${n} choose ${k}`, answer: { kind: "number", display: String(Math.round(c)), values: [Math.round(c)] }, hint: "C(n, r) = n!/(r!(n − r)!)" };
  },
  geometry: (r, d) => {
    if (d === 1) { const l = int(r, 2, 15), w = int(r, 2, 15); return { instruction: "Find the area.", prompt: `\\text{Rectangle } ${l} \\times ${w}`, solveInput: `area of rectangle length ${l} width ${w}`, answer: { kind: "number", display: String(l * w), values: [l * w] }, hint: "Area = length × width." }; }
    if (d === 2) { const [a, b, c] = pick(r, [[3, 4, 5], [5, 12, 13], [8, 15, 17], [6, 8, 10], [7, 24, 25]]); return { instruction: "Find the hypotenuse.", prompt: `a = ${a},\; b = ${b}`, solveInput: `hypotenuse ${a} and ${b}`, answer: { kind: "number", display: String(c), values: [c] }, hint: "c² = a² + b²" }; }
    const rr = int(r, 2, 9);
    return { instruction: "Find the area of the circle (exact, in terms of π, or as a decimal).", prompt: `r = ${rr}`, solveInput: `area of circle radius ${rr}`, answer: { kind: "number", display: `${rr * rr}\\pi`, values: [Math.PI * rr * rr] }, hint: "A = πr²" };
  },
  matrices: (r, d) => {
    const m = Array.from({ length: d === 3 ? 3 : 2 }, () => Array.from({ length: d === 3 ? 3 : 2 }, () => int(r, -5, 6)));
    const det = m.length === 2 ? m[0][0] * m[1][1] - m[0][1] * m[1][0] : m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
    return { instruction: "Find the determinant.", prompt: `\\det\\begin{bmatrix} ${m.map((row) => row.join(" & ")).join(" \\\\ ")} \\end{bmatrix}`, solveInput: `det ${JSON.stringify(m)}`, answer: { kind: "number", display: String(det), values: [det] }, hint: m.length === 2 ? "ad − bc" : "Expand along the first row using cofactors." };
  },
};

export function generateProblem(topic: PracticeTopic, difficulty: 1 | 2 | 3 = 1, seed = Math.floor(Math.random() * 2 ** 31)): PracticeProblem {
  const gen = GENERATORS[topic];
  if (!gen) throw new Error(`Unknown topic: ${topic}`);
  const p = gen(rng(seed), difficulty);
  return { id: `${topic}-${difficulty}-${seed}`, topic, difficulty, ...p };
}

/** Recreate a problem from its id (stateless verification of answers). */
export function problemFromId(id: string): PracticeProblem | null {
  const m = /^([a-z-]+)-([123])-(\d+)$/.exec(id);
  if (!m || !(m[1] in GENERATORS)) return null;
  return generateProblem(m[1] as PracticeTopic, Number(m[2]) as 1 | 2 | 3, Number(m[3]));
}

/** Map an engine category/topic to the closest practice topic (for "similar problem"). */
export function practiceTopicFor(category: string, topic: string): PracticeTopic | null {
  const t = topic.toLowerCase();
  if (t.includes("quadratic")) return "quadratic-equations";
  if (t.includes("linear equation")) return "linear-equations";
  if (t.includes("system")) return "systems";
  if (t.includes("factor")) return "factoring";
  const map: Record<string, PracticeTopic> = {
    arithmetic: "arithmetic", inequality: "inequalities", exponent: "exponents", logarithm: "logarithms", trigonometry: "trigonometry",
    derivative: "derivatives", integral: "integrals", limit: "limits", statistics: "statistics", probability: "probability",
    geometry: "geometry", matrix: "matrices", polynomial: "quadratic-equations", equation: "linear-equations", system: "systems",
  };
  return map[category] ?? null;
}
