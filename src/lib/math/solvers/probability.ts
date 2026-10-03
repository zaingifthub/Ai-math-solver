import { numTex, numText, roundSig } from "../format";
import type { SolverOutput, Step } from "../types";
import { verificationFrom, MathInputError } from "../types";

export function factorial(n: number): number {
  if (!Number.isInteger(n) || n < 0) throw new MathInputError("Factorial is defined for non-negative integers.");
  if (n > 170) return Infinity;
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}
export function nCr(n: number, r: number): number {
  if (r < 0 || r > n) return 0;
  r = Math.min(r, n - r);
  let res = 1;
  for (let i = 1; i <= r; i++) res = (res * (n - r + i)) / i;
  return Math.round(res);
}
export function nPr(n: number, r: number): number {
  if (r < 0 || r > n) return 0;
  let res = 1;
  for (let i = 0; i < r; i++) res *= n - i;
  return res;
}

export type ProbabilityRequest =
  | { kind: "combination"; n: number; r: number }
  | { kind: "permutation"; n: number; r: number }
  | { kind: "factorial"; n: number }
  | { kind: "binomial"; n: number; p: number; k: number; mode?: "exact" | "atMost" | "atLeast" };

export function solveProbability(req: ProbabilityRequest): SolverOutput {
  const steps: Step[] = [];
  const base = { category: "probability" as const };
  if (req.kind === "factorial") {
    const v = factorial(req.n);
    steps.push({ title: "Multiply the integers from n down to 1", latex: `${req.n}! = ${req.n <= 12 ? Array.from({ length: req.n }, (_, i) => req.n - i).join(" \\times ") || "1" : `${req.n} \\times ${req.n - 1} \\times \\cdots \\times 1`} = ${v.toLocaleString("en-US")}` });
    return { ...base, interpreted: `${req.n}!`, topic: "Factorial", answer: { latex: numTex(v), text: v.toLocaleString("en-US") }, steps, formulas: [{ name: "Factorial", latex: "n! = n(n-1)(n-2)\\cdots 1,\; 0! = 1" }], explanation: "A factorial counts the number of ways to arrange n distinct objects.", verification: verificationFrom([{ label: `${req.n}! = ${req.n} × ${req.n - 1}!`, passed: req.n === 0 || Math.abs(v - req.n * factorial(req.n - 1)) <= 1e-9 * v }]) };
  }
  if (req.kind === "combination" || req.kind === "permutation") {
    const { n, r } = req;
    if (!Number.isInteger(n) || !Number.isInteger(r) || n < 0 || r < 0) throw new MathInputError("n and r must be non-negative integers.");
    if (r > n) throw new MathInputError("r cannot be larger than n.");
    const isC = req.kind === "combination";
    const val = isC ? nCr(n, r) : nPr(n, r);
    steps.push({ title: "Use the formula", latex: isC ? `\\binom{${n}}{${r}} = \\frac{${n}!}{${r}!\\,(${n}-${r})!}` : `P(${n}, ${r}) = \\frac{${n}!}{(${n}-${r})!}` });
    steps.push({ title: "Cancel and compute", latex: isC ? `\\frac{${Array.from({ length: Math.min(r, 8) }, (_, i) => n - i).join(" \\cdot ")}${r > 8 ? "\\cdots" : ""}}{${r}!} = ${val.toLocaleString("en-US")}` : `${Array.from({ length: Math.min(r, 8) }, (_, i) => n - i).join(" \\cdot ")}${r > 8 ? "\\cdots" : ""} = ${val.toLocaleString("en-US")}` });
    return {
      ...base,
      interpreted: isC ? `\\binom{${n}}{${r}}` : `P(${n},${r})`,
      topic: isC ? "Combinations" : "Permutations",
      answer: { latex: numTex(val), text: val.toLocaleString("en-US") },
      steps,
      formulas: [isC ? { name: "Combinations", latex: "\\binom{n}{r} = \\frac{n!}{r!(n-r)!}" } : { name: "Permutations", latex: "P(n,r) = \\frac{n!}{(n-r)!}" }],
      explanation: isC ? "Combinations count selections where order does not matter." : "Permutations count arrangements where order matters.",
      verification: verificationFrom([{ label: isC ? "Symmetry C(n,r) = C(n,n−r)" : "P(n,r) = C(n,r)·r!", passed: isC ? nCr(n, r) === nCr(n, n - r) : Math.abs(nPr(n, r) - nCr(n, r) * factorial(r)) <= 1e-9 * val }]),
    };
  }
  const { n, p, k } = req;
  if (!Number.isInteger(n) || n < 0 || n > 1000 || !Number.isInteger(k) || k < 0 || k > n) throw new MathInputError("Binomial requires integers 0 ≤ k ≤ n ≤ 1000.");
  if (!(p >= 0 && p <= 1)) throw new MathInputError("Probability p must be between 0 and 1.");
  const pmf = (i: number) => nCr(n, i) * p ** i * (1 - p) ** (n - i);
  const mode = req.mode ?? "exact";
  let val: number;
  steps.push({ title: "Binomial setting", text: `$n = ${n}$ independent trials, success probability $p = ${numText(p)}$.` });
  if (mode === "exact") {
    val = pmf(k);
    steps.push({ title: "Apply the binomial formula", latex: `P(X = ${k}) = \\binom{${n}}{${k}}(${numText(p)})^{${k}}(${numText(1 - p)})^{${n - k}} = ${nCr(n, k)} \\cdot ${roundSig(p ** k, 6)} \\cdot ${roundSig((1 - p) ** (n - k), 6)} = ${roundSig(val, 8)}` });
  } else {
    const range = mode === "atMost" ? Array.from({ length: k + 1 }, (_, i) => i) : Array.from({ length: n - k + 1 }, (_, i) => k + i);
    val = range.reduce((s, i) => s + pmf(i), 0);
    steps.push({ title: `Sum the probabilities for X ${mode === "atMost" ? "≤" : "≥"} ${k}`, latex: `P(X ${mode === "atMost" ? "\\le" : "\\ge"} ${k}) = \\sum ${mode === "atMost" ? `_{i=0}^{${k}}` : `_{i=${k}}^{${n}}`} \\binom{${n}}{i} p^i (1-p)^{${n}-i} = ${roundSig(val, 8)}` });
  }
  const total = Array.from({ length: n + 1 }, (_, i) => pmf(i)).reduce((a, b) => a + b, 0);
  return {
    ...base,
    interpreted: `X \\sim B(${n}, ${numText(p)})`,
    topic: "Binomial probability",
    answer: { latex: roundSig(val, 8), text: roundSig(val, 8), decimal: `${roundSig(val * 100, 6)}%` },
    steps,
    formulas: [{ name: "Binomial probability", latex: "P(X = k) = \\binom{n}{k} p^k (1-p)^{n-k}" }, { name: "Mean and variance", latex: "\\mu = np,\; \\sigma^2 = np(1-p)" }],
    explanation: `For ${n} independent trials with success probability ${numText(p)}, the binomial formula counts the ways to get the successes and multiplies by their probability. Mean $np = ${roundSig(n * p)}$.`,
    verification: verificationFrom([{ label: "All binomial probabilities sum to 1", passed: Math.abs(total - 1) < 1e-9 }, { label: "Result between 0 and 1", passed: val >= 0 && val <= 1 + 1e-12 }]),
  };
}
