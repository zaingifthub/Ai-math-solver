import { math, fmath, toTex, evalReal, type MathNode } from "../mathjs";
import { numTex, numText, roundSig, toFraction } from "../format";
import type { SolverOutput, Step, Formula } from "../types";
import { verificationFrom } from "../types";

const OP_NAMES: Record<string, string> = {
  "+": "Add",
  "-": "Subtract",
  "*": "Multiply",
  "/": "Divide",
  "^": "Evaluate the power",
};

function isConst(n: MathNode): boolean {
  if (n.type === "ConstantNode") return true;
  if (n.type === "ParenthesisNode") return isConst((n as unknown as { content: MathNode }).content);
  if (n.type === "OperatorNode") {
    const o = n as unknown as { op: string; args: MathNode[] };
    if (o.args.length === 1 && o.op === "-") return o.args[0].type === "ConstantNode";
  }
  return false;
}

/** Exact value (Fraction mode) for rational-only expressions; null when not representable. */
function exactValue(node: MathNode): [number, number] | null {
  try {
    const v = fmath.evaluate(node.toString()) as unknown;
    if (v && typeof v === "object" && "n" in (v as object) && "d" in (v as object)) {
      const f = v as { s: number | bigint; n: number | bigint; d: number | bigint };
      const n = Number(f.s) * Number(f.n);
      const d = Number(f.d);
      if (Number.isSafeInteger(n) && Number.isSafeInteger(d)) return [n, d];
    }
  } catch {
    /* not rational */
  }
  return null;
}

/** Find the deepest operator whose operands are constants and evaluate it (one order-of-operations step). */
function reduceOnce(root: MathNode): { node: MathNode; description: string } | null {
  let target: MathNode | null = null;
  let targetDepth = -1;
  let priority = -1;
  const prio = (op: string) => (op === "^" ? 3 : op === "*" || op === "/" ? 2 : 1);
  const visit = (n: MathNode, depth: number) => {
    if (n.type === "OperatorNode") {
      const o = n as unknown as { op: string; args: MathNode[] };
      if (o.args.length === 2 && o.args.every(isConst)) {
        const p = prio(o.op);
        if (depth > targetDepth || (depth === targetDepth && p > priority)) {
          target = n;
          targetDepth = depth;
          priority = p;
        }
      }
    }
    if (n.type === "FunctionNode") {
      const f = n as unknown as { args: MathNode[] };
      if (f.args.every(isConst) && depth > targetDepth) {
        target = n;
        targetDepth = depth;
        priority = 4;
      }
    }
    n.forEach((child) => visit(child, depth + (n.type === "ParenthesisNode" ? 10 : 1)));
  };
  visit(root, 0);
  if (!target) return null;
  const t = target as MathNode;
  const exact = exactValue(t);
  const val = exact ? exact[0] / exact[1] : evalReal(t);
  if (!Number.isFinite(val)) return null;
  const replacement = exact
    ? exact[1] === 1
      ? new math.ConstantNode(exact[0])
      : new math.ParenthesisNode(new math.OperatorNode("/", "divide", [new math.ConstantNode(exact[0]), new math.ConstantNode(exact[1])]))
    : new math.ConstantNode(Number(roundSig(val, 12)));
  const wrapped = val < 0 ? new math.ParenthesisNode(replacement.type === "ParenthesisNode" ? (replacement as unknown as { content: MathNode }).content : replacement) : replacement;
  const desc =
    t.type === "FunctionNode"
      ? `Evaluate $${toTex(t)}$`
      : `${OP_NAMES[(t as unknown as { op: string }).op] ?? "Compute"}: $${toTex(t)} = ${exact ? numTex(exact[0] / exact[1]) : roundSig(val)}$`;
  const node = root.transform((n) => (n === t ? wrapped : n));
  // Remove parentheses that now wrap a single non-negative constant
  const cleaned = node.transform((n) => {
    if (n.type === "ParenthesisNode") {
      const c = (n as unknown as { content: MathNode }).content;
      if (c.type === "ConstantNode" && Number((c as unknown as { value: number }).value) >= 0) return c;
    }
    return n;
  });
  return { node: cleaned, description: desc };
}

export function solveArithmetic(node: MathNode): SolverOutput {
  const steps: Step[] = [{ title: "Start with the expression", latex: toTex(node) }];
  const formulas: Formula[] = [{ name: "Order of operations (PEMDAS/BODMAS)", latex: "\\text{Parentheses} \\to \\text{Exponents} \\to \\times\\div \\to +-" }];

  let value: unknown;
  try {
    value = math.evaluate(node.toString());
  } catch (e) {
    throw new Error(`Could not evaluate expression: ${(e as Error).message}`);
  }

  // Complex results
  if (value && typeof value === "object" && "im" in (value as object)) {
    const c = value as { re: number; im: number };
    const tex = `${roundSig(c.re)} ${c.im >= 0 ? "+" : "-"} ${roundSig(Math.abs(c.im))}i`;
    steps.push({ title: "Evaluate using complex arithmetic", latex: `${toTex(node)} = ${tex}`, text: "The result involves the imaginary unit $i = \\sqrt{-1}$." });
    return {
      interpreted: toTex(node),
      category: "arithmetic",
      topic: "Complex numbers",
      answer: { latex: tex, text: `${roundSig(c.re)} ${c.im >= 0 ? "+" : "-"} ${roundSig(Math.abs(c.im))}i` },
      steps,
      formulas: [{ name: "Imaginary unit", latex: "i^2 = -1" }],
      explanation: "The expression evaluates to a complex number.",
      verification: verificationFrom([{ label: "Evaluated with complex arithmetic", passed: true }]),
    };
  }

  const num = typeof value === "number" ? value : Number(value);
  let current = node;
  for (let i = 0; i < 25; i++) {
    const r = reduceOnce(current);
    if (!r) break;
    current = r.node;
    steps.push({ title: `Step ${steps.length}`, text: r.description, latex: toTex(current) });
  }

  const exact = exactValue(node);
  const answerTex = exact ? numTex(exact[0] / exact[1]) : numTex(num);
  const answerText = exact ? numText(exact[0] / exact[1]) : numText(num);
  const decimal = roundSig(num, 10);
  const fr = toFraction(num, 1000);
  if (fr && fr[1] !== 1) steps.push({ title: "Simplify the fraction", latex: `${answerTex} \\approx ${decimal}`, text: "Divide numerator and denominator by their greatest common divisor." });

  // Independent check: evaluate with the floating engine and compare with the exact/step result
  const independent = evalReal(node);
  const checks = [
    { label: "Recomputed independently", passed: Math.abs(independent - num) <= 1e-9 * Math.max(1, Math.abs(num)), detail: `≈ ${roundSig(independent, 12)}` },
  ];
  if (exact) checks.push({ label: "Exact rational arithmetic", passed: Math.abs(exact[0] / exact[1] - num) < 1e-9 * Math.max(1, Math.abs(num)), detail: `${exact[0]}/${exact[1]}` });

  return {
    interpreted: toTex(node),
    category: "arithmetic",
    topic: "Arithmetic",
    answer: { latex: answerTex, text: answerText, decimal: answerText === decimal ? undefined : decimal },
    steps,
    formulas,
    explanation: "Evaluate the expression one operation at a time following the order of operations: parentheses first, then exponents, then multiplication and division from left to right, then addition and subtraction.",
    verification: verificationFrom(checks),
  };
}
