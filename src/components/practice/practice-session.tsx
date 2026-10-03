"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { CheckCircle2, XCircle, Lightbulb, ArrowRight, Loader2, Trophy, RotateCcw, BookOpen } from "lucide-react";
import { Tex, MathText } from "@/components/math/tex";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { Alert } from "@/components/ui/misc";
import { SolutionView, type ClientSolveResult } from "@/components/solver/solution-view";
import { PRACTICE_TOPICS } from "@/lib/math/generator";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface Problem { id: string; topic: string; difficulty: number; instruction: string; prompt: string; hint: string; answerKind: string }
interface CheckResult { correct: boolean; feedback: string; answer: string; solveInput: string }

const QUIZ_LENGTH = 10;

export function PracticeSession({ initialTopic = "linear-equations" }: { initialTopic?: string }) {
  const { data: session } = useSession();
  const [topic, setTopic] = useState(initialTopic);
  const [difficulty, setDifficulty] = useState(1);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<CheckResult | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [score, setScore] = useState({ correct: 0, total: 0, streak: 0 });
  const [solution, setSolution] = useState<ClientSolveResult | null>(null);
  const [solving, setSolving] = useState(false);
  const started = useRef(0);

  const next = useCallback(async (d?: number) => {
    setLoading(true);
    setError(null);
    setResult(null);
    setAnswer("");
    setShowHint(false);
    setSolution(null);
    try {
      const { problems } = await apiFetch<{ problems: Problem[] }>(`/api/practice?topic=${topic}&difficulty=${d ?? difficulty}`);
      setProblem(problems[0]);
      started.current = Date.now();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [topic, difficulty]);

  // Load a question for the current topic (a topic change starts a fresh quiz in the select handler).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetching from the API is a sync with an external system
    void next();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic]);

  const check = async () => {
    if (!problem || !answer.trim()) return;
    setLoading(true);
    try {
      const r = await apiFetch<CheckResult>("/api/practice", { method: "POST", json: { id: problem.id, answer, timeMs: Date.now() - started.current } });
      setResult(r);
      setScore((s) => ({ correct: s.correct + (r.correct ? 1 : 0), total: s.total + 1, streak: r.correct ? s.streak + 1 : 0 }));
      // Adaptive difficulty: step up after 3 in a row, step down after a miss at higher levels
      if (r.correct && (score.streak + 1) % 3 === 0 && difficulty < 3) setDifficulty((d) => Math.min(3, d + 1));
      else if (!r.correct && score.streak === 0 && difficulty > 1 && score.total > 0) setDifficulty((d) => Math.max(1, d - 1));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const showSolution = async () => {
    if (!result) return;
    setSolving(true);
    try {
      const { result: r } = await apiFetch<{ result: ClientSolveResult }>("/api/solve", { method: "POST", json: { input: result.solveInput, source: "PRACTICE" } });
      setSolution(r);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSolving(false);
    }
  };

  const done = score.total >= QUIZ_LENGTH;
  const groups = [...new Set(PRACTICE_TOPICS.map((t) => t.group))];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:flex-row sm:items-end">
        <label className="flex-1 text-sm">
          <span className="mb-1 block font-medium">Topic</span>
          <NativeSelect value={topic} onChange={(e) => { setScore({ correct: 0, total: 0, streak: 0 }); setTopic(e.target.value); }}>
            {groups.map((g) => (
              <optgroup key={g} label={g}>
                {PRACTICE_TOPICS.filter((t) => t.group === g).map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </optgroup>
            ))}
          </NativeSelect>
        </label>
        <label className="text-sm sm:w-48">
          <span className="mb-1 block font-medium">Difficulty</span>
          <NativeSelect value={difficulty} onChange={(e) => { const d = Number(e.target.value); setDifficulty(d); void next(d); }}>
            <option value={1}>Easy</option>
            <option value={2}>Medium</option>
            <option value={3}>Hard</option>
          </NativeSelect>
        </label>
        <div className="flex gap-4 rounded-xl bg-muted/40 px-4 py-2 text-sm">
          <span>Score <strong>{score.correct}/{score.total}</strong></span>
          <span>Streak <strong>{score.streak}🔥</strong></span>
        </div>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={score.total} aria-valuemax={QUIZ_LENGTH} aria-label="Quiz progress">
        <div className="h-full bg-primary transition-all" style={{ width: `${(Math.min(score.total, QUIZ_LENGTH) / QUIZ_LENGTH) * 100}%` }} />
      </div>

      {error && <Alert variant="destructive">{error}</Alert>}

      {done ? (
        <div className="rounded-2xl border bg-card p-10 text-center">
          <Trophy className="mx-auto size-12 text-amber-500" />
          <h2 className="mt-4 text-2xl font-semibold">Quiz complete!</h2>
          <p className="mt-2 text-muted-foreground">You scored {score.correct} out of {score.total} ({Math.round((score.correct / score.total) * 100)}%).</p>
          {!session && <p className="mt-2 text-sm text-muted-foreground"><Link href="/register" className="font-medium text-primary">Sign up</Link> to save progress and see your weak topics.</p>}
          <div className="mt-6 flex justify-center gap-3">
            <Button onClick={() => { setScore({ correct: 0, total: 0, streak: 0 }); void next(); }}><RotateCcw /> New quiz</Button>
            {session && <Button variant="outline" asChild><Link href="/dashboard/progress">View progress</Link></Button>}
          </div>
        </div>
      ) : problem ? (
        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          <p className="text-sm font-medium text-muted-foreground">Question {score.total + (result ? 0 : 1)} of {QUIZ_LENGTH} · {problem.instruction}</p>
          <div className="my-6 overflow-x-auto text-2xl"><Tex tex={problem.prompt} display /></div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (result) void next();
              else void check();
            }}
            className="flex flex-col gap-2 sm:flex-row"
          >
            <Input value={answer} onChange={(e) => setAnswer(e.target.value)} disabled={!!result || loading} placeholder={problem.answerKind === "set" ? "e.g. x = 2, x = -3" : problem.answerKind === "pair" ? "e.g. x = 1, y = 2" : problem.answerKind === "number" ? "e.g. 12 or 3/4" : "your answer"} className="h-12 font-mono text-base" aria-label="Your answer" autoFocus />
            {result ? (
              <Button type="submit" size="lg">Next <ArrowRight /></Button>
            ) : (
              <Button type="submit" size="lg" disabled={loading || !answer.trim()}>{loading ? <Loader2 className="animate-spin" /> : null} Check</Button>
            )}
          </form>
          {!result && (
            <button type="button" onClick={() => setShowHint((h) => !h)} className="mt-3 inline-flex cursor-pointer items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
              <Lightbulb className="size-4" /> {showHint ? "Hide hint" : "Show hint"}
            </button>
          )}
          {showHint && !result && <p className="mt-2 rounded-lg bg-amber-500/10 p-3 text-sm"><MathText text={problem.hint} /></p>}
          {result && (
            <div className={cn("mt-4 flex flex-wrap items-center gap-3 rounded-xl p-4", result.correct ? "bg-success/10" : "bg-destructive/10")}>
              {result.correct ? <CheckCircle2 className="size-6 text-success" /> : <XCircle className="size-6 text-destructive" />}
              <div className="flex-1">
                <p className="font-medium">{result.feedback}</p>
                {!result.correct && <p className="text-sm">Correct answer: <Tex tex={result.answer} /></p>}
              </div>
              <Button variant="outline" size="sm" onClick={() => void showSolution()} disabled={solving}>{solving ? <Loader2 className="animate-spin" /> : <BookOpen />} Full solution</Button>
            </div>
          )}
        </div>
      ) : (
        <div className="h-48 animate-pulse rounded-2xl bg-muted" />
      )}
      {solution && <SolutionView result={solution} compact />}
    </div>
  );
}
