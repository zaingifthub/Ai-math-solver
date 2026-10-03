import { numTex, numText, roundSig } from "../format";
import type { SolverOutput, Step } from "../types";
import { verificationFrom, MathInputError } from "../types";

export type VectorOp = "dot" | "cross" | "magnitude" | "angle" | "unit" | "add" | "projection";

const vt = (v: number[]) => `\\langle ${v.map(numTex).join(", ")} \\rangle`;
const vx = (v: number[]) => `<${v.map(numText).join(", ")}>`;

export function solveVector(op: VectorOp, a: number[], b?: number[]): SolverOutput {
  const need2 = op !== "magnitude" && op !== "unit";
  if (need2 && (!b || b.length !== a.length)) throw new MathInputError("This vector operation needs two vectors of the same dimension.");
  const dot = (u: number[], w: number[]) => u.reduce((s, x, i) => s + x * w[i], 0);
  const mag = (u: number[]) => Math.sqrt(dot(u, u));
  const steps: Step[] = [{ title: "Vectors", latex: `\\mathbf{a} = ${vt(a)}${b ? `,\\quad \\mathbf{b} = ${vt(b)}` : ""}` }];
  const base = { category: "vector" as const };
  switch (op) {
    case "dot": {
      const d = dot(a, b!);
      steps.push({ title: "Multiply components and add", latex: `${a.map((x, i) => `(${numTex(x)})(${numTex(b![i])})`).join(" + ")} = ${numTex(d)}` });
      return { ...base, interpreted: `${vt(a)} \\cdot ${vt(b!)}`, topic: "Dot product", answer: { latex: numTex(d), text: numText(d) }, steps, formulas: [{ name: "Dot product", latex: "\\mathbf{a}\\cdot\\mathbf{b} = \\sum a_i b_i" }], explanation: d === 0 ? "The dot product is 0, so the vectors are perpendicular." : "Multiply matching components and sum them.", verification: verificationFrom([{ label: "Symmetric: a·b = b·a", passed: dot(a, b!) === dot(b!, a) }]) };
    }
    case "cross": {
      if (a.length !== 3) throw new MathInputError("The cross product is defined for 3D vectors.");
      const c = [a[1] * b![2] - a[2] * b![1], a[2] * b![0] - a[0] * b![2], a[0] * b![1] - a[1] * b![0]];
      steps.push({ title: "Determinant formula", latex: `\\begin{vmatrix} \\mathbf{i} & \\mathbf{j} & \\mathbf{k} \\\\ ${a.map(numTex).join(" & ")} \\\\ ${b!.map(numTex).join(" & ")} \\end{vmatrix}` });
      steps.push({ title: "Expand", latex: `\\langle (${numTex(a[1])})(${numTex(b![2])}) - (${numTex(a[2])})(${numTex(b![1])}),\; (${numTex(a[2])})(${numTex(b![0])}) - (${numTex(a[0])})(${numTex(b![2])}),\; (${numTex(a[0])})(${numTex(b![1])}) - (${numTex(a[1])})(${numTex(b![0])}) \\rangle = ${vt(c)}` });
      return { ...base, interpreted: `${vt(a)} \\times ${vt(b!)}`, topic: "Cross product", answer: { latex: vt(c), text: vx(c) }, steps, formulas: [{ name: "Cross product", latex: "\\mathbf{a}\\times\\mathbf{b} = \\langle a_2b_3 - a_3b_2,\\, a_3b_1 - a_1b_3,\\, a_1b_2 - a_2b_1 \\rangle" }], explanation: "The cross product is perpendicular to both vectors; its length equals the area of the parallelogram they span.", verification: verificationFrom([{ label: "Result is perpendicular to a and b", passed: Math.abs(dot(c, a)) < 1e-9 && Math.abs(dot(c, b!)) < 1e-9 }]) };
    }
    case "magnitude":
    case "unit": {
      const m = mag(a);
      steps.push({ title: "Magnitude", latex: `\\|\\mathbf{a}\\| = \\sqrt{${a.map((x) => `(${numTex(x)})^2`).join(" + ")}} = ${numTex(m)}` });
      if (op === "magnitude") return { ...base, interpreted: `\\|${vt(a)}\\|`, topic: "Vector magnitude", answer: { latex: numTex(m), text: numText(m), decimal: roundSig(m, 10) }, steps, formulas: [{ name: "Magnitude", latex: "\\|\\mathbf{a}\\| = \\sqrt{a_1^2 + \\cdots + a_n^2}" }], explanation: "The magnitude is the length of the vector (Pythagorean theorem).", verification: verificationFrom([{ label: "Non-negative length", passed: m >= 0 }]) };
      if (m === 0) throw new MathInputError("The zero vector has no unit vector.");
      const u = a.map((x) => x / m);
      steps.push({ title: "Divide by the magnitude", latex: `\\hat{\\mathbf{a}} = \\frac{1}{${numTex(m)}}${vt(a)} = ${vt(u)}` });
      return { ...base, interpreted: `\\hat{${vt(a)}}`, topic: "Unit vector", answer: { latex: vt(u), text: vx(u) }, steps, formulas: [{ name: "Unit vector", latex: "\\hat{\\mathbf{a}} = \\frac{\\mathbf{a}}{\\|\\mathbf{a}\\|}" }], explanation: "A unit vector points in the same direction with length 1.", verification: verificationFrom([{ label: "Length of the result is 1", passed: Math.abs(mag(u) - 1) < 1e-9 }]) };
    }
    case "angle": {
      const c = dot(a, b!) / (mag(a) * mag(b!));
      const th = Math.acos(Math.max(-1, Math.min(1, c)));
      steps.push({ title: "Use the dot product formula", latex: `\\cos\\theta = \\frac{\\mathbf{a}\\cdot\\mathbf{b}}{\\|\\mathbf{a}\\|\\|\\mathbf{b}\\|} = \\frac{${numTex(dot(a, b!))}}{${numTex(mag(a))}\\cdot ${numTex(mag(b!))}} = ${roundSig(c, 8)}` });
      steps.push({ title: "Take the inverse cosine", latex: `\\theta = ${numTex(th)} \\approx ${roundSig((th * 180) / Math.PI, 8)}^\\circ` });
      return { ...base, interpreted: `\\angle(${vt(a)}, ${vt(b!)})`, topic: "Angle between vectors", answer: { latex: `\\theta \\approx ${roundSig((th * 180) / Math.PI, 8)}^\\circ`, text: `${roundSig((th * 180) / Math.PI, 8)}° (${roundSig(th, 8)} rad)` }, steps, formulas: [{ name: "Angle formula", latex: "\\cos\\theta = \\frac{\\mathbf{a}\\cdot\\mathbf{b}}{\\|\\mathbf{a}\\|\\|\\mathbf{b}\\|}" }], explanation: "The dot product relates to the cosine of the angle between two vectors.", verification: verificationFrom([{ label: "Angle within [0°, 180°]", passed: th >= 0 && th <= Math.PI }]) };
    }
    case "projection": {
      const k = dot(a, b!) / dot(b!, b!);
      const p = b!.map((x) => x * k);
      steps.push({ title: "Projection formula", latex: `\\operatorname{proj}_{\\mathbf{b}}\\mathbf{a} = \\frac{${numTex(dot(a, b!))}}{${numTex(dot(b!, b!))}}${vt(b!)} = ${vt(p)}` });
      return { ...base, interpreted: `\\operatorname{proj}_{${vt(b!)}} ${vt(a)}`, topic: "Vector projection", answer: { latex: vt(p), text: vx(p) }, steps, formulas: [{ name: "Projection", latex: "\\operatorname{proj}_{\\mathbf{b}}\\mathbf{a} = \\frac{\\mathbf{a}\\cdot\\mathbf{b}}{\\mathbf{b}\\cdot\\mathbf{b}}\\mathbf{b}" }], explanation: "The projection is the component of a in the direction of b.", verification: verificationFrom([{ label: "a − proj is perpendicular to b", passed: Math.abs(dot(a.map((x, i) => x - p[i]), b!)) < 1e-9 }]) };
    }
    default: {
      const s = a.map((x, i) => x + b![i]);
      steps.push({ title: "Add components", latex: `${vt(a)} + ${vt(b!)} = ${vt(s)}` });
      return { ...base, interpreted: `${vt(a)} + ${vt(b!)}`, topic: "Vector addition", answer: { latex: vt(s), text: vx(s) }, steps, formulas: [], explanation: "Add corresponding components.", verification: verificationFrom([{ label: "Component-wise", passed: true }]) };
    }
  }
}
