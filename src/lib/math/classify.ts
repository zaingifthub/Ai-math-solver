import { math, variablesOf, pickVariable } from "./mathjs";
import { normalizeText, parseExpr, splitRelation, canonical, type Relation } from "./normalize";
import { splitTopLevel } from "./cas";
import type { MatrixOp } from "./solvers/matrix";
import type { VectorOp } from "./solvers/vector";
import type { StatMeasure } from "./solvers/statistics";
import type { ProbabilityRequest } from "./solvers/probability";
import type { Shape } from "./solvers/geometry";
import type { FunctionTask } from "./solvers/algebra";

export type Intent =
  | { type: "arithmetic"; expr: string }
  | { type: "simplify" | "expand" | "factor"; expr: string }
  | { type: "equation"; lhs: string; rhs: string; variable: string }
  | { type: "literal"; lhs: string; rhs: string; variable: string }
  | { type: "truth"; lhs: string; rhs: string; op: Relation }
  | { type: "system"; equations: { lhs: string; rhs: string }[] }
  | { type: "inequality"; lhs: string; op: Relation; rhs: string; variable: string }
  | { type: "derivative"; expr: string; variable: string; order: number; at?: number }
  | { type: "implicit"; lhs: string; rhs: string }
  | { type: "integral"; expr: string; variable: string; lower?: string; upper?: string }
  | { type: "limit"; expr: string; variable: string; at: string; side: "left" | "right" | "both" }
  | { type: "matrix"; op: MatrixOp; a: string; b?: string; power?: number }
  | { type: "vector"; op: VectorOp; a: number[]; b?: number[] }
  | { type: "statistics"; data: number[]; measure: StatMeasure }
  | { type: "probability"; req: ProbabilityRequest }
  | { type: "geometry"; shape: Shape; params: Record<string, number>; unit?: string }
  | { type: "units"; value: number; from: string; to: string }
  | { type: "evaluate-at"; expr: string; scope: Record<string, number> }
  | { type: "function"; expr: string; task: FunctionTask; variable: string }
  | { type: "word"; text: string };

const ORDINALS: Record<string, number> = { second: 2, "2nd": 2, third: 3, "3rd": 3, fourth: 4, "4th": 4, fifth: 5, "5th": 5 };
const NUM = "-?\\d+(?:\\.\\d+)?";
const LENGTH_UNITS = "mm|cm|m|km|in|inches|ft|feet|yd|yards|mi|miles|units";

function cleanCommand(s: string): string {
  return s
    .replace(/[?.!]+\s*$/, "")
    .replace(/^(please\s+)?(can you\s+)?(help me\s+)?/i, "")
    .replace(/^(what is|what's|find|calculate|compute|determine|work out|evaluate|solve)\s*:?\s+(the value of\s+)?/i, "")
    .trim();
}

function numbersIn(s: string): number[] {
  return [...s.matchAll(new RegExp(NUM, "g"))].map((m) => Number(m[0]));
}

function parseVector(s: string): number[] | null {
  const m = /^[<(\[⟨]\s*([^<>()[\]]+?)\s*[>)\]⟩]$/.exec(s.trim());
  if (!m) return null;
  const parts = m[1].split(/[,\s]+/).filter(Boolean).map(Number);
  return parts.length >= 2 && parts.every(Number.isFinite) ? parts : null;
}

function exprOK(s: string): boolean {
  try {
    parseExpr(s);
    return true;
  } catch {
    return false;
  }
}

function canon(s: string): string {
  return canonical(s.trim());
}

function looksLikeWords(s: string): boolean {
  const words = s.match(/[a-zA-Z]{3,}/g) ?? [];
  const mathWords = new Set(["sin", "cos", "tan", "sec", "csc", "cot", "log", "sqrt", "exp", "abs", "pi", "theta", "infinity", "and", "nthroot", "cbrt", "asin", "acos", "atan", "sinh", "cosh", "tanh", "log10"]);
  return words.filter((w) => !mathWords.has(w.toLowerCase())).length >= 3;
}

/** Parse the bound of a limit: supports "0+", "0^+", "0-", "infinity". */
function parseLimitPoint(raw: string): { at: string; side: "left" | "right" | "both" } {
  let at = raw.trim().replace(/\s+/g, "");
  let side: "left" | "right" | "both" = "both";
  if (/\^?\+$/.test(at) && !/^\+?inf/i.test(at) && at.length > 1) {
    side = "right";
    at = at.replace(/\^?\+$/, "");
  } else if (/\^?-$/.test(at) && at.length > 1) {
    side = "left";
    at = at.replace(/\^?-$/, "");
  }
  at = at.replace(/^\+?(inf|infinity|Infinity)$/i, "Infinity").replace(/^-(inf|infinity|Infinity)$/i, "-Infinity");
  return { at, side };
}

export function classify(raw: string): Intent {
  const original = raw.trim();
  let s = normalizeText(original);
  const lower = s.toLowerCase();

  // ── Unit conversion ──
  const unitM = new RegExp(`^(?:convert\\s+)?(${NUM})\\s*([a-zA-Z°/]+(?:\\s*/\\s*[a-zA-Z]+)?)\\s+(?:to|in|into)\\s+([a-zA-Z°/]+(?:\\s*/\\s*[a-zA-Z]+)?)\\s*\\??$`, "i").exec(cleanCommand(s));
  if (unitM && !/^[a-z]$/i.test(unitM[2])) return { type: "units", value: Number(unitM[1]), from: unitM[2].replace(/\s+/g, ""), to: unitM[3].replace(/\s+/g, "") };

  // ── Matrices ──
  if (s.includes("[[")) {
    const mats = [...s.matchAll(/\[\s*\[[^\]]*\](?:\s*,\s*\[[^\]]*\])*\s*\]/g)].map((m) => m[0]);
    if (mats.length) {
      let op: MatrixOp = "evaluate";
      if (/\bdet(erminant)?\b/i.test(lower)) op = "determinant";
      else if (/\binv(erse)?\b|\^\s*\(?-1\)?/i.test(lower)) op = "inverse";
      else if (/transpose|\^\s*t\b/i.test(lower)) op = "transpose";
      else if (/rref|row.?reduc|echelon/i.test(lower)) op = "rref";
      else if (/\brank\b/i.test(lower)) op = "rank";
      else if (/eigen/i.test(lower)) op = "eigenvalues";
      else if (mats.length >= 2) {
        const between = s.slice(s.indexOf(mats[0]) + mats[0].length, s.indexOf(mats[1]));
        op = /\+|plus|add/.test(between) ? "add" : /-|minus|subtract/.test(between) ? "subtract" : "multiply";
      } else {
        const pw = /\]\s*\^\s*\(?(\d+)\)?/.exec(s);
        if (pw) return { type: "matrix", op: "power", a: mats[0], power: Number(pw[1]) };
      }
      return { type: "matrix", op, a: mats[0], b: mats[1] };
    }
  }

  // ── Vectors ──
  const vecRe = /[<⟨(\[]\s*-?\d+(?:\.\d+)?(?:\s*,\s*-?\d+(?:\.\d+)?){1,5}\s*[>⟩)\]]/g;
  const vecs = [...s.matchAll(vecRe)].map((m) => parseVector(m[0])).filter((v): v is number[] => !!v);
  const vecWord = /\b(dot|cross|magnitude|norm|length of|unit vector|angle between|projection|proj|vector)\b/i.exec(lower);
  if (vecs.length && (vecWord || /×|·/.test(original))) {
    const w = lower;
    const op: VectorOp = /cross|×/.test(w + original) ? "cross" : /dot|·/.test(w + original) ? "dot" : /angle/.test(w) ? "angle" : /unit/.test(w) ? "unit" : /proj/.test(w) ? "projection" : /magnitude|norm|length/.test(w) ? "magnitude" : vecs.length >= 2 ? "add" : "magnitude";
    return { type: "vector", op, a: vecs[0], b: vecs[1] };
  }

  // ── Geometry (natural language) ──
  const geo = classifyGeometry(lower);
  if (geo) return geo;

  // ── Probability / counting ──
  let m: RegExpExecArray | null;
  if ((m = /^\s*(\d+)\s*(?:c|choose)\s*(\d+)\s*$/i.exec(cleanCommand(lower))) || (m = /(?:ncr|combinations?|c)\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/i.exec(lower)))
    return { type: "probability", req: { kind: "combination", n: Number(m[1]), r: Number(m[2]) } };
  if ((m = /^\s*(\d+)\s*p\s*(\d+)\s*$/i.exec(cleanCommand(lower))) || (m = /(?:npr|permutations?|p)\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/i.exec(lower)))
    return { type: "probability", req: { kind: "permutation", n: Number(m[1]), r: Number(m[2]) } };
  if ((m = /^\s*(?:what is\s+|compute\s+|evaluate\s+)?(\d+)\s*!\s*\??\s*$/.exec(lower)) || (m = /factorial\s*(?:of)?\s*\(?(\d+)\)?/.exec(lower)))
    return { type: "probability", req: { kind: "factorial", n: Number(m[1]) } };
  if (/binomial|trials?/.test(lower)) {
    const n = /\bn\s*=\s*(\d+)|(\d+)\s*trials/.exec(lower);
    const p = /\bp\s*=\s*(0?\.\d+|1|0|\(\d+\/\d+\))|probability (?:of success )?(?:is |of )?(0?\.\d+)/.exec(lower);
    const k = /\bk\s*=\s*(\d+)|(?:exactly|at most|at least)\s*(\d+)/.exec(lower);
    if (n && p && k) {
      const pv = p[1] ?? p[2];
      return {
        type: "probability",
        req: { kind: "binomial", n: Number(n[1] ?? n[2]), p: Number(math.evaluate(pv)), k: Number(k[1] ?? k[2]), mode: /at most/.test(lower) ? "atMost" : /at least/.test(lower) ? "atLeast" : "exact" },
      };
    }
  }

  // ── Statistics ──
  const statWord = /\b(mean|average|median|mode|range|variance|standard deviation|std ?dev|stdev|quartiles?|iqr|statistics|summary|data set)\b/i.exec(lower);
  const nums = numbersIn(s.replace(/\b(of|the|for|data|set)\b/gi, " "));
  const isPlainList = /^\s*-?\d+(\.\d+)?(\s*[,;\s]\s*-?\d+(\.\d+)?){2,}\s*$/.test(s);
  if ((statWord && nums.length >= 2 && !/[=<>^*/]/.test(s.replace(/^[^:]*:/, ""))) || isPlainList) {
    const w = statWord?.[1].toLowerCase() ?? "summary";
    const measure: StatMeasure = /mean|average/.test(w) ? "mean" : w === "median" ? "median" : w === "mode" ? "mode" : w === "range" ? "range" : /variance/.test(w) ? "variance" : /std|standard/.test(w) ? "std" : /quart|iqr/.test(w) ? "quartiles" : "summary";
    return { type: "statistics", data: nums, measure };
  }

  // ── Limits ──
  s = s.replace(/\blim\b/gi, "limit");
  if ((m = /^limit\s*(?:of\s+)?(.+?)\s+as\s+([a-z])\s*(?:->|approaches|goes to|tends to|→|to)\s*(.+)$/i.exec(cleanCommand(s)))) {
    const { at, side } = parseLimitPoint(m[3].replace(/from the (left|right)/i, ""));
    const sd = /from the left/i.test(m[3]) ? "left" : /from the right/i.test(m[3]) ? "right" : side;
    return { type: "limit", expr: canon(m[1]), variable: m[2], at, side: sd };
  }
  if ((m = /^limit\s*(?:as\s+)?_?\(?([a-z])\s*(?:->|approaches|to|→)\s*([^\s)]+)\)?\s*(?:of\s+)?(.+)$/i.exec(cleanCommand(s)))) {
    const { at, side } = parseLimitPoint(m[2]);
    return { type: "limit", expr: canon(m[3]), variable: m[1], at, side };
  }

  // ── Integrals ──
  if ((m = /integrate_from_([^_]+)_to_(\S+)\s+(.+?)\s*d([a-z])\s*$/.exec(s))) {
    return { type: "integral", expr: canon(m[3]), variable: m[4], lower: m[1].replace(/[()]/g, ""), upper: m[2].replace(/[()]/g, "") };
  }
  const intRe = /^(?:the\s+)?(?:integrate|integral(?:\s+of)?|antiderivative(?:\s+of)?|indefinite integral of|definite integral of)\s+(.+?)(?:\s*,?\s*d([a-z]))?(?:\s+(?:from|between)\s+(\S+)\s+(?:to|and)\s+(\S+))?\s*$/i;
  if ((m = intRe.exec(cleanCommand(s)))) {
    let expr = m[1].trim();
    let variable = m[2];
    const dm = /^(.*?)\s*d([a-z])$/.exec(expr);
    if (dm && !variable) {
      expr = dm[1];
      variable = dm[2];
    }
    const wrt = /(.+?)\s+with respect to\s+([a-z])$/i.exec(expr);
    if (wrt) {
      expr = wrt[1];
      variable = wrt[2];
    }
    const node = parseExpr(expr);
    variable ||= pickVariable(variablesOf(node)) ?? "x";
    return { type: "integral", expr: canon(expr), variable, lower: m[3], upper: m[4] };
  }

  // ── Derivatives ──
  if ((m = /^derivative(\d)_([a-z])\s+(.+)$/.exec(s.trim())) || (m = /^d\^?(\d)\/d([a-z])\^?\d?\s+(.+)$/.exec(s.trim())))
    return { type: "derivative", expr: canon(m[3]), variable: m[2], order: Number(m[1]) };
  if (/\bdy\/dx\b|implicit/i.test(lower)) {
    const rel = splitRelation(s.replace(/^.*?(?:of|for|:|if)\s+/i, "").replace(/\bdy\/dx\b/i, "").replace(/implicit(ly)?\s*(differentiat\w*)?/i, "").trim());
    if (rel && rel.length === 1 && rel[0].op === "=") return { type: "implicit", lhs: canon(rel[0].lhs), rhs: canon(rel[0].rhs) };
  }
  if ((m = /^d\/d([a-z])\s*(.+)$/.exec(s.trim()))) return { type: "derivative", expr: canon(m[2]), variable: m[1], order: 1 };
  const derRe = /^(?:the\s+)?(?:(second|third|fourth|fifth|2nd|3rd|4th|5th)\s+)?(?:partial\s+)?(?:derivative|differentiate|diff)(?:\s+of)?\s+(.+?)(?:\s+(?:with respect to|wrt|w\.r\.t\.?)\s+([a-z]))?(?:\s+(?:at|when)\s+([a-z])\s*=\s*(\S+))?\s*$/i;
  if ((m = derRe.exec(cleanCommand(s)))) {
    let expr = m[2].replace(/^(f|g|y)\s*\(\s*[a-z]\s*\)\s*=\s*/, "").replace(/^y\s*=\s*/, "");
    const node = parseExpr(expr);
    const variable = m[3] ?? pickVariable(variablesOf(node)) ?? "x";
    expr = canon(expr);
    return { type: "derivative", expr, variable, order: m[1] ? ORDINALS[m[1].toLowerCase()] : 1, at: m[5] !== undefined ? Number(math.evaluate(m[5])) : undefined };
  }

  // ── Explicit algebra commands ──
  const cmd = /^(simplify|expand|factor(?:ise|ize)?|multiply out|reduce)\s*:?\s+(.+)$/i.exec(s.replace(/[?.!]+\s*$/, "").trim());
  if (cmd) {
    const type = /expand|multiply/i.test(cmd[1]) ? "expand" : /factor/i.test(cmd[1]) ? "factor" : "simplify";
    return { type, expr: canon(cmd[2]) };
  }

  // ── Function tasks ──
  const fnTask = /^(?:the\s+)?(domain|range|inverse|vertex|intercepts?|zeros|roots|x-intercepts)\s+(?:of\s+)?(?:the\s+)?(?:function\s+)?(.+)$/i.exec(cleanCommand(s));
  if (fnTask) {
    const body = fnTask[2].replace(/^(?:[a-z]\s*\(\s*([a-z])\s*\)|y)\s*=\s*/i, "");
    const node = parseExpr(body);
    const variable = pickVariable(variablesOf(node)) ?? "x";
    const t = fnTask[1].toLowerCase();
    if (/zeros|roots|x-intercepts/.test(t)) return { type: "equation", lhs: canon(body), rhs: "0", variable };
    return { type: "function", expr: canon(body), task: t === "domain" ? "domain" : t === "inverse" ? "inverse" : t === "vertex" ? "vertex" : "intercepts", variable };
  }
  // f(x) = ..., find f(3)  |  evaluate expr at x = 3  |  expr when x = 3
  if ((m = /^(?:[a-z])\s*\(\s*([a-z])\s*\)\s*=\s*(.+?)[,;]\s*(?:find\s+)?[a-z]\s*\(\s*(-?[\d.]+(?:\/\d+)?)\s*\)\s*$/i.exec(s))) {
    return { type: "evaluate-at", expr: canon(m[2]), scope: { [m[1]]: Number(math.evaluate(m[3])) } };
  }
  if ((m = /^(?:evaluate\s+)?(.+?)\s+(?:at|when|for|if)\s+((?:[a-z]\s*=\s*-?[\d./]+\s*(?:,|and)?\s*)+)$/i.exec(s.replace(/[?.!]+\s*$/, "").trim()))) {
    const scope: Record<string, number> = {};
    for (const a of m[2].matchAll(/([a-z])\s*=\s*(-?[\d./]+)/gi)) scope[a[1]] = Number(math.evaluate(a[2]));
    const body = m[1].replace(/^(?:[a-z]\s*\(\s*[a-z]\s*\)|y)\s*=\s*/i, "");
    if (Object.keys(scope).length && exprOK(body)) return { type: "evaluate-at", expr: canon(body), scope };
  }

  // ── Solve for a specific variable ──
  let forVar: string | undefined;
  const forM = /(?:,?\s*(?:solve\s+)?for\s+([a-z])\s*)$/i.exec(s) ?? /^solve\s+for\s+([a-z])\s*[:,]?\s*/i.exec(s);
  if (forM) {
    forVar = forM[1];
    s = s.replace(forM[0], " ").trim();
  }
  s = cleanCommand(s);

  // ── Systems ──
  const eqParts = splitTopLevel(s.replace(/\s+and\s+/gi, ";").replace(/\n/g, ";"), ";").flatMap((p) => {
    const pieces = splitTopLevel(p, ",");
    return pieces.every((q) => q.includes("=")) ? pieces : [p];
  });
  const eqs = eqParts.map((p) => p.trim()).filter(Boolean);
  if (eqs.length >= 2 && eqs.every((e) => (splitRelation(e)?.[0]?.op ?? "") === "=")) {
    return { type: "system", equations: eqs.map((e) => { const r = splitRelation(e)![0]; return { lhs: canon(r.lhs), rhs: canon(r.rhs) }; }) };
  }

  // ── Relations (equations / inequalities) ──
  const rel = splitRelation(s);
  if (rel) {
    if (rel.length === 2 && rel.every((r) => r.op !== "=")) {
      // Compound inequality a < f(x) < b → (f - a)(b - f) > 0
      const [r1, r2] = rel;
      const mid = canon(r1.rhs);
      const v = forVar ?? pickVariable(variablesOf(parseExpr(mid))) ?? "x";
      const strict = r1.op.length === 1 && r2.op.length === 1;
      const asc = r1.op.startsWith("<");
      const lo = canon(asc ? r1.lhs : r2.rhs);
      const hi = canon(asc ? r2.rhs : r1.lhs);
      return { type: "inequality", lhs: `((${mid}) - (${lo})) * ((${hi}) - (${mid}))`, op: strict ? ">" : ">=", rhs: "0", variable: v };
    }
    const { lhs, rhs, op } = rel[0];
    if (!exprOK(lhs) || !exprOK(rhs)) return { type: "word", text: original };
    const L = canon(lhs);
    const R = canon(rhs);
    const vars = [...new Set([...variablesOf(parseExpr(L)), ...variablesOf(parseExpr(R))])];
    if (vars.length === 0) return { type: "truth", lhs: L, rhs: R, op };
    const fnDef = /^([a-z])\s*\(\s*([a-z])\s*\)$/i.exec(lhs.trim());
    if (op === "=" && fnDef && !forVar) return { type: "function", expr: R, task: "analyze", variable: fnDef[2] };
    if (op === "=" && /^y$/.test(lhs.trim()) && vars.every((x) => x === "x" || x === "y") && !variablesOf(parseExpr(R)).includes("y") && !forVar)
      return { type: "function", expr: R, task: "analyze", variable: "x" };
    const v = forVar ?? pickVariable(vars)!;
    if (op === "=") return vars.length > 1 ? { type: "literal", lhs: L, rhs: R, variable: v } : { type: "equation", lhs: L, rhs: R, variable: v };
    return { type: "inequality", lhs: L, op, rhs: R, variable: v };
  }

  // ── Plain expressions ──
  if (!exprOK(s) || looksLikeWords(s)) return { type: "word", text: original };
  const c = canon(s);
  const vars = variablesOf(parseExpr(c));
  if (vars.length === 0) return { type: "arithmetic", expr: c };
  return { type: "simplify", expr: c };
}

function classifyGeometry(s: string): Intent | null {
  const unitM = new RegExp(`\\b(${LENGTH_UNITS})\\b`).exec(s);
  const unit = unitM && unitM[1] !== "units" ? unitM[1].replace("inches", "in").replace("feet", "ft").replace("yards", "yd").replace("miles", "mi") : undefined;
  const num = (re: RegExp) => {
    const m = re.exec(s);
    return m ? Number(m[1]) : NaN;
  };
  const r = (() => {
    const radius = num(new RegExp(`(?:radius|r)\\s*(?:of|=|is)?\\s*(${NUM})`));
    if (Number.isFinite(radius)) return radius;
    const d = num(new RegExp(`(?:diameter|d)\\s*(?:of|=|is)?\\s*(${NUM})`));
    return Number.isFinite(d) ? d / 2 : NaN;
  })();
  const h = num(new RegExp(`(?:height|h)\\s*(?:of|=|is)?\\s*(${NUM})`));
  const points = [...s.matchAll(new RegExp(`\\(\\s*(${NUM})\\s*,\\s*(${NUM})\\s*\\)`, "g"))].map((m) => [Number(m[1]), Number(m[2])]);
  const pts = points.length >= 2 ? { x1: points[0][0], y1: points[0][1], x2: points[1][0], y2: points[1][1] } : null;

  if (/distance\s+(between|from)/.test(s) && pts) return { type: "geometry", shape: "distance", params: pts };
  if (/midpoint/.test(s) && pts) return { type: "geometry", shape: "midpoint", params: pts };
  if (/slope/.test(s) && pts) return { type: "geometry", shape: "slope", params: pts };
  if (/hypotenuse/.test(s)) {
    const ns = numbersIn(s);
    if (ns.length >= 2) return { type: "geometry", shape: "hypotenuse", params: { a: ns[0], b: ns[1] }, unit };
  }
  if (!/\b(area|perimeter|circumference|volume|surface area)\b/.test(s)) return null;
  const isArea = /\barea\b/.test(s) && !/surface area/.test(s);
  if (/circle/.test(s) && Number.isFinite(r)) return { type: "geometry", shape: /circumference|perimeter/.test(s) ? "circle-circumference" : "circle-area", params: { r }, unit };
  if (/sphere/.test(s) && Number.isFinite(r)) return { type: "geometry", shape: /volume/.test(s) ? "sphere-volume" : "sphere-surface", params: { r }, unit };
  if (/cylinder/.test(s) && Number.isFinite(r) && Number.isFinite(h)) return { type: "geometry", shape: /volume/.test(s) ? "cylinder-volume" : "cylinder-surface", params: { r, h }, unit };
  if (/cone/.test(s) && Number.isFinite(r) && Number.isFinite(h)) return { type: "geometry", shape: "cone-volume", params: { r, h }, unit };
  const side = num(new RegExp(`(?:side(?: length)?|s|edge)\\s*(?:of|=|is)?\\s*(${NUM})`));
  if (/cube/.test(s) && Number.isFinite(side)) return { type: "geometry", shape: /volume/.test(s) ? "cube-volume" : "cube-surface", params: { s: side }, unit };
  if (/square/.test(s) && Number.isFinite(side)) return { type: "geometry", shape: isArea ? "square-area" : "square-perimeter", params: { s: side }, unit };
  const by = new RegExp(`(${NUM})\\s*(?:${LENGTH_UNITS})?\\s*(?:by|x|×)\\s*(${NUM})(?:\\s*(?:${LENGTH_UNITS})?\\s*(?:by|x|×)\\s*(${NUM}))?`).exec(s);
  const l = num(new RegExp(`(?:length|l)\\s*(?:of|=|is)?\\s*(${NUM})`));
  const w = num(new RegExp(`(?:width|w)\\s*(?:of|=|is)?\\s*(${NUM})`));
  if (/rectangle|rectangular/.test(s) && !/prism|box/.test(s)) {
    const L = Number.isFinite(l) ? l : by ? Number(by[1]) : NaN;
    const W = Number.isFinite(w) ? w : by ? Number(by[2]) : NaN;
    if (Number.isFinite(L) && Number.isFinite(W)) return { type: "geometry", shape: isArea ? "rectangle-area" : "rectangle-perimeter", params: { l: L, w: W }, unit };
  }
  if (/prism|box|cuboid/.test(s) && by && by[3]) return { type: "geometry", shape: "box-volume", params: { l: Number(by[1]), w: Number(by[2]), h: Number(by[3]) }, unit };
  if (/triangle/.test(s)) {
    const b = num(new RegExp(`(?:base|b)\\s*(?:of|=|is)?\\s*(${NUM})`));
    if (Number.isFinite(b) && Number.isFinite(h)) return { type: "geometry", shape: "triangle-area", params: { b, h }, unit };
    const sides = /sides?\s*(?:of|are|=)?\s*(.+)/.exec(s);
    const ns = sides ? numbersIn(sides[1]) : [];
    if (ns.length >= 3) return { type: "geometry", shape: "triangle-heron", params: { a: ns[0], b: ns[1], c: ns[2] }, unit };
  }
  if (/trapezoid|trapezium/.test(s) && Number.isFinite(h)) {
    const bases = /bases?\s*(?:of|are|=)?\s*(.+?)(?:\s+(?:and\s+)?(?:height|h)|$)/.exec(s);
    const ns = bases ? numbersIn(bases[1]) : [];
    if (ns.length >= 2) return { type: "geometry", shape: "trapezoid-area", params: { a: ns[0], b: ns[1], h }, unit };
  }
  if (/parallelogram/.test(s)) {
    const b = num(new RegExp(`(?:base|b)\\s*(?:of|=|is)?\\s*(${NUM})`));
    if (Number.isFinite(b) && Number.isFinite(h)) return { type: "geometry", shape: "parallelogram-area", params: { b, h }, unit };
  }
  return null;
}
