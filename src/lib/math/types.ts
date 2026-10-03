/**
 * Shared types for the math engine.
 *
 * Pipeline: input → normalize → classify → solver (exact engine) → verification
 *           → (optional) AI explanation layer → response
 */

export type Category =
  | "arithmetic"
  | "algebra"
  | "equation"
  | "polynomial"
  | "system"
  | "inequality"
  | "function"
  | "exponent"
  | "logarithm"
  | "trigonometry"
  | "geometry"
  | "derivative"
  | "integral"
  | "limit"
  | "statistics"
  | "probability"
  | "matrix"
  | "vector"
  | "units"
  | "word-problem";

export interface Step {
  title: string;
  /** Display-mode LaTeX for this step. */
  latex?: string;
  /** Plain-language explanation (may contain inline $...$ LaTeX). */
  text?: string;
}

export interface Formula {
  name: string;
  latex: string;
}

export type CheckStatus = "verified" | "partially-verified" | "unverified";

export interface VerificationCheck {
  label: string;
  passed: boolean;
  detail?: string;
}

export interface Verification {
  status: CheckStatus;
  checks: VerificationCheck[];
}

export interface Answer {
  latex: string;
  text: string;
  decimal?: string;
}

export interface GraphSpec {
  expressions: string[];
  points?: { x: number; y: number; label?: string }[];
  xRange?: [number, number];
}

export interface AIEnhancement {
  explanation: string;
  alternative?: string;
  tips?: string[];
  commonMistakes?: string[];
  model?: string;
}

export interface SolveResult {
  id?: string;
  input: string;
  /** LaTeX of the problem as the engine understood it. */
  interpreted: string;
  category: Category;
  topic: string;
  answer: Answer;
  steps: Step[];
  formulas: Formula[];
  explanation: string;
  verification: Verification;
  alternative?: { title: string; steps: Step[] };
  similar?: { problem: string; answer: string };
  graph?: GraphSpec;
  restrictions?: string[];
  warnings?: string[];
  engine: { method: string; durationMs: number };
  ai?: AIEnhancement;
}

/** The part of a result a solver is responsible for producing. */
export type SolverOutput = Omit<SolveResult, "input" | "engine" | "verification" | "similar"> & {
  verification?: Verification;
};

export class MathInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MathInputError";
  }
}

export function verificationFrom(checks: VerificationCheck[]): Verification {
  if (checks.length === 0) return { status: "unverified", checks };
  const passed = checks.filter((c) => c.passed).length;
  return {
    status: passed === checks.length ? "verified" : passed > 0 ? "partially-verified" : "unverified",
    checks,
  };
}
