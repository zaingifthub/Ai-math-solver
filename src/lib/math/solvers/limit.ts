import { math, toTex, toStr, compile, evalReal, type MathNode } from "../mathjs";
import { numTex, numText, roundSig } from "../format";
import { oneSidedLimit, close } from "../numeric";
import { CAS, toCas } from "../cas";
import type { SolverOutput, Step, Formula, VerificationCheck } from "../types";
import { verificationFrom, MathInputError } from "../types";

function unwrap(n: MathNode): MathNode {
  while (n.type === "ParenthesisNode") n = (n as unknown as { content: MathNode }).content;
  return n;
}

function fmtLimit(x: number): string {
  return Number.isFinite(x) ? numTex(x) : x > 0 ? "\\infty" : "-\\infty";
}

export interface LimitRequest {
  expr: string;
  variable: string;
  at: string;
  side?: "left" | "right" | "both";
}

export async function solveLimit(req: LimitRequest): Promise<SolverOutput> {
  const node = math.parse(req.expr);
  const v = req.variable;
  const atRaw = req.at.trim().replace(/^\+?inf(inity)?$/i, "Infinity").replace(/^-inf(inity)?$/i, "-Infinity");
  const a = evalReal(atRaw);
  if (Number.isNaN(a)) throw new MathInputError("The limit point must be a number or ±infinity.");
  const side = req.side ?? "both";
  const sideTex = side === "left" ? "^-" : side === "right" ? "^+" : "";
  const aTex = Number.isFinite(a) ? toTex(atRaw) : a > 0 ? "\\infty" : "-\\infty";
  const interpreted = `\\lim_{${v} \\to ${aTex}${sideTex}} ${toTex(node)}`;
  const steps: Step[] = [{ title: "Set up the limit", latex: interpreted }];
  const formulas: Formula[] = [];
  const fc = compile(node);
  const f = (x: number) => {
    try {
      const r = fc.evaluate({ [v]: x });
      return typeof r === "number" ? r : NaN;
    } catch {
      return NaN;
    }
  };

  let resultTex: string | null = null;
  let resultVal: number | null = null;
  const u = unwrap(node);
  const isFraction = u.type === "OperatorNode" && (u as unknown as { op: string }).op === "/";

  if (Number.isFinite(a)) {
    const direct = f(a);
    if (Number.isFinite(direct) && side === "both") {
      steps.push({ title: "Try direct substitution", latex: `${toTex(node.transform((n) => (n.type === "SymbolNode" && (n as unknown as { name: string }).name === v ? new math.ParenthesisNode(math.parse(atRaw)) : n)))} = ${numTex(direct)}`, text: "The function is continuous at this point, so the limit equals the function value." });
      formulas.push({ name: "Direct substitution", latex: "\\lim_{x\\to a} f(x) = f(a) \\text{ if } f \\text{ is continuous at } a" });
      resultVal = direct;
      resultTex = numTex(direct);
    } else if (isFraction) {
      const [num, den] = (u as unknown as { args: MathNode[] }).args;
      const nv = evalReal(num, { [v]: a });
      const dv = evalReal(den, { [v]: a });
      if (Math.abs(nv) < 1e-12 && Math.abs(dv) < 1e-12) {
        steps.push({ title: "Direct substitution gives an indeterminate form", latex: "\\frac{0}{0}", text: "We must simplify or use L'Hôpital's rule." });
        const factN = await CAS.factor(toCas(num));
        const factD = await CAS.factor(toCas(den));
        const simplified = await CAS.simplify(toCas(node));
        if (simplified && Number.isFinite(evalReal(simplified, { [v]: a })) && simplified.length < 200) {
          if (factN && factD) steps.push({ title: "Factor numerator and denominator", latex: `\\frac{${toTex(factN)}}{${toTex(factD)}}` });
          steps.push({ title: "Cancel the common factor and substitute", latex: `\\lim_{${v}\\to ${aTex}} ${toTex(simplified)} = ${numTex(evalReal(simplified, { [v]: a }))}` });
          formulas.push({ name: "Factor and cancel", latex: "\\frac{(x-a)g(x)}{(x-a)h(x)} = \\frac{g(x)}{h(x)},\; x \\neq a" });
        } else {
          formulas.push({ name: "L'Hôpital's rule", latex: "\\lim_{x\\to a}\\frac{f(x)}{g(x)} = \\lim_{x\\to a}\\frac{f'(x)}{g'(x)}" });
          let N = num;
          let D = den;
          for (let k = 0; k < 4; k++) {
            N = math.simplify(math.derivative(N, v));
            D = math.simplify(math.derivative(D, v));
            const n2 = evalReal(N, { [v]: a });
            const d2 = evalReal(D, { [v]: a });
            steps.push({ title: `Apply L'Hôpital's rule${k ? ` again (${k + 1})` : ""}`, latex: `\\lim_{${v}\\to ${aTex}} \\frac{${toTex(N)}}{${toTex(D)}}` });
            if (!(Math.abs(n2) < 1e-12 && Math.abs(d2) < 1e-12)) {
              if (Number.isFinite(n2 / d2)) steps.push({ title: "Substitute", latex: `\\frac{${numTex(n2)}}{${numTex(d2)}} = ${numTex(n2 / d2)}` });
              break;
            }
          }
        }
      } else if (Math.abs(dv) < 1e-12 && Math.abs(nv) > 1e-12) {
        steps.push({ title: "Nonzero numerator over zero", latex: `\\frac{${numTex(nv)}}{0}`, text: "The function grows without bound near this point, so examine the one-sided limits." });
      }
    }
  } else {
    steps.push({ title: "Limit at infinity", text: "Compare the dominant (fastest-growing) terms of the expression." });
    if (isFraction) {
      formulas.push({ name: "Limits at infinity of rational functions", latex: "\\lim_{x\\to\\infty}\\frac{a_n x^n + \\cdots}{b_m x^m + \\cdots} = \\begin{cases} 0 & n < m \\\\ \\frac{a_n}{b_m} & n = m \\\\ \\pm\\infty & n > m \\end{cases}" });
      steps.push({ title: "Divide by the highest power", text: "Divide numerator and denominator by the highest power of the variable in the denominator; terms like $\\frac{c}{x^k}$ tend to 0." });
    }
  }

  // Authoritative value: CAS limit, cross-checked numerically from both sides
  const left = Number.isFinite(a) ? oneSidedLimit(f, a, -1) : a < 0 ? oneSidedLimit(f, a, 1) : NaN;
  const right = Number.isFinite(a) ? oneSidedLimit(f, a, 1) : a > 0 ? oneSidedLimit(f, a, 1) : NaN;
  let casVal: number | null = null;
  let casTex: string | null = null;
  if (side === "both") {
    const casRes = await CAS.limit(toCas(node), v, Number.isFinite(a) ? toCas(atRaw) : a > 0 ? "Infinity" : "-Infinity");
    if (casRes && !/limit|undefined|NaN|\[/.test(casRes)) {
      try {
        const val = casRes.trim() === "Infinity" ? Infinity : casRes.trim() === "-Infinity" ? -Infinity : evalReal(casRes);
        if (!Number.isNaN(val)) {
          casVal = val;
          casTex = Number.isFinite(val) ? (numTex(val).length < 30 ? numTex(val) : toTex(casRes)) : fmtLimit(val);
        }
      } catch {
        /* ignore */
      }
    }
  }
  const checks: VerificationCheck[] = [];
  if (side === "left" || side === "right") {
    const val = side === "left" ? left : right;
    if (Number.isNaN(val)) throw new MathInputError("The one-sided limit does not exist or could not be determined.");
    resultVal = val;
    resultTex = fmtLimit(val);
    checks.push({ label: `Numerical approach from the ${side}`, passed: true, detail: Number.isFinite(val) ? `→ ${roundSig(val, 8)}` : `→ ${val > 0 ? "+∞" : "-∞"}` });
  } else {
    const numericBoth = Number.isFinite(a) ? (!Number.isNaN(left) && !Number.isNaN(right) && (close(left, right, 1e-4) || left === right) ? right : NaN) : a > 0 ? right : left;
    if (casVal !== null) {
      resultVal = casVal;
      resultTex = casTex;
    } else if (!Number.isNaN(numericBoth)) {
      resultVal = numericBoth;
      resultTex = fmtLimit(numericBoth);
    }
    if (Number.isFinite(a)) {
      steps.push({
        title: "Check one-sided limits",
        latex: `\\lim_{${v}\\to ${aTex}^-} = ${Number.isNaN(left) ? "\\text{DNE}" : fmtLimit(left)},\\qquad \\lim_{${v}\\to ${aTex}^+} = ${Number.isNaN(right) ? "\\text{DNE}" : fmtLimit(right)}`,
      });
      if (!Number.isNaN(left) && !Number.isNaN(right) && !close(left, right, 1e-4) && left !== right) {
        steps.push({ title: "Conclusion", text: "The one-sided limits differ, so the two-sided limit does not exist." });
        return {
          interpreted,
          category: "limit",
          topic: "Limit",
          answer: { latex: "\\text{Does not exist}", text: "Does not exist (one-sided limits differ)" },
          steps,
          formulas,
          explanation: "A two-sided limit exists only when the left-hand and right-hand limits are equal.",
          verification: verificationFrom([{ label: "One-sided limits computed numerically", passed: true, detail: `left ${roundSig(left)}, right ${roundSig(right)}` }]),
          graph: v === "x" ? { expressions: [toStr(node)] } : undefined,
        };
      }
    }
    if (resultVal !== null && !Number.isNaN(numericBoth)) {
      checks.push({ label: "Numerical approach agrees", passed: Number.isFinite(resultVal) ? close(resultVal, numericBoth, 1e-3) : resultVal === numericBoth, detail: Number.isFinite(numericBoth) ? `≈ ${roundSig(numericBoth, 8)}` : String(numericBoth) });
    }
    if (casVal !== null) checks.push({ label: "Computed symbolically", passed: true });
  }
  if (resultVal === null || resultTex === null) throw new MathInputError("The limit could not be determined. It may not exist.");
  steps.push({ title: "Result", latex: `${interpreted} = ${resultTex}` });
  return {
    interpreted,
    category: "limit",
    topic: Number.isFinite(a) ? (side === "both" ? "Limit" : "One-sided limit") : "Limit at infinity",
    answer: { latex: resultTex, text: Number.isFinite(resultVal) ? numText(resultVal) : resultVal > 0 ? "∞" : "-∞", decimal: Number.isFinite(resultVal) ? roundSig(resultVal, 10) : undefined },
    steps,
    formulas,
    explanation: "Start with direct substitution. If it gives an indeterminate form like 0/0, simplify (factor and cancel, rationalize) or apply L'Hôpital's rule; at infinity compare dominant terms.",
    verification: verificationFrom(checks),
    graph: v === "x" ? { expressions: [toStr(node)], xRange: Number.isFinite(a) ? [a - 5, a + 5] : undefined } : undefined,
  };
}
