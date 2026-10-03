import { math, toStr, variablesOf, pickVariable, type MathNode } from "./mathjs";
import { CAS, toCas } from "./cas";
import { polyCoeffs } from "./poly";
import { samplePoints, close } from "./numeric";

function unwrap(n: MathNode): MathNode {
  while (n.type === "ParenthesisNode") n = (n as unknown as { content: MathNode }).content;
  return n;
}

/** Flatten a sum into signed terms. */
function terms(n: MathNode, sign = 1, out: { sign: number; node: MathNode }[] = []) {
  const u = n;
  if (u.type === "OperatorNode") {
    const o = u as unknown as { op: string; args: MathNode[]; fn: string };
    if (o.op === "+" && o.args.length === 2) {
      terms(o.args[0], sign, out);
      terms(o.args[1], sign, out);
      return out;
    }
    if (o.op === "-" && o.args.length === 2) {
      terms(o.args[0], sign, out);
      terms(o.args[1], -sign, out);
      return out;
    }
    if (o.op === "-" && o.args.length === 1) {
      terms(o.args[0], -sign, out);
      return out;
    }
  }
  if (u.type === "ConstantNode" && Number((u as unknown as { value: number }).value) < 0) {
    out.push({ sign: -sign, node: new math.ConstantNode(-Number((u as unknown as { value: number }).value)) });
    return out;
  }
  // leading negative coefficient: (-3) * x  →  -(3 * x)
  if (u.type === "OperatorNode" && (u as unknown as { op: string }).op === "*") {
    const [a, b] = (u as unknown as { args: MathNode[] }).args;
    const ua = unwrap(a);
    if (ua.type === "ConstantNode" && Number((ua as unknown as { value: number }).value) < 0) {
      const c = -Number((ua as unknown as { value: number }).value);
      out.push({ sign: -sign, node: c === 1 ? b : new math.OperatorNode("*", "multiply", [new math.ConstantNode(c), b]) });
      return out;
    }
    if (ua.type === "OperatorNode" && (ua as unknown as { op: string; args: MathNode[] }).op === "-" && (ua as unknown as { args: MathNode[] }).args.length === 1) {
      const inner = (ua as unknown as { args: MathNode[] }).args[0];
      out.push({ sign: -sign, node: unwrap(inner).type === "ConstantNode" && Number((unwrap(inner) as unknown as { value: number }).value) === 1 ? b : new math.OperatorNode("*", "multiply", [inner, b]) });
      return out;
    }
  }
  out.push({ sign, node: u });
  return out;
}

function degreeOf(n: MathNode, v: string): number {
  if (!variablesOf(n).includes(v)) return -1;
  const c = polyCoeffs(n, v);
  return c ? c.length - 1 : 0.5;
}

/** Reorder sums so higher-degree terms in the main variable come first and constants last; tidy signs. */
export function pretty(node: MathNode): MathNode {
  const v = pickVariable(variablesOf(node)) ?? "x";
  const visit = (n: MathNode): MathNode => {
    const u = n;
    if (u.type === "OperatorNode") {
      const o = u as unknown as { op: string; args: MathNode[] };
      if ((o.op === "+" || o.op === "-") && o.args.length === 2) {
        const ts = terms(u).map((t) => ({ sign: t.sign, node: visit(t.node) }));
        ts.sort((a, b) => degreeOf(b.node, v) - degreeOf(a.node, v));
        let acc: MathNode = ts[0].sign < 0 ? new math.OperatorNode("-", "unaryMinus", [ts[0].node]) : ts[0].node;
        for (const t of ts.slice(1)) acc = new math.OperatorNode(t.sign < 0 ? "-" : "+", t.sign < 0 ? "subtract" : "add", [acc, t.node]);
        return acc;
      }
      const args = o.args.map(visit);
      return new math.OperatorNode(o.op as "*", (u as unknown as { fn: string }).fn as "multiply", args);
    }
    if (u.type === "ParenthesisNode") return new math.ParenthesisNode(visit((u as unknown as { content: MathNode }).content));
    if (u.type === "FunctionNode") {
      const f = u as unknown as { fn: MathNode; args: MathNode[] };
      return new math.FunctionNode(f.fn as unknown as string, f.args.map(visit));
    }
    return u;
  };
  try {
    return visit(node);
  } catch {
    return node;
  }
}

function equivalent(a: MathNode, b: MathNode): boolean {
  const vars = [...new Set([...variablesOf(a), ...variablesOf(b)])];
  const fa = a.compile();
  const fb = b.compile();
  let tested = 0;
  for (const x of samplePoints(6, 0.3, 2.8)) {
    const scope = Object.fromEntries(vars.map((v, i) => [v, x + 0.37 * i]));
    let va: number, vb: number;
    try {
      va = Number(fa.evaluate(scope));
      vb = Number(fb.evaluate(scope));
    } catch {
      continue;
    }
    if (!Number.isFinite(va) || !Number.isFinite(vb)) continue;
    tested++;
    if (!close(va, vb, 1e-8)) return false;
  }
  return tested > 0;
}

function score(n: MathNode): number {
  const s = toStr(n);
  return s.length + (s.match(/\(/g)?.length ?? 0) * 2 + (/\* -|\+ -|-1 \//.test(s) ? 6 : 0);
}

/** Choose the simplest of several equivalent forms of an expression. */
export async function bestForm(expr: MathNode | string, opts: { cas?: boolean } = { cas: true }): Promise<MathNode> {
  const base = typeof expr === "string" ? math.parse(expr) : expr;
  const candidates: MathNode[] = [base];
  try {
    candidates.push(math.simplify(base));
  } catch {
    /* ignore */
  }
  if (opts.cas !== false) {
    const casStr = toCas(base);
    const [s, e, f] = await Promise.all([CAS.simplify(casStr), CAS.expand(casStr), CAS.factor(casStr)]);
    for (const c of [s, e, f]) {
      if (!c) continue;
      try {
        candidates.push(math.parse(c));
      } catch {
        /* ignore */
      }
    }
  }
  const valid = candidates.filter((c, i) => i === 0 || equivalent(base, c)).map(pretty);
  valid.sort((a, b) => score(a) - score(b));
  return valid[0] ?? base;
}
