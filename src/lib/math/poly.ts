import { math, evalReal, variablesOf, type MathNode } from "./mathjs";

/** Ascending-order coefficient arithmetic. */
const add = (a: number[], b: number[]) => Array.from({ length: Math.max(a.length, b.length) }, (_, i) => (a[i] ?? 0) + (b[i] ?? 0));
const scale = (a: number[], k: number) => a.map((x) => x * k);
const mul = (a: number[], b: number[]) => {
  const out = new Array(a.length + b.length - 1).fill(0);
  a.forEach((x, i) => b.forEach((y, j) => (out[i + j] += x * y)));
  return out;
};
const trim = (a: number[]) => {
  const out = [...a];
  while (out.length > 1 && Math.abs(out[out.length - 1]) < 1e-12) out.pop();
  return out;
};

function asc(node: MathNode, v: string): number[] | null {
  switch (node.type) {
    case "ConstantNode": {
      const val = Number((node as unknown as { value: unknown }).value);
      return Number.isFinite(val) ? [val] : null;
    }
    case "SymbolNode": {
      const name = (node as unknown as { name: string }).name;
      if (name === v) return [0, 1];
      if (name === "pi") return [Math.PI];
      if (name === "e") return [Math.E];
      return null;
    }
    case "ParenthesisNode":
      return asc((node as unknown as { content: MathNode }).content, v);
    case "FunctionNode": {
      if (variablesOf(node).length) return null;
      const val = evalReal(node);
      return Number.isFinite(val) ? [val] : null;
    }
    case "OperatorNode": {
      const op = node as unknown as { op: string; args: MathNode[]; fn: string };
      const args = op.args;
      if (args.length === 1) {
        const a = asc(args[0], v);
        if (!a) return null;
        return op.op === "-" ? scale(a, -1) : op.op === "+" ? a : null;
      }
      const [l, r] = args;
      if (op.op === "+" || op.op === "-") {
        const a = asc(l, v);
        const b = asc(r, v);
        if (!a || !b) return null;
        return add(a, op.op === "-" ? scale(b, -1) : b);
      }
      if (op.op === "*") {
        const a = asc(l, v);
        const b = asc(r, v);
        if (!a || !b) return null;
        return mul(a, b);
      }
      if (op.op === "/") {
        const a = asc(l, v);
        const b = asc(r, v);
        if (!a || !b) return null;
        const bt = trim(b);
        if (bt.length !== 1 || bt[0] === 0) return null;
        return scale(a, 1 / bt[0]);
      }
      if (op.op === "^") {
        const base = asc(l, v);
        if (!base) return null;
        if (variablesOf(r).length) return null;
        const p = evalReal(r);
        if (!Number.isInteger(p) || p < 0 || p > 30) {
          const bt = trim(base);
          if (bt.length === 1 && Number.isFinite(p)) return [Math.pow(bt[0], p)];
          return null;
        }
        let out = [1];
        for (let i = 0; i < p; i++) out = mul(out, base);
        return out;
      }
      return null;
    }
    default:
      return null;
  }
}

/** Polynomial coefficients in `v`, highest degree first, or null if not a polynomial. */
export function polyCoeffs(node: MathNode | string, v: string): number[] | null {
  const n = typeof node === "string" ? math.parse(node) : node;
  const a = asc(n, v);
  if (!a) return null;
  return trim(a.map((x) => (Math.abs(x) < 1e-13 ? 0 : x))).reverse();
}

export function polyDegree(coeffs: number[]): number {
  return coeffs.length - 1;
}

export function evalPoly(coeffs: number[], x: number): number {
  return coeffs.reduce((acc, c) => acc * x + c, 0);
}

/** Split an expression into numerator/denominator polynomials when it is a rational function. */
export function rationalParts(node: MathNode, v: string): { num: number[]; den: number[] } | null {
  try {
    const r = math.rationalize(node, {}, true) as unknown as { numerator: MathNode; denominator: MathNode | null };
    const num = polyCoeffs(r.numerator, v);
    const den = r.denominator ? polyCoeffs(r.denominator, v) : [1];
    if (!num || !den) return null;
    return { num, den };
  } catch {
    return null;
  }
}

/** Synthetic division by (x - r). Returns quotient (highest first) and remainder. */
export function syntheticDivide(coeffs: number[], r: number): { quotient: number[]; remainder: number; row: number[] } {
  const out: number[] = [];
  const row: number[] = [];
  let acc = 0;
  for (const c of coeffs) {
    row.push(acc * r);
    acc = acc * r + c;
    out.push(acc);
  }
  const remainder = out.pop() ?? 0;
  return { quotient: out, remainder, row: row.slice(1) };
}

/** Candidate rational roots ±p/q for integer coefficients (Rational Root Theorem). */
export function rationalRootCandidates(intCoeffs: number[]): number[] {
  const lead = Math.abs(intCoeffs[0]);
  let constIdx = intCoeffs.length - 1;
  while (constIdx > 0 && intCoeffs[constIdx] === 0) constIdx--;
  const c = Math.abs(intCoeffs[constIdx]);
  const divisors = (n: number) => {
    const d: number[] = [];
    for (let i = 1; i <= Math.min(n, 100000); i++) if (n % i === 0) d.push(i);
    return d;
  };
  const ps = divisors(c || 1);
  const qs = divisors(lead || 1);
  const set = new Set<number>();
  for (const p of ps) for (const q of qs) {
    set.add(p / q);
    set.add(-p / q);
  }
  return [...set].sort((a, b) => Math.abs(a) - Math.abs(b) || a - b);
}

/** Scale rational coefficients to coprime integers when possible. */
export function toIntegerCoeffs(coeffs: number[]): number[] | null {
  let mult = 1;
  for (const c of coeffs) {
    let found = false;
    for (let d = 1; d <= 1000; d++) {
      if (Math.abs(c * mult * d - Math.round(c * mult * d)) < 1e-9) {
        mult *= d;
        found = true;
        break;
      }
    }
    if (!found) return null;
  }
  const ints = coeffs.map((c) => Math.round(c * mult));
  let g = 0;
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
  for (const x of ints) g = gcd(g, x);
  g = g || 1;
  const sign = ints[0] < 0 ? -1 : 1;
  return ints.map((x) => (x / g) * sign);
}
