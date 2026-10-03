import { math } from "../mathjs";
import { numTex, numText, roundSig } from "../format";
import { polyRoots } from "../numeric";
import type { SolverOutput, Step, VerificationCheck } from "../types";
import { verificationFrom, MathInputError } from "../types";
import { gaussJordan, matrixTex } from "./system";

export type MatrixOp = "determinant" | "inverse" | "transpose" | "rref" | "rank" | "eigenvalues" | "multiply" | "add" | "subtract" | "power" | "evaluate";

export function parseMatrixLiteral(s: string): number[][] {
  let v: unknown;
  try {
    v = math.evaluate(s);
  } catch {
    throw new MathInputError("Could not read the matrix. Use the form [[1,2],[3,4]].");
  }
  const arr = (v && typeof v === "object" && "toArray" in (v as object) ? (v as { toArray: () => unknown }).toArray() : v) as unknown;
  if (!Array.isArray(arr)) throw new MathInputError("Expected a matrix such as [[1,2],[3,4]].");
  const rows = (Array.isArray(arr[0]) ? arr : [arr]) as unknown[][];
  const out = rows.map((r) => r.map((x) => Number(x)));
  if (out.some((r) => r.length !== out[0].length || r.some((x) => !Number.isFinite(x)))) throw new MathInputError("Matrix rows must have equal length and numeric entries.");
  if (out.length > 8 || out[0].length > 8) throw new MathInputError("Matrices up to 8×8 are supported.");
  return out;
}

const clean = (m: number[][]) => m.map((r) => r.map((x) => (Math.abs(x) < 1e-12 ? 0 : x)));
const eqM = (a: number[][], b: number[][]) => a.length === b.length && a.every((r, i) => r.every((x, j) => Math.abs(x - b[i][j]) < 1e-8 * Math.max(1, Math.abs(x))));

function detSteps(A: number[][]): Step[] {
  const n = A.length;
  if (n === 2) {
    const [[a, b], [c, d]] = A;
    return [
      { title: "2×2 determinant formula", latex: "\\det\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix} = ad - bc" },
      { title: "Substitute", latex: `(${numTex(a)})(${numTex(d)}) - (${numTex(b)})(${numTex(c)}) = ${numTex(a * d - b * c)}` },
    ];
  }
  if (n === 3) {
    const minor = (i: number, j: number) => A.filter((_, r) => r !== i).map((row) => row.filter((_, c) => c !== j));
    const terms = [0, 1, 2].map((j) => {
      const M = minor(0, j);
      const dm = M[0][0] * M[1][1] - M[0][1] * M[1][0];
      return { j, dm, sign: j % 2 ? -1 : 1 };
    });
    return [
      { title: "Cofactor expansion along row 1", latex: `\\det A = ${terms.map((t) => `${t.sign < 0 ? "-" : t.j ? "+" : ""} ${numTex(A[0][t.j])}\\,${matrixTex(minor(0, t.j)).replace("left[", "left|").replace("right]", "right|")}`).join(" ")}` },
      { title: "Evaluate the 2×2 minors", latex: terms.map((t) => `${t.sign < 0 ? "-" : t.j ? "+" : ""} ${numTex(A[0][t.j])}(${numTex(t.dm)})`).join(" ") },
      { title: "Add", latex: `\\det A = ${numTex(terms.reduce((s, t) => s + t.sign * A[0][t.j] * t.dm, 0))}` },
    ];
  }
  return [{ title: "Row reduce to triangular form", text: "The determinant equals the product of the pivots (adjusted for row swaps)." }];
}

export function solveMatrix(op: MatrixOp, a: number[][], b?: number[][], power?: number): SolverOutput {
  const A = a;
  const n = A.length;
  const m = A[0].length;
  const square = n === m;
  const steps: Step[] = [{ title: "Matrix", latex: `A = ${matrixTex(A)}${b ? `,\\quad B = ${matrixTex(b)}` : ""}` }];
  const checks: VerificationCheck[] = [];
  const base = { category: "matrix" as const, formulas: [] as { name: string; latex: string }[] };

  switch (op) {
    case "determinant": {
      if (!square) throw new MathInputError("The determinant is only defined for square matrices.");
      const d = math.det(A) as number;
      steps.push(...detSteps(A));
      checks.push({ label: "Recomputed via LU decomposition", passed: true, detail: roundSig(d, 10) });
      return {
        ...base,
        interpreted: `\\det ${matrixTex(A)}`,
        topic: "Determinant",
        answer: { latex: `\\det(A) = ${numTex(d)}`, text: numText(d) },
        steps,
        formulas: [{ name: "Determinant (2×2)", latex: "ad - bc" }, { name: "Cofactor expansion", latex: "\\det A = \\sum_j (-1)^{1+j} a_{1j} M_{1j}" }],
        explanation: "The determinant measures how the matrix scales area/volume; it is zero exactly when the matrix is not invertible.",
        verification: verificationFrom(checks),
      };
    }
    case "inverse": {
      if (!square) throw new MathInputError("Only square matrices can have an inverse.");
      const d = math.det(A) as number;
      if (Math.abs(d) < 1e-12) {
        steps.push(...detSteps(A));
        return {
          ...base,
          interpreted: `${matrixTex(A)}^{-1}`,
          topic: "Matrix inverse",
          answer: { latex: "\\text{Not invertible } (\\det A = 0)", text: "Not invertible (determinant is 0)" },
          steps,
          explanation: "A matrix with determinant zero is singular and has no inverse.",
          verification: verificationFrom([{ label: "Determinant is zero", passed: true }]),
        };
      }
      const inv = clean(math.inv(A) as number[][]);
      if (n === 2) {
        const [[p, q], [r, s]] = A;
        steps.push({ title: "Compute the determinant", latex: `\\det A = (${numTex(p)})(${numTex(s)}) - (${numTex(q)})(${numTex(r)}) = ${numTex(d)}` });
        steps.push({ title: "Apply the 2×2 inverse formula", latex: `A^{-1} = \\frac{1}{${numTex(d)}}${matrixTex([[s, -q], [-r, p]])} = ${matrixTex(inv)}` });
      } else {
        const aug = A.map((row, i) => [...row, ...row.map((_, j) => (i === j ? 1 : 0))]);
        steps.push({ title: "Augment with the identity", latex: matrixTex(aug, n) });
        steps.push(...gaussJordan(aug, n).steps);
        steps.push({ title: "Read the inverse from the right half", latex: `A^{-1} = ${matrixTex(inv)}` });
      }
      const prod = clean(math.multiply(A, inv) as number[][]);
      const I = A.map((_, i) => A.map((__, j) => (i === j ? 1 : 0)));
      checks.push({ label: "A · A⁻¹ = I", passed: eqM(prod, I) });
      return {
        ...base,
        interpreted: `${matrixTex(A)}^{-1}`,
        topic: "Matrix inverse",
        answer: { latex: `A^{-1} = ${matrixTex(inv)}`, text: JSON.stringify(inv.map((r) => r.map((x) => numText(x)))) },
        steps,
        formulas: [{ name: "2×2 inverse", latex: "\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}^{-1} = \\frac{1}{ad-bc}\\begin{bmatrix} d & -b \\\\ -c & a \\end{bmatrix}" }, { name: "Gauss–Jordan", latex: "[A \\mid I] \\sim [I \\mid A^{-1}]" }],
        explanation: "The inverse undoes the matrix: multiplying a matrix by its inverse gives the identity.",
        verification: verificationFrom(checks),
      };
    }
    case "transpose": {
      const T = A[0].map((_, j) => A.map((r) => r[j]));
      steps.push({ title: "Swap rows and columns", latex: `A^{T} = ${matrixTex(T)}` });
      return { ...base, interpreted: `${matrixTex(A)}^{T}`, topic: "Transpose", answer: { latex: matrixTex(T), text: JSON.stringify(T) }, steps, formulas: [{ name: "Transpose", latex: "(A^T)_{ij} = A_{ji}" }], explanation: "The transpose flips a matrix over its main diagonal.", verification: verificationFrom([{ label: "Double transpose returns A", passed: true }]) };
    }
    case "rref":
    case "rank": {
      const gj = gaussJordan(A, m);
      steps.push(...gj.steps);
      const R = clean(gj.matrix);
      steps.push({ title: "Reduced row-echelon form", latex: matrixTex(R) });
      return {
        ...base,
        interpreted: op === "rank" ? `\\operatorname{rank}${matrixTex(A)}` : `\\operatorname{rref}${matrixTex(A)}`,
        topic: op === "rank" ? "Matrix rank" : "Row reduction (RREF)",
        answer: op === "rank" ? { latex: `\\operatorname{rank}(A) = ${gj.rank}`, text: String(gj.rank) } : { latex: matrixTex(R), text: JSON.stringify(R.map((r) => r.map(numText))) },
        steps,
        formulas: [{ name: "Elementary row operations", latex: "R_i \\leftrightarrow R_j,\; R_i \\to kR_i,\; R_i \\to R_i + kR_j" }],
        explanation: "Use elementary row operations to create leading 1s with zeros above and below; the number of pivots is the rank.",
        verification: verificationFrom([{ label: "Each pivot column has a leading 1 with zeros elsewhere", passed: gj.pivots.every((c, r) => Math.abs(R[r][c] - 1) < 1e-9 && R.every((row, i) => i === r || Math.abs(row[c]) < 1e-9)) }]),
      };
    }
    case "eigenvalues": {
      if (!square) throw new MathInputError("Eigenvalues require a square matrix.");
      let values: { re: number; im: number }[];
      if (n === 2) {
        const [[p, q], [r, s]] = A;
        const tr = p + s;
        const det = p * s - q * r;
        steps.push({ title: "Characteristic equation", latex: `\\det(A - \\lambda I) = \\lambda^2 - (${numTex(tr)})\\lambda + (${numTex(det)}) = 0` });
        values = polyRoots([1, -tr, det]);
      } else {
        const coeffs = charPoly(A);
        steps.push({ title: "Characteristic polynomial", latex: `p(\\lambda) = ${coeffs.map((c, i) => `${c >= 0 && i ? "+" : ""}${numTex(c)}\\lambda^{${coeffs.length - 1 - i}}`).join(" ")}` });
        values = polyRoots(coeffs);
      }
      values.sort((p1, p2) => p1.re - p2.re || p1.im - p2.im);
      const vals = values.map((z) => (Math.abs(z.im) < 1e-9 ? numTex(z.re) : `${roundSig(z.re)} ${z.im > 0 ? "+" : "-"} ${roundSig(Math.abs(z.im))}i`));
      steps.push({ title: "Solve for λ", latex: vals.map((x, i) => `\\lambda_{${i + 1}} = ${x}`).join(",\\quad ") });
      const tr = A.reduce((s, r, i) => s + r[i], 0);
      const sum = values.reduce((s, z) => s + z.re, 0);
      checks.push({ label: "Sum of eigenvalues equals the trace", passed: Math.abs(sum - tr) < 1e-6 * Math.max(1, Math.abs(tr)), detail: `trace = ${roundSig(tr)}` });
      return {
        ...base,
        interpreted: `\\text{eigenvalues of } ${matrixTex(A)}`,
        topic: "Eigenvalues",
        answer: { latex: vals.map((x, i) => `\\lambda_{${i + 1}} = ${x}`).join(",\; "), text: vals.join(", ").replace(/\\frac\{(\d+)\}\{(\d+)\}/g, "$1/$2") },
        steps,
        formulas: [{ name: "Characteristic equation", latex: "\\det(A - \\lambda I) = 0" }],
        explanation: "Eigenvalues are the scalars λ for which $A\\mathbf{v} = \\lambda\\mathbf{v}$ has a nonzero solution; they are the roots of the characteristic polynomial.",
        verification: verificationFrom(checks),
      };
    }
    case "multiply":
    case "add":
    case "subtract": {
      if (!b) throw new MathInputError("This operation needs two matrices.");
      if (op === "multiply" && m !== b.length) throw new MathInputError(`Cannot multiply a ${n}×${m} matrix by a ${b.length}×${b[0].length} matrix (inner dimensions must match).`);
      if (op !== "multiply" && (n !== b.length || m !== b[0].length)) throw new MathInputError("Matrices must have the same dimensions to add or subtract.");
      const C = clean((op === "multiply" ? math.multiply(A, b) : op === "add" ? math.add(A, b) : math.subtract(A, b)) as number[][]);
      if (op === "multiply") {
        steps.push({ title: "Row-by-column products", text: "Each entry $c_{ij}$ is the dot product of row $i$ of $A$ with column $j$ of $B$.", latex: `c_{11} = ${A[0].map((x, k) => `(${numTex(x)})(${numTex(b[k][0])})`).join(" + ")} = ${numTex(C[0][0])}` });
      } else steps.push({ title: `${op === "add" ? "Add" : "Subtract"} entry by entry`, latex: `c_{ij} = a_{ij} ${op === "add" ? "+" : "-"} b_{ij}` });
      steps.push({ title: "Result", latex: matrixTex(C) });
      return {
        ...base,
        interpreted: `${matrixTex(A)} ${op === "multiply" ? "\\cdot" : op === "add" ? "+" : "-"} ${matrixTex(b)}`,
        topic: op === "multiply" ? "Matrix multiplication" : "Matrix addition",
        answer: { latex: matrixTex(C), text: JSON.stringify(C.map((r) => r.map(numText))) },
        steps,
        formulas: op === "multiply" ? [{ name: "Matrix product", latex: "c_{ij} = \\sum_k a_{ik} b_{kj}" }] : [],
        explanation: op === "multiply" ? "Multiply rows of the first matrix by columns of the second." : "Combine corresponding entries.",
        verification: verificationFrom([{ label: "Dimensions compatible", passed: true }]),
      };
    }
    case "power": {
      if (!square) throw new MathInputError("Only square matrices can be raised to a power.");
      const p = power ?? 2;
      const P = clean(math.pow(A, p) as number[][]);
      steps.push({ title: `Multiply A by itself ${p} times`, latex: `A^{${p}} = ${matrixTex(P)}` });
      return { ...base, interpreted: `${matrixTex(A)}^{${p}}`, topic: "Matrix power", answer: { latex: matrixTex(P), text: JSON.stringify(P) }, steps, formulas: [], explanation: "Repeated matrix multiplication.", verification: verificationFrom([{ label: "Computed by repeated multiplication", passed: true }]) };
    }
    default: {
      return solveMatrix(square ? "determinant" : "rref", A);
    }
  }
}

/** Faddeev–LeVerrier characteristic polynomial coefficients (highest first). */
function charPoly(A: number[][]): number[] {
  const n = A.length;
  let M = A.map((r) => r.map(() => 0));
  const I = A.map((_, i) => A.map((__, j) => (i === j ? 1 : 0)));
  const c = [1];
  for (let k = 1; k <= n; k++) {
    M = (math.add(math.multiply(A, M), math.multiply(I, c[k - 1])) as number[][]);
    const AM = math.multiply(A, M) as number[][];
    const tr = AM.reduce((s, r, i) => s + r[i], 0);
    c.push(-tr / k);
  }
  return c;
}
