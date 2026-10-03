"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Type, Camera, Sparkles, ArrowRight, AlertCircle, Loader2 } from "lucide-react";
import { MathInput } from "./math-input";
import { PhotoUpload } from "./photo-upload";
import { SolutionView, type ClientSolveResult } from "./solution-view";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Alert } from "@/components/ui/misc";
import { Skeleton } from "@/components/ui/misc";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import { LEVELS, cn } from "@/lib/utils";

export const DEFAULT_EXAMPLES = [
  "2x + 5 = 17",
  "x^2 - 5x + 6 = 0",
  "derivative of x^2 sin(x)",
  "integrate x e^x dx",
  "limit of sin(x)/x as x->0",
  "x + y = 10; x - y = 2",
  "(x-1)/(x+2) <= 0",
  "mean of 4, 8, 15, 16, 23, 42",
];

interface Props {
  examples?: string[];
  placeholder?: string;
  /** Run the solver immediately with this problem */
  initialProblem?: string;
  compact?: boolean;
  autoFocus?: boolean;
  source?: "TEXT" | "CALCULATOR";
}

export function SolverWorkspace({ examples = DEFAULT_EXAMPLES, placeholder = "Type a problem, e.g. 2x² − 3x − 1 = 0, or ask “derivative of sin(x²)”", initialProblem, compact, autoFocus, source = "TEXT" }: Props) {
  const params = useSearchParams();
  const { data: session } = useSession();
  const [input, setInput] = useState(initialProblem ?? params.get("q") ?? "");
  const [levelChoice, setLevel] = useState<string | null>(null);
  const level = levelChoice ?? session?.user?.level ?? "HIGH_SCHOOL";
  const [autoExplain, setAutoExplain] = useState(false);
  const [loading, setLoading] = useState(false);
  const [explaining, setExplaining] = useState(false);
  const [error, setError] = useState<{ message: string; upgrade?: boolean } | null>(null);
  const [result, setResult] = useState<ClientSolveResult | null>(null);
  const [tab, setTab] = useState("type");
  const resultRef = useRef<HTMLDivElement>(null);
  const ranInitial = useRef(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("ams-auto-explain");
      if (saved) setAutoExplain(saved === "1");
    } catch {
      /* ignore */
    }
  }, []);

  const solve = useCallback(
    async (problem?: string, opts: { explain?: boolean; src?: "TEXT" | "IMAGE" | "CALCULATOR" } = {}) => {
      const q = (problem ?? input).trim();
      if (!q) return;
      if (problem) setInput(problem);
      setLoading(true);
      setError(null);
      setResult(null);
      const explain = opts.explain ?? autoExplain;
      if (explain) setExplaining(true);
      try {
        const { result } = await apiFetch<{ result: ClientSolveResult }>("/api/solve", { method: "POST", json: { input: q, explain, level, source: opts.src ?? source } });
        setResult(result);
        requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
      } catch (e) {
        const err = e as ApiClientError;
        setError({ message: err.message || "Something went wrong.", upgrade: err.code === "QUOTA_EXCEEDED" });
      } finally {
        setLoading(false);
        setExplaining(false);
      }
    },
    [input, autoExplain, level, source],
  );

  useEffect(() => {
    const q = initialProblem ?? params.get("q");
    if (q && !ranInitial.current) {
      ranInitial.current = true;
      void solve(q);
    }
  }, [initialProblem, params, solve]);

  const explain = async () => {
    if (!result) return;
    setExplaining(true);
    try {
      const { result: r } = await apiFetch<{ result: ClientSolveResult }>("/api/solve", { method: "POST", json: { input: result.input, explain: true, level, source } });
      setResult((prev) => (prev ? { ...prev, ai: r.ai, aiError: r.aiError ?? (r.ai ? undefined : "AI explanation unavailable right now.") } : r));
    } catch (e) {
      setResult((prev) => (prev ? { ...prev, aiError: (e as Error).message } : prev));
    } finally {
      setExplaining(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className={cn("rounded-2xl border bg-card p-4 shadow-sm sm:p-5", !compact && "shadow-lg shadow-primary/5")}>
        <Tabs value={tab} onValueChange={setTab}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <TabsList>
              <TabsTrigger value="type"><Type /> Type</TabsTrigger>
              <TabsTrigger value="photo"><Camera /> Photo</TabsTrigger>
            </TabsList>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <label className="flex items-center gap-2">
                <span className="text-muted-foreground">Level</span>
                <NativeSelect value={level} onChange={(e) => setLevel(e.target.value)} className="h-8 w-auto py-0 text-xs" aria-label="Education level">
                  {LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                </NativeSelect>
              </label>
              <label className="flex items-center gap-2">
                <Switch
                  checked={autoExplain}
                  onCheckedChange={(v) => {
                    setAutoExplain(v);
                    try {
                      localStorage.setItem("ams-auto-explain", v ? "1" : "0");
                    } catch {
                      /* ignore */
                    }
                  }}
                  aria-label="Include AI explanation"
                />
                <span className="flex items-center gap-1 text-muted-foreground"><Sparkles className="size-3.5 text-primary" /> AI explanation</span>
              </label>
            </div>
          </div>
          <TabsContent value="type">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void solve();
              }}
              className="space-y-3"
            >
              <MathInput id="solver-input" value={input} onChange={setInput} onSubmit={() => void solve()} placeholder={placeholder} autoFocus={autoFocus} />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-1.5">
                  {examples.slice(0, compact ? 4 : 8).map((ex) => (
                    <button key={ex} type="button" onClick={() => void solve(ex)} className="cursor-pointer rounded-full border bg-muted/40 px-3 py-1 font-mono text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground">
                      {ex}
                    </button>
                  ))}
                </div>
                <Button type="submit" size="lg" disabled={loading || !input.trim()} className="w-full sm:w-auto">
                  {loading ? <Loader2 className="animate-spin" /> : <ArrowRight />} Solve
                </Button>
              </div>
            </form>
          </TabsContent>
          <TabsContent value="photo">
            <PhotoUpload disabled={loading} onSolve={(q) => { setTab("type"); void solve(q, { src: "IMAGE" }); }} />
          </TabsContent>
        </Tabs>
      </div>

      <div ref={resultRef} className="scroll-mt-24">
        {loading && (
          <div className="space-y-4" aria-busy>
            <Skeleton className="h-40 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        )}
        {error && (
          <Alert variant="destructive" className="items-center">
            <AlertCircle />
            <span className="flex-1">{error.message}</span>
            {error.upgrade && (
              <Button size="sm" asChild><Link href={session ? "/pricing" : "/register"}>{session ? "Upgrade" : "Sign up free"}</Link></Button>
            )}
          </Alert>
        )}
        {result && !loading && <SolutionView result={result} onExplain={explain} explaining={explaining} compact={compact} onTrySimilar={(p) => void solve(p)} />}
      </div>
    </div>
  );
}
