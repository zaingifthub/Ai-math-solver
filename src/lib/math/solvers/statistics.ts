import { numTex, numText, roundSig } from "../format";
import type { SolverOutput, Step, VerificationCheck } from "../types";
import { verificationFrom, MathInputError } from "../types";

export type StatMeasure = "summary" | "mean" | "median" | "mode" | "range" | "variance" | "std" | "quartiles";

export function describe(data: number[]) {
  const n = data.length;
  const sorted = [...data].sort((a, b) => a - b);
  const sum = data.reduce((s, x) => s + x, 0);
  const mean = sum / n;
  const median = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
  const counts = new Map<number, number>();
  data.forEach((x) => counts.set(x, (counts.get(x) ?? 0) + 1));
  const maxCount = Math.max(...counts.values());
  const modes = maxCount > 1 ? [...counts.entries()].filter(([, c]) => c === maxCount).map(([x]) => x).sort((a, b) => a - b) : [];
  const ss = data.reduce((s, x) => s + (x - mean) ** 2, 0);
  const popVar = ss / n;
  const sampleVar = n > 1 ? ss / (n - 1) : NaN;
  const q = (p: number) => {
    // Method: median of halves (Tukey/TI-84 convention)
    const half = Math.floor(n / 2);
    const part = p === 1 ? sorted.slice(0, half) : sorted.slice(n % 2 ? half + 1 : half);
    const m = part.length;
    if (!m) return sorted[0];
    return m % 2 ? part[(m - 1) / 2] : (part[m / 2 - 1] + part[m / 2]) / 2;
  };
  const q1 = q(1);
  const q3 = q(3);
  return { n, sorted, sum, mean, median, modes, min: sorted[0], max: sorted[n - 1], range: sorted[n - 1] - sorted[0], ss, popVar, sampleVar, popStd: Math.sqrt(popVar), sampleStd: Math.sqrt(sampleVar), q1, q3, iqr: q3 - q1 };
}

export function solveStatistics(data: number[], measure: StatMeasure = "summary"): SolverOutput {
  if (data.length < 1) throw new MathInputError("Enter at least one number.");
  if (data.length > 10000) throw new MathInputError("Data sets up to 10,000 values are supported.");
  const s = describe(data);
  const listTex = s.n <= 20 ? s.sorted.map(numTex).join(", ") : `${s.sorted.slice(0, 8).map(numTex).join(", ")}, \\ldots, ${s.sorted.slice(-3).map(numTex).join(", ")}`;
  const steps: Step[] = [{ title: "Sort the data", latex: `${listTex}\\quad (n = ${s.n})` }];
  const meanStep: Step = { title: "Mean", latex: `\\bar{x} = \\frac{\\sum x_i}{n} = \\frac{${numTex(s.sum)}}{${s.n}} = ${numTex(s.mean)}` };
  const medianStep: Step = { title: "Median", text: s.n % 2 ? `With an odd count, the median is the middle (position ${(s.n + 1) / 2}) value.` : `With an even count, the median is the average of positions ${s.n / 2} and ${s.n / 2 + 1}.`, latex: `\\text{median} = ${numTex(s.median)}` };
  const modeStep: Step = { title: "Mode", latex: s.modes.length ? `\\text{mode} = ${s.modes.map(numTex).join(", ")}` : "\\text{no mode (all values appear once)}" };
  const varStep: Step = {
    title: "Variance",
    latex: `s^2 = \\frac{\\sum (x_i - \\bar{x})^2}{n - 1} = \\frac{${roundSig(s.ss, 8)}}{${s.n - 1}} = ${roundSig(s.sampleVar, 8)},\\qquad \\sigma^2 = \\frac{${roundSig(s.ss, 8)}}{${s.n}} = ${roundSig(s.popVar, 8)}`,
    text: "Use $n-1$ for a sample and $n$ for an entire population.",
  };
  const stdStep: Step = { title: "Standard deviation", latex: `s = \\sqrt{s^2} = ${roundSig(s.sampleStd, 8)},\\qquad \\sigma = ${roundSig(s.popStd, 8)}` };
  const qStep: Step = { title: "Quartiles", latex: `Q_1 = ${numTex(s.q1)},\\quad Q_3 = ${numTex(s.q3)},\\quad \\text{IQR} = ${numTex(s.iqr)}` };
  const rangeStep: Step = { title: "Range", latex: `${numTex(s.max)} - ${numTex(s.min)} = ${numTex(s.range)}` };
  const formulas = [
    { name: "Mean", latex: "\\bar{x} = \\frac{1}{n}\\sum_{i=1}^{n} x_i" },
    { name: "Sample variance", latex: "s^2 = \\frac{1}{n-1}\\sum (x_i - \\bar{x})^2" },
    { name: "Population standard deviation", latex: "\\sigma = \\sqrt{\\frac{1}{n}\\sum (x_i - \\mu)^2}" },
  ];
  const checks: VerificationCheck[] = [
    { label: "Deviations from the mean sum to zero", passed: Math.abs(data.reduce((a, x) => a + (x - s.mean), 0)) < 1e-8 * Math.max(1, Math.abs(s.sum)) },
    { label: "Median lies between min and max", passed: s.median >= s.min && s.median <= s.max },
  ];
  const map: Record<StatMeasure, { steps: Step[]; latex: string; text: string; topic: string }> = {
    mean: { steps: [meanStep], latex: `\\bar{x} = ${numTex(s.mean)}`, text: numText(s.mean), topic: "Mean" },
    median: { steps: [medianStep], latex: `\\text{median} = ${numTex(s.median)}`, text: numText(s.median), topic: "Median" },
    mode: { steps: [modeStep], latex: s.modes.length ? s.modes.map(numTex).join(", ") : "\\text{No mode}", text: s.modes.length ? s.modes.map(numText).join(", ") : "No mode", topic: "Mode" },
    range: { steps: [rangeStep], latex: numTex(s.range), text: numText(s.range), topic: "Range" },
    variance: { steps: [meanStep, varStep], latex: `s^2 = ${roundSig(s.sampleVar, 8)}\;(\\text{sample}),\; \\sigma^2 = ${roundSig(s.popVar, 8)}\;(\\text{population})`, text: `sample ${roundSig(s.sampleVar, 8)}, population ${roundSig(s.popVar, 8)}`, topic: "Variance" },
    std: { steps: [meanStep, varStep, stdStep], latex: `s = ${roundSig(s.sampleStd, 8)}\;(\\text{sample}),\; \\sigma = ${roundSig(s.popStd, 8)}\;(\\text{population})`, text: `sample ${roundSig(s.sampleStd, 8)}, population ${roundSig(s.popStd, 8)}`, topic: "Standard deviation" },
    quartiles: { steps: [medianStep, qStep], latex: `Q_1 = ${numTex(s.q1)},\; Q_2 = ${numTex(s.median)},\; Q_3 = ${numTex(s.q3)}`, text: `Q1 ${numText(s.q1)}, Q2 ${numText(s.median)}, Q3 ${numText(s.q3)}`, topic: "Quartiles" },
    summary: {
      steps: [meanStep, medianStep, modeStep, rangeStep, varStep, stdStep, qStep],
      latex: `\\bar{x} = ${numTex(s.mean)},\; \\text{median} = ${numTex(s.median)},\; s = ${roundSig(s.sampleStd, 6)}`,
      text: `mean ${numText(s.mean)}, median ${numText(s.median)}, mode ${s.modes.length ? s.modes.map(numText).join("/") : "none"}, range ${numText(s.range)}, sample SD ${roundSig(s.sampleStd, 6)}, population SD ${roundSig(s.popStd, 6)}`,
      topic: "Descriptive statistics",
    },
  };
  const chosen = map[measure];
  steps.push(...chosen.steps);
  return {
    interpreted: `\\text{${chosen.topic} of } \\{${listTex}\\}`,
    category: "statistics",
    topic: chosen.topic,
    answer: { latex: chosen.latex, text: chosen.text },
    steps,
    formulas,
    explanation: "Descriptive statistics summarize a data set: the mean and median describe the center, while range, variance and standard deviation describe the spread.",
    verification: verificationFrom(checks),
  };
}
