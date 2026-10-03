/**
 * Computer-algebra bridge (nerdamer) executed in a worker thread with a hard
 * timeout, so pathological symbolic problems can never block the server.
 */
import { Worker } from "node:worker_threads";
import { createRequire } from "node:module";
import { math, toStr, type MathNode } from "./mathjs";

type CasOp = "integrate" | "limit" | "solve" | "solveSystem" | "factor" | "expand" | "simplify" | "partfrac" | "tex";

const WORKER_SOURCE = `
const { parentPort, workerData } = require('worker_threads');
let nerdamer, S;
for (const base of [workerData && workerData.nerdamer, 'nerdamer']) {
  if (!base) continue;
  try { nerdamer = require(base); S = require(workerData && workerData.solve && base !== 'nerdamer' ? workerData.solve : 'nerdamer/solve'); break; } catch (e) { nerdamer = null; }
}
function run(op, a) {
  if (!nerdamer) throw new Error('CAS unavailable');
  switch (op) {
    case 'integrate': return nerdamer('integrate(' + a[0] + ',' + a[1] + ')').toString();
    case 'limit': return nerdamer('limit(' + a[0] + ',' + a[1] + ',' + a[2] + ')').toString();
    case 'solve': {
      const s = nerdamer.solve(a[0], a[1]).toString().trim();
      return s.replace(/^\\[|\\]$/g, '').replace(/^\\{|\\}$/g, '');
    }
    case 'solveSystem': return S.solveSystem(a[0]).toString();
    case 'factor': return nerdamer('factor(' + a[0] + ')').toString();
    case 'expand': return nerdamer('expand(' + a[0] + ')').toString();
    case 'simplify': return nerdamer('simplify(' + a[0] + ')').toString();
    case 'partfrac': return nerdamer('partfrac(' + a[0] + ',' + a[1] + ')').toString();
    case 'tex': return nerdamer(a[0]).toTeX();
    default: throw new Error('unknown op');
  }
}
parentPort.on('message', (m) => {
  try { parentPort.postMessage({ id: m.id, ok: true, value: run(m.op, m.args) }); }
  catch (e) { parentPort.postMessage({ id: m.id, ok: false, error: String((e && e.message) || e) }); }
});
`;

interface Pending {
  resolve: (v: string) => void;
  reject: (e: Error) => void;
  timer: NodeJS.Timeout;
}

class CasWorker {
  private worker: Worker | null = null;
  private seq = 0;
  private pending = new Map<number, Pending>();

  private ensure(): Worker {
    if (this.worker) return this.worker;
    const w = new Worker(WORKER_SOURCE, { eval: true, workerData: resolveNerdamer() });
    w.unref();
    w.on("message", (m: { id: number; ok: boolean; value?: string; error?: string }) => {
      const p = this.pending.get(m.id);
      if (!p) return;
      clearTimeout(p.timer);
      this.pending.delete(m.id);
      if (m.ok) p.resolve(m.value ?? "");
      else p.reject(new Error(m.error ?? "CAS error"));
    });
    w.on("error", (err: unknown) => this.reset(err instanceof Error ? err : new Error(String(err))));
    w.on("exit", () => {
      if (this.worker === w) this.reset(new Error("CAS worker exited"));
    });
    this.worker = w;
    return w;
  }

  private reset(err: Error) {
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.reject(err);
    }
    this.pending.clear();
    const w = this.worker;
    this.worker = null;
    if (w) void w.terminate().catch(() => undefined);
  }

  call(op: CasOp, args: string[] | string[][], timeoutMs: number): Promise<string> {
    const w = this.ensure();
    const id = ++this.seq;
    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        // A runaway computation cannot be interrupted cooperatively: recycle the worker.
        this.reset(new Error("CAS timeout"));
        reject(new Error("CAS timeout"));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      w.postMessage({ id, op, args });
    });
  }
}

/** Absolute module paths so the eval'd worker can load nerdamer regardless of the process cwd (serverless, standalone). */
function resolveNerdamer(): { nerdamer?: string; solve?: string } {
  for (const base of [process.cwd() + "/", import.meta.url]) {
    try {
      const req = createRequire(base);
      return { nerdamer: req.resolve("nerdamer"), solve: req.resolve("nerdamer/solve") };
    } catch {
      /* try next */
    }
  }
  return {};
}

type NerdamerModule = ((expr: string) => { toString(): string; toTeX(): string }) & { solve: (eq: string, v: string) => { toString(): string } };
let inlineCas: { nerdamer: NerdamerModule; S: { solveSystem: (eqs: string[]) => { toString(): string } } } | null | undefined;

/** Last-resort in-process execution when worker threads are unavailable on the host platform. */
function runInline(op: CasOp, a: string[] | string[][]): string {
  if (inlineCas === undefined) {
    try {
      const paths = resolveNerdamer();
      const req = createRequire(process.cwd() + "/");
      inlineCas = { nerdamer: req(paths.nerdamer ?? "nerdamer"), S: req(paths.solve ?? "nerdamer/solve") };
    } catch {
      inlineCas = null;
    }
  }
  if (!inlineCas) throw new Error("CAS unavailable");
  const { nerdamer, S } = inlineCas;
  const x = a as string[];
  switch (op) {
    case "integrate": return nerdamer(`integrate(${x[0]},${x[1]})`).toString();
    case "limit": return nerdamer(`limit(${x[0]},${x[1]},${x[2]})`).toString();
    case "solve": return nerdamer.solve(x[0], x[1]).toString().trim().replace(/^\[|\]$/g, "").replace(/^\{|\}$/g, "");
    case "solveSystem": return S.solveSystem((a as string[][])[0]).toString();
    case "factor": return nerdamer(`factor(${x[0]})`).toString();
    case "expand": return nerdamer(`expand(${x[0]})`).toString();
    case "simplify": return nerdamer(`simplify(${x[0]})`).toString();
    case "partfrac": return nerdamer(`partfrac(${x[0]},${x[1]})`).toString();
    case "tex": return nerdamer(x[0]).toTeX();
  }
}

const globalForCas = globalThis as unknown as { __casWorker?: CasWorker; __casInline?: boolean };
const cas = (globalForCas.__casWorker ??= new CasWorker());

async function call(op: CasOp, args: string[] | string[][], timeoutMs = 4000): Promise<string | null> {
  if (!globalForCas.__casInline) {
    try {
      return await cas.call(op, args, timeoutMs);
    } catch (e) {
      const msg = (e as Error).message;
      // Only fall back when the worker itself cannot run; timeouts/math errors are real results.
      if (!/CAS unavailable|worker|Cannot find module|ERR_WORKER/i.test(msg)) return null;
      console.warn("[cas] worker unavailable, using in-process CAS:", msg);
      globalForCas.__casInline = true;
    }
  }
  try {
    return runInline(op, args);
  } catch {
    return null;
  }
}

/** mathjs AST → nerdamer syntax. */
export function toCas(node: MathNode | string): string {
  const n = typeof node === "string" ? math.parse(node) : node;
  const t = n.transform((x) => {
    if (x.type === "FunctionNode") {
      const f = x as unknown as { fn: { name: string }; args: MathNode[] };
      if (f.fn.name === "log" && f.args.length === 2) {
        return math.parse(`(log(${toCas(f.args[0])})/log(${toCas(f.args[1])}))`);
      }
      if (f.fn.name === "nthRoot" && f.args.length === 2) {
        return math.parse(`(${toCas(f.args[0])})^(1/(${toCas(f.args[1])}))`);
      }
    }
    return x;
  });
  return toStr(t).replace(/\s+/g, "");
}

/** nerdamer output → mathjs-parsable string (or null if it is not usable). */
export function fromCas(s: string | null): string | null {
  if (!s) return null;
  const out = s.trim();
  if (!out || /integrate\(|limit\(|solve\(|undefined|NaN/.test(out)) return null;
  try {
    math.parse(out);
    return out;
  } catch {
    return null;
  }
}

export const CAS = {
  integrate: async (expr: string, v: string) => fromCas(await call("integrate", [expr, v], 6000)),
  limit: async (expr: string, v: string, at: string) => call("limit", [expr, v, at], 5000),
  solve: async (equation: string, v: string): Promise<string[] | null> => {
    const r = await call("solve", [equation, v], 5000);
    if (r === null) return null;
    if (!r.trim()) return [];
    return splitTopLevel(r).map((x) => x.trim()).filter(Boolean);
  },
  solveSystem: async (equations: string[]): Promise<Record<string, string>[] | null> => {
    const r = await call("solveSystem", [equations] as unknown as string[][], 6000);
    if (!r) return null;
    const sols: Record<string, string>[] = [];
    for (const m of r.matchAll(/\{([^{}]*)\}/g)) {
      const sol: Record<string, string> = {};
      for (const part of splitTopLevel(m[1])) {
        const [k, v] = part.split("=>").map((p) => p.trim());
        if (k && v) sol[k] = v;
      }
      if (Object.keys(sol).length) sols.push(sol);
    }
    return sols;
  },
  factor: async (expr: string) => fromCas(await call("factor", [expr])),
  expand: async (expr: string) => fromCas(await call("expand", [expr])),
  simplify: async (expr: string) => fromCas(await call("simplify", [expr])),
  partfrac: async (expr: string, v: string) => fromCas(await call("partfrac", [expr, v])),
};

export function splitTopLevel(s: string, sep = ","): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "(" || ch === "[" || ch === "{") depth++;
    else if (ch === ")" || ch === "]" || ch === "}") depth--;
    if (ch === sep && depth === 0) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out;
}
