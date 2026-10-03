import { create, all, type MathNode, type MathJsInstance } from "mathjs";

/** Shared mathjs instance (floating point). */
export const math: MathJsInstance = create(all, {});

/** Fraction-mode instance used for exact rational arithmetic. */
export const fmath: MathJsInstance = create(all, { number: "Fraction" });

export const KNOWN_FUNCTIONS = new Set([
  "sin", "cos", "tan", "sec", "csc", "cot",
  "asin", "acos", "atan", "asec", "acsc", "acot", "atan2",
  "sinh", "cosh", "tanh", "asinh", "acosh", "atanh",
  "log", "log10", "log2", "exp", "sqrt", "cbrt", "nthRoot", "abs", "sign",
  "floor", "ceil", "round", "factorial", "gamma", "min", "max", "mod",
  "gcd", "lcm", "combinations", "permutations", "det", "inv", "transpose",
  "mean", "median", "std", "variance", "sum", "prod", "derivative", "pow", "re", "im", "conj", "arg",
]);

export const KNOWN_CONSTANTS = new Set(["e", "pi", "i", "Infinity", "NaN", "true", "false", "phi", "tau"]);

export const GREEK = new Set([
  "alpha", "beta", "gamma", "delta", "epsilon", "theta", "lambda", "mu", "sigma", "omega", "rho", "tau", "phi", "psi", "eta", "kappa", "nu", "xi", "zeta", "chi",
]);

export function parse(expr: string): MathNode {
  return math.parse(expr);
}

/** Collect free variable names of an expression (excluding constants and function names). */
export function variablesOf(node: MathNode): string[] {
  const vars = new Set<string>();
  node.traverse((n, _path, parent) => {
    if ((n as MathNode & { isSymbolNode?: boolean }).type === "SymbolNode") {
      const name = (n as unknown as { name: string }).name;
      const isFnName =
        parent && parent.type === "FunctionNode" && (parent as unknown as { fn: MathNode }).fn === n;
      if (!isFnName && !KNOWN_CONSTANTS.has(name)) vars.add(name);
    }
  });
  return [...vars].sort();
}

/** Preferred variable ordering when several unknowns are present. */
export function pickVariable(vars: string[]): string | undefined {
  for (const v of ["x", "y", "t", "z", "n", "theta", "a", "b"]) if (vars.includes(v)) return v;
  return vars[0];
}

export function toTex(expr: string | MathNode): string {
  try {
    const node = typeof expr === "string" ? math.parse(expr) : expr;
    return node
      .toTex({ parenthesis: "auto", implicit: "hide" })
      .replace(/\\mathrm\{([a-zA-Z])\}/g, "$1")
      .replace(/\\cdot\s*\\left\(/g, "\\left(")
      .replace(/(\d)\s*\\cdot\s*(?=[a-zA-Z{(]|\\(?!frac|cdot|left))/g, "$1")
      .replace(/\{\s+/g, "{");
  } catch {
    return String(expr);
  }
}

/** Canonical plain-text form with explicit multiplication. */
export function toStr(node: MathNode): string {
  return node.toString({ implicit: "show", parenthesis: "auto" });
}

export function compile(expr: string | MathNode) {
  const node = typeof expr === "string" ? math.parse(expr) : expr;
  return node.compile();
}

/** Evaluate an expression numerically; returns NaN for non-real or failing evaluations. */
export function evalReal(expr: string | MathNode, scope: Record<string, number> = {}): number {
  try {
    const v = compile(expr).evaluate({ ...scope });
    if (typeof v === "number") return v;
    if (v && typeof v === "object" && "re" in v && "im" in v) {
      const c = v as { re: number; im: number };
      return Math.abs(c.im) < 1e-10 ? c.re : NaN;
    }
    if (v && typeof (v as { valueOf: () => unknown }).valueOf === "function") {
      const n = Number((v as { valueOf: () => unknown }).valueOf());
      return Number.isFinite(n) ? n : NaN;
    }
    return NaN;
  } catch {
    return NaN;
  }
}
export type { MathNode } from "mathjs";

/** Human-friendly plain text (implicit numeric coefficients, tidy spacing). */
export function tidyText(s: string): string {
  return s
    .replace(/ \^ /g, "^")
    .replace(/(^|[^\^.\d\w])(\d+(?:\.\d+)?) \* (?=[a-zA-Z(])/g, "$1$2")
    .replace(/(?<![a-zA-Z])log\(/g, "ln(")
    .replace(/(?<![a-zA-Z])log10\(/g, "log(")
    .replace(/\+ -/g, "- ")
    .replace(/\s+/g, " ")
    .trim();
}
