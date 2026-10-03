import { math, KNOWN_FUNCTIONS, KNOWN_CONSTANTS, GREEK, toStr, type MathNode } from "./mathjs";

/**
 * Input normalization: converts Unicode math, LaTeX and common handwriting-style
 * notation into canonical mathjs syntax.
 *
 * Conventions: `ln` → natural log (`log`), bare `log` → base-10 (`log10`),
 * `log_b(x)` → `log(x, b)`.
 */

const SUPERSCRIPTS: Record<string, string> = {
  "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9", "⁻": "-", "ⁿ": "n",
};
const SUBSCRIPTS: Record<string, string> = {
  "₀": "0", "₁": "1", "₂": "2", "₃": "3", "₄": "4", "₅": "5", "₆": "6", "₇": "7", "₈": "8", "₉": "9",
};
const VULGAR: Record<string, string> = {
  "½": "(1/2)", "⅓": "(1/3)", "⅔": "(2/3)", "¼": "(1/4)", "¾": "(3/4)", "⅕": "(1/5)", "⅛": "(1/8)",
};
const UNICODE: [RegExp, string][] = [
  [/[×·∙⋅]/g, "*"],
  [/÷/g, "/"],
  [/[−–—]/g, "-"],
  [/∛/g, "cbrt"],
  [/√/g, "sqrt"],
  [/π/g, "pi"],
  [/θ/g, "theta"],
  [/α/g, "alpha"],
  [/β/g, "beta"],
  [/λ/g, "lambda"],
  [/μ/g, "mu"],
  [/σ/g, "sigma"],
  [/Δ/g, "Delta"],
  [/≤|⩽/g, "<="],
  [/≥|⩾/g, ">="],
  [/≠/g, "!="],
  [/∞/g, "Infinity"],
  [/→/g, "->"],
  [/∫/g, " integrate "],
  [/[“”]/g, '"'],
  [/[‘’]/g, "'"],
];

/** Find the index of the bracket matching the one at `open`. */
export function matchBracket(s: string, open: number, o = "(", c = ")"): number {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    if (s[i] === o) depth++;
    else if (s[i] === c) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Read a LaTeX group `{...}` (or single token) starting at index i. Returns [content, nextIndex]. */
function readGroup(s: string, i: number): [string, number] {
  while (s[i] === " ") i++;
  if (s[i] === "{") {
    const end = matchBracket(s, i, "{", "}");
    if (end === -1) return [s.slice(i + 1), s.length];
    return [s.slice(i + 1, end), end + 1];
  }
  if (s[i] === "\\") {
    const m = /^\\[a-zA-Z]+/.exec(s.slice(i));
    if (m) return [m[0], i + m[0].length];
  }
  return [s[i] ?? "", i + 1];
}

/** Convert LaTeX markup to plain mathjs-ish syntax. */
export function latexToPlain(input: string): string {
  let s = input;
  s = s.replace(/\\(?:left|right|big|Big|bigg|Bigg)\s*([()[\]|.])/g, (_m, b) => (b === "." ? "" : b));
  s = s.replace(/\\left\\\{|\\right\\\}/g, "");
  s = s.replace(/\\(?:displaystyle|limits|nolimits|,|;|:|!|quad|qquad)/g, " ");
  s = s.replace(/\\(?:text|mathrm|mathit|operatorname|mathbf)\s*\{([^}]*)\}/g, "$1");
  s = s.replace(/\\begin\{[pbvBV]?matrix\}([\s\S]*?)\\end\{[pbvBV]?matrix\}/g, (_m, body: string) => {
    const rows = body
      .split(/\\\\/)
      .map((r) => r.trim())
      .filter(Boolean)
      .map((r) => `[${r.split("&").map((c) => latexToPlain(c.trim())).join(",")}]`);
    return `[${rows.join(",")}]`;
  });
  // \frac{d}{dx} → derivative marker
  s = s.replace(/\\frac\s*\{\s*d\^?\{?(\d)?\}?\s*\}\s*\{\s*d\s*([a-z])\^?\{?\d?\}?\s*\}/g, (_m, ord, v) =>
    ord && ord !== "1" ? ` derivative${ord}_${v} ` : ` d/d${v} `,
  );
  // \frac, \dfrac, \tfrac
  let guard = 0;
  while (/\\[dt]?frac/.test(s) && guard++ < 200) {
    const m = /\\[dt]?frac/.exec(s)!;
    const [num, i1] = readGroup(s, m.index + m[0].length);
    const [den, i2] = readGroup(s, i1);
    s = `${s.slice(0, m.index)}((${num})/(${den}))${s.slice(i2)}`;
  }
  guard = 0;
  while (/\\sqrt/.test(s) && guard++ < 200) {
    const m = /\\sqrt/.exec(s)!;
    let i = m.index + m[0].length;
    let index: string | null = null;
    if (s[i] === "[") {
      const end = s.indexOf("]", i);
      index = s.slice(i + 1, end);
      i = end + 1;
    }
    const [rad, next] = readGroup(s, i);
    s = `${s.slice(0, m.index)}${index ? `nthRoot(${rad}, ${index})` : `sqrt(${rad})`}${s.slice(next)}`;
  }
  // \lim_{x \to a}
  s = s.replace(/\\lim_\s*\{\s*([a-z])\s*(?:\\to|\\rightarrow|->)\s*([^}]*)\}/g, (_m, v, a) => ` limit as ${v}->${a} of `);
  // \int_{a}^{b}
  s = s.replace(/\\int_\s*\{?([^}^\s]*)\}?\s*\^\s*\{?([^}\s]*)\}?/g, (_m, a, b) => ` integrate_from_${a}_to_${b} `);
  s = s.replace(/\\int/g, " integrate ");
  s = s.replace(/\\log_\s*\{([^}]*)\}/g, "log_$1").replace(/\\log_\s*(\d+)/g, "log_$1");
  const commands: Record<string, string> = {
    cdot: "*", times: "*", div: "/", pi: "pi", theta: "theta", alpha: "alpha", beta: "beta", lambda: "lambda", mu: "mu",
    sigma: "sigma", infty: "Infinity", le: "<=", leq: "<=", ge: ">=", geq: ">=", neq: "!=", ne: "!=", to: "->",
    rightarrow: "->", pm: "+-", ln: "ln", log: "log", exp: "exp", sin: "sin", cos: "cos", tan: "tan", sec: "sec",
    csc: "csc", cot: "cot", arcsin: "asin", arccos: "acos", arctan: "atan", sinh: "sinh", cosh: "cosh", tanh: "tanh",
    lt: "<", gt: ">", degree: "deg", circ: "deg", cdots: "", ldots: "",
  };
  s = s.replace(/\\([a-zA-Z]+)/g, (_m, cmd: string) => (cmd in commands ? ` ${commands[cmd]} ` : cmd));
  // Exponent / subscript groups
  s = s.replace(/\^\s*\{([^{}]*)\}/g, "^($1)");
  s = s.replace(/_\s*\{([^{}]*)\}/g, "_$1");
  s = s.replace(/[{}]/g, (b) => (b === "{" ? "(" : ")"));
  s = s.replace(/\bd([a-z])\b(?=\s*$)/, " d$1");
  return s.replace(/\s+/g, " ").trim();
}

/** Replace |...| absolute value bars with abs(...). */
export function convertAbsBars(s: string): string {
  if (!s.includes("|")) return s;
  let out = "";
  const stack: number[] = [];
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch !== "|") {
      out += ch;
      continue;
    }
    const prev = out.trimEnd().slice(-1);
    const opens = stack.length === 0 || prev === "" || /[+\-*/^(,=<>]/.test(prev);
    if (opens) {
      stack.push(out.length);
      out += "abs(";
    } else {
      stack.pop();
      out += ")";
    }
  }
  return out;
}

/** Wrap function calls whose argument has no parentheses: `sin x` → `sin(x)`, `sin^2 x` → `sin(x)^2`. */
function fixFunctionCalls(s: string): string {
  const fns = "sin|cos|tan|sec|csc|cot|asin|acos|atan|sinh|cosh|tanh|ln|log10|log|sqrt|cbrt|exp";
  // sin^2(x) / sin^2 x → (sin(x))^2
  s = s.replace(new RegExp(`\\b(${fns})\\s*\\^\\s*\\(?(\\d+)\\)?\\s*`, "g"), (_m, fn, p) => `${fn}__POW${p}__ `);
  s = s.replace(new RegExp(`\\b(${fns})(__POW\\d+__)?\\s+(?!\\()([a-zA-Z0-9.]+(?:\\^[a-zA-Z0-9.]+)?)`, "g"), (_m, fn, pow, arg) => `${fn}${pow ?? ""}(${arg})`);
  let guard = 0;
  while (s.includes("__POW") && guard++ < 50) {
    const m = /([a-z0-9]+)__POW(\d+)__\s*\(/.exec(s);
    if (!m) {
      s = s.replace(/__POW(\d+)__/g, "^$1");
      break;
    }
    const open = m.index + m[0].length - 1;
    const close = matchBracket(s, open);
    if (close === -1) break;
    s = `${s.slice(0, m.index)}(${m[1]}${s.slice(open, close + 1)})^${m[2]}${s.slice(close + 1)}`;
  }
  return s;
}

/** Convert log_b(x) → log(x, b) and log(x) → log10(x), ln(x) → log(x). */
function fixLogs(s: string): string {
  let guard = 0;
  while (guard++ < 50) {
    const m = /\blog_\(?([a-zA-Z0-9.]+)\)?\s*\(/.exec(s);
    if (!m) break;
    const open = m.index + m[0].length - 1;
    const close = matchBracket(s, open);
    if (close === -1) break;
    s = `${s.slice(0, m.index)}LOGB(${s.slice(open + 1, close)}, ${m[1]})${s.slice(close + 1)}`;
  }
  s = s.replace(/\blog_([0-9]+)\s+([a-zA-Z0-9.]+)/g, "LOGB($2, $1)");
  s = s.replace(/\blog\s*\(/g, "log10(");
  s = s.replace(/\bln\s*\(/g, "log(");
  return s.replace(/LOGB\(/g, "log(");
}

/** Text-level normalization (does not parse). */
export function normalizeText(raw: string): string {
  let s = raw;
  for (const [k, v] of Object.entries(VULGAR)) s = s.split(k).join(v);
  s = s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻ⁿ]+/g, (m) => `^(${[...m].map((c) => SUPERSCRIPTS[c]).join("")})`);
  s = s.replace(/[₀₁₂₃₄₅₆₇₈₉]+/g, (m) => `_${[...m].map((c) => SUBSCRIPTS[c]).join("")}`);
  s = s.normalize("NFKC");
  for (const [re, rep] of UNICODE) s = s.replace(re, rep);
  if (s.includes("\\")) s = latexToPlain(s);
  s = s.replace(/\*\*/g, "^");
  // mathjs would read 0x / 0b / 0o as hex/binary/octal literals
  s = s.replace(/(^|[^\d.\w])0([xbo])/g, "$10*$2");
  s = s.replace(/(\d)\s*°/g, "$1 deg").replace(/°/g, " deg");
  s = convertAbsBars(s);
  s = fixLogs(s);
  s = s.replace(/\b(sqrt|cbrt)\s*(\d+(?:\.\d+)?|[a-z](?![a-z(]))/g, "$1($2)");
  s = fixFunctionCalls(s);
  // Percentages: "20% of 50" → (20/100)*50 ; "15%" → (15/100)
  s = s.replace(/(\d+(?:\.\d+)?)\s*%\s*of\s*/gi, "($1/100)*");
  s = s.replace(/(\d+(?:\.\d+)?)\s*%(?!\s*\d)/g, "($1/100)");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

function isSingleLetterVariable(name: string) {
  return /^[a-zA-Z]$/.test(name);
}

/** Split implicit products of single letters ("xy" → x*y) unless the name is known. */
function splitSymbol(name: string): MathNode | null {
  if (name.length < 2 || !/^[a-z]+$/.test(name)) return null;
  if (KNOWN_CONSTANTS.has(name) || KNOWN_FUNCTIONS.has(name) || GREEK.has(name)) return null;
  // Allow embedded greek/constant names e.g. "pix" → pi*x, "xpi"
  const tokens: string[] = [];
  let rest = name;
  outer: while (rest.length) {
    for (const known of ["theta", "alpha", "beta", "lambda", "sigma", "pi"]) {
      if (rest.startsWith(known)) {
        tokens.push(known);
        rest = rest.slice(known.length);
        continue outer;
      }
    }
    tokens.push(rest[0]);
    rest = rest.slice(1);
  }
  let node: MathNode = new math.SymbolNode(tokens[0]);
  for (const t of tokens.slice(1)) node = new math.OperatorNode("*", "multiply", [node, new math.SymbolNode(t)]);
  return node;
}

/** AST fixups for student-style notation. */
export function fixAst(node: MathNode): MathNode {
  return node.transform((n) => {
    if (n.type === "FunctionNode") {
      const fn = n as unknown as { fn: { name?: string }; args: MathNode[] };
      const name = fn.fn?.name;
      // x(x+1) → x*(x+1) when x is not a known function
      if (name && !KNOWN_FUNCTIONS.has(name) && fn.args.length === 1 && (isSingleLetterVariable(name) || splitSymbol(name))) {
        const left = splitSymbol(name) ?? new math.SymbolNode(name);
        return new math.OperatorNode("*", "multiply", [fixAst(left), new math.ParenthesisNode(fixAst(fn.args[0]))]);
      }
    }
    if (n.type === "SymbolNode") {
      const name = (n as unknown as { name: string }).name;
      const split = splitSymbol(name);
      if (split) return split;
    }
    return n;
  });
}

/** Parse a normalized expression string into a fixed-up AST. */
export function parseExpr(expr: string): MathNode {
  const node = math.parse(expr.replace(/\+-/g, "+ -"));
  return fixAst(node);
}

/** Parse and return the canonical explicit string form. */
export function canonical(expr: string): string {
  return toStr(parseExpr(expr));
}

export type Relation = "=" | "<" | ">" | "<=" | ">=" | "!=";

/** Split "lhs op rhs" at the top level. Returns null if there is no relation operator. */
export function splitRelation(s: string): { lhs: string; rhs: string; op: Relation }[] | null {
  const parts: string[] = [];
  const ops: Relation[] = [];
  let depth = 0;
  let last = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth--;
    if (depth !== 0) continue;
    const two = s.slice(i, i + 2);
    let op: Relation | null = null;
    if (two === "<=" || two === ">=" || two === "!=" || two === "==") op = (two === "==" ? "=" : two) as Relation;
    else if (ch === "=" || ch === "<" || ch === ">") {
      if (s[i + 1] === ">" || s[i - 1] === "-") continue; // "->" arrow
      op = ch as Relation;
    }
    if (op) {
      parts.push(s.slice(last, i));
      ops.push(op);
      i += op.length === 2 || two === "==" ? 1 : 0;
      last = i + 1;
    }
  }
  if (!ops.length) return null;
  parts.push(s.slice(last));
  const out: { lhs: string; rhs: string; op: Relation }[] = [];
  for (let k = 0; k < ops.length; k++) out.push({ lhs: parts[k].trim(), rhs: parts[k + 1].trim(), op: ops[k] });
  return out;
}
