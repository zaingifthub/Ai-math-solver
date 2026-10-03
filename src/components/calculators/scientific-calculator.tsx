"use client";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Mode = "DEG" | "RAD";

const KEYS: { label: string; insert?: string; action?: string; cls?: string }[][] = [
  [{ label: "sin", insert: "sin(" }, { label: "cos", insert: "cos(" }, { label: "tan", insert: "tan(" }, { label: "π", insert: "pi" }, { label: "e", insert: "e" }, { label: "AC", action: "clear", cls: "text-destructive" }],
  [{ label: "sin⁻¹", insert: "asin(" }, { label: "cos⁻¹", insert: "acos(" }, { label: "tan⁻¹", insert: "atan(" }, { label: "(", insert: "(" }, { label: ")", insert: ")" }, { label: "⌫", action: "back" }],
  [{ label: "ln", insert: "log(" }, { label: "log", insert: "log10(" }, { label: "√", insert: "sqrt(" }, { label: "xʸ", insert: "^" }, { label: "x²", insert: "^2" }, { label: "÷", insert: "/", cls: "bg-accent" }],
  [{ label: "x!", insert: "!" }, { label: "7", insert: "7" }, { label: "8", insert: "8" }, { label: "9", insert: "9" }, { label: "%", insert: "/100" }, { label: "×", insert: "*", cls: "bg-accent" }],
  [{ label: "1/x", insert: "1/(" }, { label: "4", insert: "4" }, { label: "5", insert: "5" }, { label: "6", insert: "6" }, { label: "EXP", insert: "*10^" }, { label: "−", insert: "-", cls: "bg-accent" }],
  [{ label: "|x|", insert: "abs(" }, { label: "1", insert: "1" }, { label: "2", insert: "2" }, { label: "3", insert: "3" }, { label: "ANS", action: "ans" }, { label: "+", insert: "+", cls: "bg-accent" }],
  [{ label: "mod", insert: " mod " }, { label: "0", insert: "0" }, { label: ".", insert: "." }, { label: "±", action: "neg" }, { label: "=", action: "eval", cls: "col-span-2 bg-primary text-primary-foreground hover:bg-primary/90" }],
];

export function ScientificCalculator() {
  const [expr, setExpr] = useState("");
  const [result, setResult] = useState<string>("0");
  const [ans, setAns] = useState<number>(0);
  const [mode, setMode] = useState<Mode>("DEG");
  const [history, setHistory] = useState<{ expr: string; result: string }[]>([]);
  const [error, setError] = useState(false);

  const evaluate = useCallback(async () => {
    if (!expr.trim()) return;
    const { create, all } = await import("mathjs");
    const m = create(all);
    if (mode === "DEG") {
      const toRad = (x: number) => (x * Math.PI) / 180;
      const toDeg = (x: number) => (x * 180) / Math.PI;
      m.import({ sin: (x: number) => Math.sin(toRad(x)), cos: (x: number) => Math.cos(toRad(x)), tan: (x: number) => Math.tan(toRad(x)), asin: (x: number) => toDeg(Math.asin(x)), acos: (x: number) => toDeg(Math.acos(x)), atan: (x: number) => toDeg(Math.atan(x)) }, { override: true });
    }
    try {
      const v = m.evaluate(expr.replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-"), { ANS: ans });
      const num = typeof v === "number" ? v : Number(v);
      if (!Number.isFinite(num)) throw new Error("bad");
      const clean = Math.abs(num) < 1e-12 ? 0 : Number(num.toPrecision(12));
      setResult(String(clean));
      setAns(clean);
      setHistory((h) => [{ expr, result: String(clean) }, ...h].slice(0, 8));
      setError(false);
    } catch {
      setResult("Error");
      setError(true);
    }
  }, [expr, mode, ans]);

  const press = (k: (typeof KEYS)[number][number]) => {
    if (k.action === "clear") return (setExpr(""), setResult("0"), setError(false));
    if (k.action === "back") return setExpr((e) => e.slice(0, -1));
    if (k.action === "eval") return void evaluate();
    if (k.action === "ans") return setExpr((e) => e + "ANS");
    if (k.action === "neg") return setExpr((e) => (e.startsWith("-(") && e.endsWith(")") ? e.slice(2, -1) : `-(${e || "0"})`));
    setExpr((e) => e + (k.insert ?? ""));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT" && (e.target as HTMLInputElement).id !== "sci-display") return;
      if (e.key === "Enter" || e.key === "=") {
        e.preventDefault();
        void evaluate();
      } else if (e.key === "Escape") setExpr("");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [evaluate]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
      <div className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
        <div className="mb-3 rounded-xl bg-muted/50 p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex gap-1" role="radiogroup" aria-label="Angle mode">
              {(["DEG", "RAD"] as Mode[]).map((m) => (
                <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)} className={cn("cursor-pointer rounded px-2 py-0.5 font-medium", mode === m ? "bg-primary text-primary-foreground" : "hover:text-foreground")}>{m}</button>
              ))}
            </div>
            <span>ANS = {ans}</span>
          </div>
          <input id="sci-display" value={expr} onChange={(e) => setExpr(e.target.value)} placeholder="0" aria-label="Expression" className="mt-2 w-full bg-transparent text-right font-mono text-lg outline-none" autoComplete="off" />
          <p className={cn("mt-1 truncate text-right font-mono text-3xl font-semibold", error && "text-destructive")} aria-live="polite">{result}</p>
        </div>
        <div className="grid grid-cols-6 gap-1.5">
          {KEYS.flat().map((k, i) => (
            <button key={i} type="button" onClick={() => press(k)} className={cn("h-12 cursor-pointer rounded-lg border bg-card text-sm font-medium shadow-xs transition-colors hover:bg-muted active:scale-95", k.cls)}>
              {k.label}
            </button>
          ))}
        </div>
      </div>
      <aside className="rounded-2xl border bg-card p-4">
        <h2 className="mb-2 text-sm font-semibold">History</h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">Your calculations will appear here.</p>
        ) : (
          <ul className="space-y-2">
            {history.map((h, i) => (
              <li key={i}>
                <button type="button" onClick={() => setExpr(h.expr)} className="w-full cursor-pointer rounded-lg p-2 text-right hover:bg-muted">
                  <p className="truncate font-mono text-xs text-muted-foreground">{h.expr}</p>
                  <p className="font-mono font-semibold">= {h.result}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}
