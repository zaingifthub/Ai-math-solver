"use client";
import { useMemo, useState } from "react";
import { Loader2, ArrowRight, AlertCircle } from "lucide-react";
import Link from "next/link";
import { getCalculator } from "@/lib/calculators/registry";
import type { InstantResult } from "@/lib/calculators/types";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/misc";
import { Tex } from "@/components/math/tex";
import { MathText } from "@/components/math/tex";
import { MathInput } from "@/components/solver/math-input";
import { SolutionView, type ClientSolveResult } from "@/components/solver/solution-view";
import { MatrixEditor } from "./matrix-editor";
import { ScientificCalculator } from "./scientific-calculator";
import { GraphingCalculator } from "./graphing-calculator";
import { apiFetch, ApiClientError } from "@/lib/api-client";

export function CalculatorWidget({ slug }: { slug: string }) {
  const def = getCalculator(slug)!;
  const initial = useMemo(() => Object.fromEntries((def.fields ?? []).map((f) => [f.name, f.default ?? ""])), [def]);
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; upgrade?: boolean } | null>(null);
  const [engineResult, setEngineResult] = useState<ClientSolveResult | null>(null);
  const [instant, setInstant] = useState<InstantResult | null>(null);

  if (def.kind === "scientific") return <ScientificCalculator />;
  if (def.kind === "graph") return <GraphingCalculator />;

  const set = (name: string, v: string) => setValues((s) => ({ ...s, [name]: v }));
  const visible = (def.fields ?? []).filter((f) => !f.showIf || f.showIf.values.includes(values[f.showIf.field] ?? ""));

  const run = async () => {
    setError(null);
    setEngineResult(null);
    setInstant(null);
    try {
      if (def.kind === "instant") {
        setInstant(def.compute!(values));
        return;
      }
      const input = def.build!(values);
      setLoading(true);
      const { result } = await apiFetch<{ result: ClientSolveResult }>("/api/solve", { method: "POST", json: { input, source: "CALCULATOR" } });
      setEngineResult(result);
    } catch (e) {
      const err = e as ApiClientError;
      setError({ message: err.message, upgrade: err.code === "QUOTA_EXCEEDED" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run();
        }}
        className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {visible.map((f) => {
            const full = f.type === "expression" || f.type === "list" || f.type === "matrix";
            return (
              <div key={f.name} className={full ? "sm:col-span-2" : ""}>
                <Label htmlFor={`f-${f.name}`} className="mb-1.5 block">
                  {f.label} {f.optional && <span className="font-normal text-muted-foreground">(optional)</span>}
                </Label>
                {f.type === "expression" ? (
                  <MathInput id={`f-${f.name}`} label={f.label} value={values[f.name] ?? ""} onChange={(v) => set(f.name, v)} onSubmit={() => void run()} placeholder={f.placeholder} rows={1} />
                ) : f.type === "select" ? (
                  <NativeSelect id={`f-${f.name}`} value={values[f.name] ?? ""} onChange={(e) => set(f.name, e.target.value)}>
                    {f.options!.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </NativeSelect>
                ) : f.type === "matrix" ? (
                  <MatrixEditor label={f.label} value={values[f.name] ?? ""} onChange={(v) => set(f.name, v)} />
                ) : (
                  <Input id={`f-${f.name}`} value={values[f.name] ?? ""} onChange={(e) => set(f.name, e.target.value)} placeholder={f.placeholder} inputMode={f.type === "number" ? "decimal" : undefined} className={f.type === "list" ? "font-mono" : undefined} />
                )}
                {f.help && <p className="mt-1 text-xs text-muted-foreground">{f.help}</p>}
              </div>
            );
          })}
        </div>
        <div className="mt-5 flex justify-end">
          <Button type="submit" size="lg" disabled={loading} className="w-full sm:w-auto">
            {loading ? <Loader2 className="animate-spin" /> : <ArrowRight />} Calculate
          </Button>
        </div>
      </form>

      {error && (
        <Alert variant="destructive" className="items-center">
          <AlertCircle />
          <span className="flex-1">{error.message}</span>
          {error.upgrade && <Button size="sm" asChild><Link href="/pricing">Upgrade</Link></Button>}
        </Alert>
      )}

      {instant && (
        <div className="animate-fade-in space-y-4">
          <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/8 to-sky-500/5 p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-primary">Results</p>
            <dl className="grid gap-3 sm:grid-cols-2">
              {instant.results.map((r) => (
                <div key={r.label} className="rounded-lg bg-card/70 p-3">
                  <dt className="text-xs text-muted-foreground">{r.label}</dt>
                  <dd className="mt-1 overflow-x-auto text-lg"><Tex tex={r.latex} /></dd>
                </div>
              ))}
            </dl>
          </div>
          {instant.steps.length > 0 && (
            <div className="rounded-xl border bg-card p-5">
              <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Steps</p>
              <ol className="space-y-3">
                {instant.steps.map((s, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{s.title}</p>
                      {s.text && <p className="text-sm text-muted-foreground"><MathText text={s.text} /></p>}
                      {s.latex && <div className="overflow-x-auto"><Tex tex={s.latex} display /></div>}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}

      {engineResult && <SolutionView result={engineResult} compact />}
    </div>
  );
}
