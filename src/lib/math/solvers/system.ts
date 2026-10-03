import { math, toTex, evalReal, variablesOf, type MathNode } from "../mathjs";
import { numTex, numText, roundSig } from "../format";
import { CAS, toCas } from "../cas";
import type { SolverOutput, Step, VerificationCheck } from "../types";
import { MathInputError, verificationFrom } from "../types";

export function matrixTex(rows: number[][], augmentAt?: number): string {
  const cols = rows[0]?.length ?? 0;
  const spec = augmentAt !== undefined ? `${"c".repeat(augmentAt)}|${"c".repeat(cols - augmentAt)}` : "c".repeat(cols);
  return `\\left[\\begin{array}{${spec}}${rows.map((r) => r.map((x) => numTex(x)).join(" & ")).join(" \\\\ ")}\\end{array}\\right]`;
}

/** Linear coefficients via derivatives; null if the expression is not linear in the variables. */
function linearCoefficients(f: MathNode, vars: string[]): { coeffs: number[]; constant: number } | null {
  const coeffs: number[] = [];
  for (const v of vars) {
    let d: MathNode;
    try {
      d = math.derivative(f, v);
    } catch {
      return null;
    }
    if (variablesOf(d).some((x) => vars.includes(x))) return null;
    const c = evalReal(d);
    if (!Number.isFinite(c)) return null;
    coeffs.push(c);
  }
  const zero = Object.fromEntries(vars.map((v) => [v, 0]));
  const constant = evalReal(f, zero);
  if (!Number.isFinite(constant)) return null;
  return { coeffs, constant };
}

const R = (i: number) => `R_{${i + 1}}`;

/** Gauss–Jordan elimination with recorded row operations. */
export function gaussJordan(M: number[][], nVars: number): { steps: Step[]; matrix: number[][]; rank: number; pivots: number[] } {
  const A = M.map((r) => [...r]);
  const steps: Step[] = [];
  const rows = A.length;
  let pivotRow = 0;
  const pivots: number[] = [];
  const clean = () => A.forEach((r) => r.forEach((x, j) => (r[j] = Math.abs(x) < 1e-12 ? 0 : x)));
  for (let col = 0; col < nVars && pivotRow < rows; col++) {
    let best = pivotRow;
    if (Math.abs(A[pivotRow][col]) < 1e-12) {
      for (let r = pivotRow + 1; r < rows; r++) if (Math.abs(A[r][col]) > 1e-12) { best = r; break; }
    }
    if (Math.abs(A[best][col]) < 1e-12) continue;
    if (best !== pivotRow) {
      [A[best], A[pivotRow]] = [A[pivotRow], A[best]];
      steps.push({ title: `Swap ${R(best).replace(/[{}_]/g, "")} and ${R(pivotRow).replace(/[{}_]/g, "")}`, latex: `${R(best)} \\leftrightarrow ${R(pivotRow)}:\; ${matrixTex(A, nVars)}` });
    }
    const p = A[pivotRow][col];
    if (Math.abs(p - 1) > 1e-12) {
      A[pivotRow] = A[pivotRow].map((x) => x / p);
      clean();
      steps.push({ title: `Make the pivot 1`, latex: `${R(pivotRow)} \\to \\frac{1}{${numTex(p)}}${R(pivotRow)}:\; ${matrixTex(A, nVars)}` });
    }
    const ops: string[] = [];
    for (let r = 0; r < rows; r++) {
      if (r === pivotRow) continue;
      const factor = A[r][col];
      if (Math.abs(factor) < 1e-12) continue;
      A[r] = A[r].map((x, j) => x - factor * A[pivotRow][j]);
      ops.push(`${R(r)} \\to ${R(r)} ${factor > 0 ? "-" : "+"} ${Math.abs(factor) === 1 ? "" : numTex(Math.abs(factor))}${R(pivotRow)}`);
    }
    clean();
    if (ops.length) steps.push({ title: `Eliminate column ${col + 1}`, latex: `${ops.join(",\; ")}:\; ${matrixTex(A, nVars)}` });
    pivots.push(col);
    pivotRow++;
  }
  return { steps, matrix: A, rank: pivotRow, pivots };
}

function det(m: number[][]): number {
  return math.det(m) as number;
}

export async function solveSystem(equations: { lhs: string; rhs: string }[]): Promise<SolverOutput> {
  const nodes = equations.map((e) => math.parse(`(${e.lhs}) - (${e.rhs})`));
  const vars = [...new Set(nodes.flatMap((n) => variablesOf(n)))].sort((a, b) => {
    const order = ["x", "y", "z", "w"];
    return (order.indexOf(a) + 100 * +(order.indexOf(a) < 0)) - (order.indexOf(b) + 100 * +(order.indexOf(b) < 0)) || a.localeCompare(b);
  });
  if (vars.length === 0) throw new MathInputError("The system has no variables to solve for.");
  if (vars.length > 6) throw new MathInputError("Systems with more than 6 variables are not supported.");
  const sysTex = `\\begin{cases} ${equations.map((e) => `${toTex(e.lhs)} = ${toTex(e.rhs)}`).join(" \\\\ ")} \\end{cases}`;
  const steps: Step[] = [{ title: "Write the system", latex: sysTex }];
  const linear = nodes.map((n) => linearCoefficients(n, vars));

  if (linear.every(Boolean)) {
    const rowsCoef = linear.map((l) => l!.coeffs);
    const rhs = linear.map((l) => -l!.constant);
    const aug = rowsCoef.map((r, i) => [...r, rhs[i]]);
    steps.push({
      title: "Write each equation in standard form",
      latex: `\\begin{cases} ${rowsCoef.map((r, i) => r.map((c, j) => (c === 0 ? "" : `${c < 0 ? "-" : j ? "+" : ""}${Math.abs(c) === 1 ? "" : numTex(Math.abs(c))}${vars[j]}`)).join(" ") + ` = ${numTex(rhs[i])}`).join(" \\\\ ")} \\end{cases}`,
    });
    steps.push({ title: "Form the augmented matrix", latex: matrixTex(aug, vars.length) });
    const gj = gaussJordan(aug, vars.length);
    steps.push(...gj.steps);
    const M = gj.matrix;
    const inconsistent = M.some((r) => r.slice(0, vars.length).every((x) => Math.abs(x) < 1e-12) && Math.abs(r[vars.length]) > 1e-10);
    if (inconsistent) {
      steps.push({ title: "Inconsistent row", text: "A row reads $0 = c$ with $c \\neq 0$, which is impossible." });
      return {
        interpreted: sysTex,
        category: "system",
        topic: "System of linear equations",
        answer: { latex: "\\text{No solution (inconsistent system)}", text: "No solution" },
        steps,
        formulas: [{ name: "Gauss–Jordan elimination", latex: "[A \\mid b] \\sim [\\,\\mathrm{RREF}\\,]" }],
        explanation: "The equations contradict each other (for lines: they are parallel), so no values satisfy all of them at once.",
        verification: verificationFrom([{ label: "Row reduction shows 0 = nonzero", passed: true }]),
      };
    }
    if (gj.rank < vars.length) {
      const free = vars.filter((_, j) => !gj.pivots.includes(j));
      const exprs = gj.pivots.map((col, r) => {
        const terms = free.map((fv) => {
          const c = -M[r][vars.indexOf(fv)];
          return Math.abs(c) < 1e-12 ? "" : `${c < 0 ? " - " : " + "}${Math.abs(c) === 1 ? "" : numTex(Math.abs(c))}${fv}`;
        });
        return `${vars[col]} = ${numTex(M[r][vars.length])}${terms.join("")}`;
      });
      steps.push({ title: "Express in terms of the free variable(s)", latex: exprs.join(",\\quad ") + `,\\quad ${free.join(", ")} \\in \\mathbb{R}` });
      return {
        interpreted: sysTex,
        category: "system",
        topic: "System of linear equations",
        answer: { latex: exprs.join(",\; ") + `\;(${free.join(", ")}\\text{ free})`, text: `Infinitely many solutions: ${exprs.join(", ").replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, "$1/$2")}` },
        steps,
        formulas: [{ name: "Gauss–Jordan elimination", latex: "[A \\mid b] \\sim [\\,\\mathrm{RREF}\\,]" }],
        explanation: "The equations are dependent, so there are infinitely many solutions described by free parameters.",
        verification: verificationFrom([{ label: `Rank ${gj.rank} < ${vars.length} variables`, passed: true }]),
      };
    }
    const sol = vars.map((_, j) => M[gj.pivots.indexOf(j)][vars.length]);
    steps.push({ title: "Read off the solution", latex: vars.map((v, j) => `${v} = ${numTex(sol[j])}`).join(",\\quad ") });
    const checks: VerificationCheck[] = equations.map((e, i) => {
      const scope = Object.fromEntries(vars.map((v, j) => [v, sol[j]]));
      const L = evalReal(e.lhs, scope);
      const Rv = evalReal(e.rhs, scope);
      return { label: `Equation ${i + 1} holds`, passed: Math.abs(L - Rv) < 1e-8 * Math.max(1, Math.abs(L)), detail: `${roundSig(L)} = ${roundSig(Rv)}` };
    });
    let alternative: SolverOutput["alternative"];
    if (rowsCoef.length === vars.length && vars.length <= 3) {
      const D = det(rowsCoef);
      if (Math.abs(D) > 1e-12) {
        alternative = {
          title: "Cramer's rule",
          steps: [
            { title: "Determinant of the coefficient matrix", latex: `D = \\det${matrixTex(rowsCoef)} = ${numTex(D)}` },
            ...vars.map((v, j) => {
              const Mj = rowsCoef.map((r, i) => r.map((c, k) => (k === j ? rhs[i] : c)));
              const Dj = det(Mj);
              return { title: `Solve for ${v}`, latex: `${v} = \\frac{D_{${v}}}{D} = \\frac{${numTex(Dj)}}{${numTex(D)}} = ${numTex(Dj / D)}` };
            }),
          ],
        };
      }
    }
    return {
      interpreted: sysTex,
      category: "system",
      topic: `System of linear equations (${vars.length}×${vars.length})`,
      answer: { latex: vars.map((v, j) => `${v} = ${numTex(sol[j])}`).join(",\; "), text: vars.map((v, j) => `${v} = ${numText(sol[j])}`).join(", ") },
      steps,
      formulas: [
        { name: "Gauss–Jordan elimination", latex: "[A \\mid b] \\sim [\\,I \\mid x\\,]" },
        { name: "Cramer's rule", latex: "x_i = \\frac{\\det(A_i)}{\\det(A)}" },
      ],
      explanation: "Write the system as an augmented matrix and use row operations to reduce it to reduced row-echelon form; the solution can then be read directly.",
      verification: verificationFrom(checks),
      alternative,
      graph: vars.length === 2 && vars[0] === "x" && vars[1] === "y" ? graphLines(rowsCoef, rhs, sol) : undefined,
    };
  }

  // Nonlinear system → CAS
  const sols = await CAS.solveSystem(equations.map((e) => `${toCas(e.lhs)}=${toCas(e.rhs)}`));
  if (!sols || sols.length === 0) {
    throw new MathInputError("Could not solve this nonlinear system exactly. Try simplifying it or solving one equation for a variable first.");
  }
  steps.push({ title: "Use substitution", text: "Solve one equation for a variable and substitute it into the others, reducing the system to a single equation." });
  const realSols = sols
    .map((s) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, { str: v, val: evalReal(v) }])))
    .filter((s) => Object.values(s).every((x) => Number.isFinite(x.val)));
  const checks: VerificationCheck[] = [];
  for (const s of realSols) {
    const scope = Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v.val]));
    const ok = equations.every((e) => Math.abs(evalReal(e.lhs, scope) - evalReal(e.rhs, scope)) < 1e-7);
    checks.push({ label: `Check (${vars.map((v) => numText(scope[v])).join(", ")})`, passed: ok });
  }
  const fmt = (s: (typeof realSols)[number]) => vars.map((v) => `${v} = ${s[v] ? (realSolTex(s[v].val) ?? toTex(s[v].str)) : "?"}`).join(",\; ");
  steps.push({ title: "Solutions", latex: realSols.map((s) => `(${fmt(s)})`).join(",\\quad ") || "\\text{No real solution}" });
  return {
    interpreted: sysTex,
    category: "system",
    topic: "Nonlinear system of equations",
    answer: {
      latex: realSols.map((s) => `(${fmt(s)})`).join(",\; ") || "\\text{No real solution}",
      text: realSols.map((s) => `(${vars.map((v) => `${v} = ${numText(s[v]?.val ?? NaN)}`).join(", ")})`).join("; ") || "No real solution",
    },
    steps,
    formulas: [{ name: "Substitution method", latex: "y = g(x) \\Rightarrow F(x, g(x)) = 0" }],
    explanation: "For nonlinear systems, isolate one variable and substitute into the other equation(s), then solve the resulting single-variable equation and back-substitute.",
    verification: verificationFrom(checks),
  };
}

function realSolTex(x: number): string | null {
  const t = numTex(x);
  return /[a-z]/i.test(t.replace(/\\frac|\\sqrt|\\pi/g, "")) ? null : t;
}

function graphLines(coef: number[][], rhs: number[], sol: number[]) {
  const exprs = coef
    .map((r, i) => (Math.abs(r[1]) > 1e-12 ? `(${rhs[i]} - (${r[0]})*x)/(${r[1]})` : null))
    .filter((e): e is string => !!e);
  return { expressions: exprs, points: [{ x: sol[0], y: sol[1], label: `(${numText(sol[0])}, ${numText(sol[1])})` }] };
}
