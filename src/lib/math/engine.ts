/**
 * Math engine orchestrator.
 *
 *   input → normalize → classify → solver (exact/symbolic) → verification → result
 *
 * The AI layer (src/lib/ai) only explains results produced here; it never
 * decides the final answer.
 */
import { math, toTex, toStr, evalReal, tidyText } from "./mathjs";
import { classify, type Intent } from "./classify";
import { CAS, toCas } from "./cas";
import { roundSig } from "./format";
import { generateProblem, practiceTopicFor } from "./generator";
import { MathInputError, verificationFrom, type SolveResult, type SolverOutput } from "./types";
import { solveArithmetic } from "./solvers/arithmetic";
import { solveEquation } from "./solvers/equation";
import { solveSystem } from "./solvers/system";
import { solveInequality } from "./solvers/inequality";
import { solveDerivative, solveImplicit } from "./solvers/derivative";
import { solveIntegral } from "./solvers/integral";
import { solveLimit } from "./solvers/limit";
import { solveMatrix, parseMatrixLiteral } from "./solvers/matrix";
import { solveVector } from "./solvers/vector";
import { solveStatistics } from "./solvers/statistics";
import { solveProbability } from "./solvers/probability";
import { solveGeometry } from "./solvers/geometry";
import { solveUnits } from "./solvers/units";
import { solveSimplify, solveEvaluateAt, solveFunction } from "./solvers/algebra";
import { parseExpr } from "./normalize";
import { bestForm } from "./pretty";

export const MAX_INPUT_LENGTH = 2000;

export class WordProblemError extends MathInputError {
  constructor(public text: string) {
    super("This looks like a word problem. AI translation is required to convert it into math.");
    this.name = "WordProblemError";
  }
}

export interface SolveOptions {
  /** Translates a natural-language word problem into an engine-solvable input (AI). */
  translateWordProblem?: (text: string) => Promise<{ input: string; setup?: string } | null>;
  includeSimilar?: boolean;
}

async function solveLiteral(lhs: string, rhs: string, v: string): Promise<SolverOutput> {
  const sols = await CAS.solve(`${toCas(lhs)}=${toCas(rhs)}`, v);
  if (!sols || !sols.length) throw new MathInputError(`Could not isolate ${v} in this equation.`);
  const eqTex = `${toTex(lhs)} = ${toTex(rhs)}`;
  const forms = await Promise.all(sols.map((s) => bestForm(s)));
  const answers = forms.map((f) => `${v} = ${toTex(f)}`);
  // verify by substituting random values for the other variables
  const L = math.parse(`(${lhs}) - (${rhs})`);
  const others = [...new Set(L.toString().match(/\b[a-zA-Z]\b/g) ?? [])].filter((x) => x !== v && x !== "e" && x !== "i");
  const scope = Object.fromEntries(others.map((o, i) => [o, 1.37 + i * 0.83]));
  const checks = sols.map((s) => {
    const val = evalReal(s, scope);
    const res = evalReal(L, { ...scope, [v]: val });
    return { label: `Substitute ${v} = ${s} back (random test values)`, passed: Number.isFinite(res) && Math.abs(res) < 1e-7 * Math.max(1, Math.abs(val)) };
  });
  return {
    interpreted: eqTex,
    category: "equation",
    topic: "Literal equation (solve for a variable)",
    answer: { latex: answers.join(",\\quad "), text: forms.map((f) => `${v} = ${toStr(f)}`).join(", ") },
    steps: [
      { title: "Write the equation", latex: eqTex },
      { title: `Isolate ${v}`, text: `Treat every other letter as a constant and use inverse operations to get $${v}$ alone.` },
      { title: "Result", latex: answers.join(",\\quad ") },
    ],
    formulas: [{ name: "Inverse operations", latex: "\\text{do the same operation to both sides}" }],
    explanation: `Solving a literal equation means rearranging a formula so that $${v}$ is expressed in terms of the other variables.`,
    verification: verificationFrom(checks),
  };
}

function solveTruth(lhs: string, rhs: string, op: string): SolverOutput {
  const a = evalReal(lhs);
  const b = evalReal(rhs);
  const truth = op === "=" ? Math.abs(a - b) < 1e-9 * Math.max(1, Math.abs(a)) : op === "<" ? a < b : op === ">" ? a > b : op === "<=" ? a <= b : op === ">=" ? a >= b : a !== b;
  return {
    interpreted: `${toTex(lhs)} ${op} ${toTex(rhs)}`,
    category: "arithmetic",
    topic: "Checking a statement",
    answer: { latex: truth ? "\\text{True}" : "\\text{False}", text: truth ? "True" : "False" },
    steps: [
      { title: "Evaluate the left side", latex: `${toTex(lhs)} = ${roundSig(a, 12)}` },
      { title: "Evaluate the right side", latex: `${toTex(rhs)} = ${roundSig(b, 12)}` },
      { title: "Compare", text: `The statement is **${truth ? "true" : "false"}**.` },
    ],
    formulas: [],
    explanation: "Evaluate each side separately and compare the values.",
    verification: verificationFrom([{ label: "Both sides evaluated numerically", passed: Number.isFinite(a) && Number.isFinite(b) }]),
  };
}

async function dispatch(intent: Intent, opts: SolveOptions): Promise<SolverOutput> {
  switch (intent.type) {
    case "arithmetic":
      return solveArithmetic(parseExpr(intent.expr));
    case "simplify":
    case "expand":
    case "factor":
      return solveSimplify(intent.expr, intent.type);
    case "equation":
      return solveEquation(intent.lhs, intent.rhs, intent.variable);
    case "literal":
      return solveLiteral(intent.lhs, intent.rhs, intent.variable);
    case "truth":
      return solveTruth(intent.lhs, intent.rhs, intent.op);
    case "system":
      return solveSystem(intent.equations);
    case "inequality":
      return solveInequality(intent.lhs, intent.op, intent.rhs, intent.variable);
    case "derivative":
      return solveDerivative({ expr: intent.expr, variable: intent.variable, order: intent.order, at: intent.at });
    case "implicit":
      return solveImplicit(intent.lhs, intent.rhs);
    case "integral":
      return solveIntegral({ expr: intent.expr, variable: intent.variable, lower: intent.lower, upper: intent.upper });
    case "limit":
      return solveLimit({ expr: intent.expr, variable: intent.variable, at: intent.at, side: intent.side });
    case "matrix":
      return solveMatrix(intent.op, parseMatrixLiteral(intent.a), intent.b ? parseMatrixLiteral(intent.b) : undefined, intent.power);
    case "vector":
      return solveVector(intent.op, intent.a, intent.b);
    case "statistics":
      return solveStatistics(intent.data, intent.measure);
    case "probability":
      return solveProbability(intent.req);
    case "geometry":
      return solveGeometry(intent.shape, intent.params, intent.unit);
    case "units":
      return solveUnits(intent.value, intent.from, intent.to);
    case "evaluate-at":
      return solveEvaluateAt(intent.expr, intent.scope);
    case "function":
      return solveFunction(intent.expr, intent.task, intent.variable);
    case "word": {
      if (!opts.translateWordProblem) throw new WordProblemError(intent.text);
      const t = await opts.translateWordProblem(intent.text);
      if (!t) throw new MathInputError("We couldn't turn this word problem into an equation. Try writing the math directly, e.g. 2x + 5 = 17.");
      const inner = classify(t.input);
      if (inner.type === "word") throw new MathInputError("We couldn't turn this word problem into an equation. Try writing the math directly.");
      const out = await dispatch(inner, { ...opts, translateWordProblem: undefined });
      return {
        ...out,
        category: "word-problem",
        topic: `Word problem · ${out.topic}`,
        steps: [{ title: "Translate the words into math", text: t.setup ?? "Identify the unknown, assign a variable and write an equation.", latex: out.interpreted }, ...out.steps],
      };
    }
  }
}

/** Rename the solving variable to x so graphs can be plotted on an x-axis. */
function graphVariable(result: SolverOutput): void {
  if (!result.graph) return;
  const exprs = result.graph.expressions
    .map((e) => {
      try {
        const node = math.parse(e);
        const vars = new Set<string>();
        node.traverse((n) => {
          if (n.type === "SymbolNode") vars.add((n as unknown as { name: string }).name);
        });
        ["e", "pi", "i", "Infinity"].forEach((c) => vars.delete(c));
        const fnNames = new Set<string>();
        node.traverse((n) => {
          if (n.type === "FunctionNode") fnNames.add((n as unknown as { fn: { name: string } }).fn.name);
        });
        fnNames.forEach((f) => vars.delete(f));
        if (vars.size > 1) return null;
        const [only] = [...vars];
        if (!only || only === "x") return e;
        return toStr(node.transform((n) => (n.type === "SymbolNode" && (n as unknown as { name: string }).name === only ? new math.SymbolNode("x") : n)));
      } catch {
        return null;
      }
    })
    .filter((e): e is string => !!e);
  result.graph = exprs.length || result.graph.points?.length ? { ...result.graph, expressions: exprs } : undefined;
}

export async function solve(input: string, opts: SolveOptions = {}): Promise<SolveResult> {
  const started = performance.now();
  const trimmed = input.trim();
  if (!trimmed) throw new MathInputError("Please enter a math problem.");
  if (trimmed.length > MAX_INPUT_LENGTH) throw new MathInputError(`Problems are limited to ${MAX_INPUT_LENGTH} characters.`);
  let intent: Intent;
  try {
    intent = classify(trimmed);
  } catch (e) {
    if (e instanceof MathInputError) throw e;
    intent = { type: "word", text: trimmed };
  }
  let out: SolverOutput;
  try {
    out = await dispatch(intent, opts);
  } catch (e) {
    if (e instanceof MathInputError) throw e;
    // Unparseable input that contains real words may still be a word problem
    if (opts.translateWordProblem && intent.type !== "word" && (trimmed.match(/[a-zA-Z]{3,}/g) ?? []).length >= 3) {
      try {
        out = await dispatch({ type: "word", text: trimmed }, opts);
      } catch (inner) {
        if (inner instanceof MathInputError) throw inner;
        throw new MathInputError("Sorry, we couldn't solve this problem. Check the notation and try again.");
      }
    } else {
      throw new MathInputError(`Sorry, we couldn't solve this problem. ${(e as Error).message ?? ""}`.trim());
    }
  }
  graphVariable(out);
  out.answer = { ...out.answer, text: tidyText(out.answer.text) };
  let similar: SolveResult["similar"];
  if (opts.includeSimilar !== false) {
    const topic = practiceTopicFor(out.category, out.topic);
    if (topic) {
      const p = generateProblem(topic, 2);
      similar = { problem: `${p.instruction} $${p.prompt}$`, answer: p.answer.display, input: p.solveInput };
    }
  }
  return {
    ...out,
    input: trimmed,
    verification: out.verification ?? verificationFrom([]),
    similar,
    engine: { method: intent.type, durationMs: Math.round(performance.now() - started) },
  };
}

export { classify };
