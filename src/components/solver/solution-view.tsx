"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Copy, Bookmark, BookmarkCheck, MessageCircle, Sparkles, ChevronDown, Lightbulb, AlertTriangle, Shuffle, BookOpen, LineChart, Eye } from "lucide-react";
import type { SolveResult } from "@/lib/math/types";
import { Tex, MathText } from "@/components/math/tex";
import { MarkdownMath } from "@/components/math/markdown-math";
import { VerificationBadge } from "./verification-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, Spinner, Skeleton } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { CATEGORY_NAMES, cn } from "@/lib/utils";

const GraphCanvas = dynamic(() => import("@/components/graph/graph-canvas").then((m) => m.GraphCanvas), { ssr: false, loading: () => <Skeleton className="h-80 w-full rounded-xl" /> });

export type ClientSolveResult = SolveResult & { aiError?: string };

interface Props {
  result: ClientSolveResult;
  onExplain?: () => void;
  explaining?: boolean;
  onTrySimilar?: (problem: string) => void;
  compact?: boolean;
}

function Section({ icon: Icon, title, children, className }: { icon: React.ElementType; title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl border bg-card p-5", className)}>
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="size-4 text-primary" /> {title}
      </h3>
      {children}
    </section>
  );
}

export function SolutionView({ result, onExplain, explaining, onTrySimilar, compact }: Props) {
  const toast = useToast();
  const router = useRouter();
  const { data: session } = useSession();
  const [showAll, setShowAll] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [revealSimilar, setRevealSimilar] = useState(false);
  const [showGraph, setShowGraph] = useState(!compact);
  const steps = result.steps;
  const visibleSteps = showAll || steps.length <= 7 ? steps : steps.slice(0, 6);

  const copy = async () => {
    await navigator.clipboard.writeText(result.answer.text);
    toast("Answer copied to clipboard", "success");
  };

  const bookmark = async () => {
    if (!session) return router.push("/login?callbackUrl=/solver");
    if (!result.id) return;
    try {
      if (bookmarked) await apiFetch(`/api/bookmarks/${result.id}`, { method: "DELETE" });
      else await apiFetch("/api/bookmarks", { method: "POST", json: { problemId: result.id } });
      setBookmarked(!bookmarked);
      toast(bookmarked ? "Removed from saved problems" : "Saved to your problems", "success");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  const askTutor = () => {
    const context = `Problem: ${result.input}\nTopic: ${result.topic}\nAnswer: ${result.answer.text}\nSteps:\n${result.steps.map((s, i) => `${i + 1}. ${s.title}: ${s.latex ?? s.text ?? ""}`).join("\n")}`;
    try {
      sessionStorage.setItem("tutor-context", JSON.stringify({ context, problem: result.input }));
    } catch {
      /* storage unavailable */
    }
    router.push("/tutor?from=solution");
  };

  // Simple graph only for single-variable graphs in x
  const graph = result.graph && (result.graph.expressions.length > 0 || (result.graph.points?.length ?? 0) > 0) ? result.graph : null;

  return (
    <div className="animate-fade-in space-y-4">
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge>{CATEGORY_NAMES[result.category] ?? result.category}</Badge>
          <Badge variant="secondary">{result.topic}</Badge>
          <VerificationBadge verification={result.verification} />
        </div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Problem</p>
        <div className="mt-1 overflow-x-auto text-lg">
          <Tex tex={result.interpreted} display />
        </div>
        <div className="mt-4 rounded-xl border border-primary/20 bg-gradient-to-br from-primary/8 to-sky-500/5 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">Answer</p>
              <div className="mt-1 overflow-x-auto text-xl">
                <Tex tex={result.answer.latex} display />
              </div>
              {result.answer.decimal && <p className="mt-1 text-sm text-muted-foreground">Decimal: {result.answer.decimal}</p>}
            </div>
            <div className="flex shrink-0 gap-1">
              <Button variant="ghost" size="icon-sm" onClick={copy} aria-label="Copy answer" title="Copy answer"><Copy /></Button>
              {result.id && (
                <Button variant="ghost" size="icon-sm" onClick={bookmark} aria-label={bookmarked ? "Remove bookmark" : "Save problem"} title={bookmarked ? "Saved" : "Save"}>
                  {bookmarked ? <BookmarkCheck className="text-primary" /> : <Bookmark />}
                </Button>
              )}
            </div>
          </div>
        </div>
        {result.restrictions && result.restrictions.length > 0 && (
          <p className="mt-3 text-sm text-muted-foreground">
            Restrictions: <Tex tex={result.restrictions.join(",\; ")} />
          </p>
        )}
        {result.warnings?.map((w, i) => (
          <Alert key={i} variant="warning" className="mt-3">
            <AlertTriangle />
            <MathText text={w} />
          </Alert>
        ))}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={askTutor}><MessageCircle /> Ask the AI tutor</Button>
          {!result.ai && onExplain && (
            <Button variant="outline" size="sm" onClick={onExplain} disabled={explaining}>
              {explaining ? <Spinner /> : <Sparkles />} Explain with AI
            </Button>
          )}
          {graph && compact && (
            <Button variant="outline" size="sm" onClick={() => setShowGraph((s) => !s)}><LineChart /> {showGraph ? "Hide graph" : "Show graph"}</Button>
          )}
        </div>
      </div>

      <Section icon={BookOpen} title={`Step-by-step solution (${steps.length} steps)`}>
        <ol className="space-y-4">
          {visibleSteps.map((s, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{i + 1}</span>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="font-medium">{s.title}</p>
                {s.text && <p className="mt-1 text-sm text-muted-foreground"><MathText text={s.text} /></p>}
                {s.latex && (
                  <div className="mt-2 overflow-x-auto rounded-lg bg-muted/40 px-3 py-1">
                    <Tex tex={s.latex} display />
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
        {steps.length > 7 && (
          <Button variant="ghost" size="sm" className="mt-3" onClick={() => setShowAll((s) => !s)}>
            <ChevronDown className={cn("transition-transform", showAll && "rotate-180")} /> {showAll ? "Show fewer steps" : `Show all ${steps.length} steps`}
          </Button>
        )}
      </Section>

      {(result.ai || explaining || result.aiError) && (
        <Section icon={Sparkles} title="AI explanation" className="border-primary/25">
          {explaining && !result.ai ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <p className="pt-1 text-xs text-muted-foreground">Writing a personalized explanation of the verified solution…</p>
            </div>
          ) : result.ai ? (
            <div className="space-y-5">
              <MarkdownMath source={result.ai.explanation} />
              {result.ai.commonMistakes && result.ai.commonMistakes.length > 0 && (
                <div className="rounded-lg border border-warning/30 bg-warning/5 p-4">
                  <p className="mb-2 flex items-center gap-2 text-sm font-semibold"><AlertTriangle className="size-4 text-amber-600" /> Common mistakes</p>
                  <ul className="space-y-1.5 text-sm">{result.ai.commonMistakes.map((m, i) => <li key={i}>• <MathText text={m} /></li>)}</ul>
                </div>
              )}
              {result.ai.tips && result.ai.tips.length > 0 && (
                <div className="rounded-lg border bg-muted/30 p-4">
                  <p className="mb-2 flex items-center gap-2 text-sm font-semibold"><Lightbulb className="size-4 text-primary" /> Study tips</p>
                  <ul className="space-y-1.5 text-sm">{result.ai.tips.map((m, i) => <li key={i}>• <MathText text={m} /></li>)}</ul>
                </div>
              )}
              <p className="text-xs text-muted-foreground">AI explains the engine-verified solution; it cannot change the answer.</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {result.aiError}{" "}
              {/limit|Sign up/i.test(result.aiError ?? "") && <Link href="/pricing" className="font-medium text-primary hover:underline">See plans</Link>}
            </p>
          )}
        </Section>
      )}

      {result.formulas.length > 0 && (
        <Section icon={BookOpen} title="Formulas used">
          <ul className="grid gap-3 sm:grid-cols-2">
            {result.formulas.map((f, i) => (
              <li key={i} className="rounded-lg border bg-muted/20 p-3">
                <p className="text-sm font-medium">{f.name}</p>
                <div className="mt-1 overflow-x-auto"><Tex tex={f.latex} display /></div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {(result.alternative || result.ai?.alternative) && (
        <Section icon={Shuffle} title={`Alternative method${result.alternative ? `: ${result.alternative.title}` : ""}`}>
          {result.alternative && (
            <ol className="space-y-3">
              {result.alternative.steps.map((s, i) => (
                <li key={i}>
                  <p className="text-sm font-medium">{i + 1}. {s.title}</p>
                  {s.text && <p className="text-sm text-muted-foreground"><MathText text={s.text} /></p>}
                  {s.latex && <div className="overflow-x-auto"><Tex tex={s.latex} display /></div>}
                </li>
              ))}
            </ol>
          )}
          {result.ai?.alternative && <MarkdownMath source={result.ai.alternative} className={result.alternative ? "mt-4 border-t pt-4" : ""} />}
        </Section>
      )}

      {graph && showGraph && (
        <Section icon={LineChart} title="Graph">
          <GraphCanvas expressions={graph.expressions} points={graph.points} xRange={graph.xRange} height={320} />
          <p className="mt-2 text-xs text-muted-foreground">Drag to pan, scroll or pinch to zoom. Grey dots are roots, orange dots are intersections.</p>
        </Section>
      )}

      {result.similar && (
        <Section icon={Lightbulb} title="Practice a similar problem">
          <p className="text-[15px]"><MathText text={result.similar.problem} /></p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setRevealSimilar((r) => !r)}><Eye /> {revealSimilar ? "Hide answer" : "Reveal answer"}</Button>
            {onTrySimilar && result.similar.input && <Button variant="ghost" size="sm" onClick={() => onTrySimilar(result.similar!.input!)}>Solve it step by step</Button>}
            <Button variant="link" size="sm" asChild><Link href="/practice">More practice →</Link></Button>
          </div>
          {revealSimilar && <div className="mt-3 rounded-lg bg-muted/40 px-3 py-2"><Tex tex={result.similar.answer} /></div>}
        </Section>
      )}

      <p className="text-center text-xs text-muted-foreground">Solved in {result.engine.durationMs} ms by the math engine ({result.engine.method}).</p>
    </div>
  );
}
