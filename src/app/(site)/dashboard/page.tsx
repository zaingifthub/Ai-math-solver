import Link from "next/link";
import { Sigma, MessageCircle, Target, Camera, ShieldCheck, ArrowRight, Flame } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getProgress } from "@/lib/progress";
import { LIMITS } from "@/lib/plans";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CATEGORY_NAMES, timeAgo } from "@/lib/utils";

export default async function DashboardPage() {
  const user = (await getCurrentUser())!;
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const [recent, usage, progress] = await Promise.all([
    prisma.problem.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 6, select: { id: true, input: true, answer: true, category: true, verified: true, createdAt: true } }),
    prisma.usageEvent.groupBy({ by: ["kind"], where: { userId: user.id, createdAt: { gte: start }, success: true }, _count: { _all: true } }),
    getProgress(user.id),
  ]);
  const used = (k: string) => usage.find((u) => u.kind === k)?._count._all ?? 0;
  const limits = LIMITS[user.plan];
  const meters = [
    { label: "Solutions", used: used("SOLVE"), limit: limits.solvesPerDay },
    { label: "AI explanations", used: used("AI_EXPLAIN"), limit: limits.aiExplanationsPerDay },
    { label: "Tutor messages", used: used("TUTOR"), limit: limits.tutorMessagesPerDay },
    { label: "Photo scans", used: used("OCR"), limit: limits.imageScansPerDay },
  ];
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Hi {user.name?.split(" ")[0] ?? "there"} 👋</h1>
          <p className="text-muted-foreground">Here&apos;s your learning at a glance.</p>
        </div>
        <Badge variant={user.plan === "FREE" ? "secondary" : "default"} className="text-sm">{user.plan === "FREE" ? "Free plan" : `${user.plan[0]}${user.plan.slice(1).toLowerCase()} plan`}</Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { href: "/solver", label: "Solve a problem", icon: Sigma },
          { href: "/solver", label: "Scan a photo", icon: Camera },
          { href: "/tutor", label: "Ask the tutor", icon: MessageCircle },
          { href: "/practice", label: "Practice", icon: Target },
        ].map((a) => (
          <Link key={a.label} href={a.href} className="flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-primary/40">
            <a.icon className="size-5 text-primary" /> <span className="font-medium">{a.label}</span>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between"><CardTitle>Recent problems</CardTitle><Button variant="ghost" size="sm" asChild><Link href="/dashboard/history">View all <ArrowRight /></Link></Button></CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">No problems yet. <Link href="/solver" className="text-primary">Solve your first one →</Link></p>
            ) : (
              <ul className="divide-y">
                {recent.map((p) => (
                  <li key={p.id}>
                    <Link href={`/dashboard/history/${p.id}`} className="flex items-center gap-3 py-3 hover:text-primary">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-mono text-sm">{p.input}</span>
                        <span className="block truncate text-xs text-muted-foreground">= {p.answer}</span>
                      </span>
                      <Badge variant="secondary" className="hidden sm:inline-flex">{CATEGORY_NAMES[p.category] ?? p.category}</Badge>
                      {p.verified && <ShieldCheck className="size-4 text-success" aria-label="Verified" />}
                      <span className="w-16 text-right text-xs text-muted-foreground">{timeAgo(p.createdAt)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Today&apos;s usage</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {meters.map((m) => (
              <div key={m.label}>
                <div className="flex justify-between text-sm"><span>{m.label}</span><span className="text-muted-foreground">{m.used} / {m.limit >= 1000 ? "∞" : m.limit}</span></div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (m.used / Math.max(1, m.limit)) * 100)}%` }} /></div>
              </div>
            ))}
            {user.plan === "FREE" && <Button className="w-full" asChild><Link href="/pricing">Upgrade for unlimited</Link></Button>}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Practice stats</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-3 gap-3 text-center">
            <div><p className="text-2xl font-semibold">{progress.summary.attempts}</p><p className="text-xs text-muted-foreground">Questions</p></div>
            <div><p className="text-2xl font-semibold">{Math.round(progress.summary.accuracy * 100)}%</p><p className="text-xs text-muted-foreground">Accuracy</p></div>
            <div><p className="flex items-center justify-center gap-1 text-2xl font-semibold"><Flame className="size-5 text-orange-500" />{progress.summary.streak}</p><p className="text-xs text-muted-foreground">Day streak</p></div>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Focus areas</CardTitle></CardHeader>
          <CardContent>
            {progress.weak.length === 0 ? (
              <p className="text-sm text-muted-foreground">Answer at least 3 practice questions in a topic to get personalized recommendations.</p>
            ) : (
              <ul className="space-y-3">
                {progress.weak.map((w) => (
                  <li key={w.topic} className="flex items-center justify-between gap-3">
                    <span><span className="font-medium">{w.label}</span> <span className="text-sm text-muted-foreground">· {Math.round(w.accuracy * 100)}% accuracy</span></span>
                    <Button size="sm" variant="outline" asChild><Link href={`/practice?topic=${w.topic}`}>Practice</Link></Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
