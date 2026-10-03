import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getProgress } from "@/lib/progress";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/misc";
import { CATEGORY_NAMES, formatDate } from "@/lib/utils";
import { isoDay } from "@/lib/time";

export default async function ProgressPage() {
  const user = (await getCurrentUser())!;
  const p = await getProgress(user.id);
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = isoDay(29 - i);
    return { date: d, ...(p.daily.find((x) => x.date === d) ?? { attempts: 0, correct: 0 }) };
  });
  const max = Math.max(1, ...days.map((d) => d.attempts));
  const maxCat = Math.max(1, ...p.categories.map((c) => c.count));
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Learning progress</h1>
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { label: "Practice questions", value: p.summary.attempts },
          { label: "Accuracy", value: `${Math.round(p.summary.accuracy * 100)}%` },
          { label: "Day streak", value: p.summary.streak },
          { label: "Problems solved (30d)", value: p.summary.solvesLast30 },
        ].map((s) => (
          <Card key={s.label} className="p-5"><p className="text-sm text-muted-foreground">{s.label}</p><p className="mt-1 text-3xl font-semibold">{s.value}</p></Card>
        ))}
      </div>
      <Card>
        <CardHeader><CardTitle>Practice activity (last 30 days)</CardTitle></CardHeader>
        <CardContent>
          <div className="flex h-40 items-end gap-1" role="img" aria-label="Daily practice activity chart">
            {days.map((d) => (
              <div key={d.date} className="group relative flex flex-1 flex-col justify-end" title={`${d.date}: ${d.correct}/${d.attempts} correct`}>
                <div className="rounded-t bg-primary/25" style={{ height: `${(d.attempts / max) * 100}%` }}>
                  <div className="w-full rounded-t bg-primary" style={{ height: `${d.attempts ? (d.correct / d.attempts) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Dark = correct, light = attempted.</p>
        </CardContent>
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Mastery by topic</CardTitle></CardHeader>
          <CardContent>
            {p.topics.length === 0 ? (
              <p className="text-sm text-muted-foreground">No practice yet. <Link href="/practice" className="text-primary">Start practicing →</Link></p>
            ) : (
              <Table>
                <THead><TR><TH>Topic</TH><TH>Accuracy</TH><TH>Mastery</TH><TH>Last</TH><TH /></TR></THead>
                <TBody>
                  {p.topics.map((t) => (
                    <TR key={t.topic}>
                      <TD className="font-medium">{t.label}</TD>
                      <TD>{t.correct}/{t.attempts}</TD>
                      <TD>
                        <div className="h-2 w-24 overflow-hidden rounded-full bg-muted"><div className={`h-full ${t.mastery >= 0.7 ? "bg-success" : t.mastery >= 0.4 ? "bg-warning" : "bg-destructive"}`} style={{ width: `${t.mastery * 100}%` }} /></div>
                      </TD>
                      <TD className="text-xs text-muted-foreground">{formatDate(t.lastPracticeAt)}</TD>
                      <TD><Button size="sm" variant="ghost" asChild><Link href={`/practice?topic=${t.topic}`}>Practice</Link></Button></TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>What you solve most</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {p.categories.length === 0 && <p className="text-sm text-muted-foreground">Your solved problems will appear here.</p>}
            {p.categories.slice(0, 8).map((c) => (
              <div key={c.category}>
                <div className="flex justify-between text-sm"><span>{CATEGORY_NAMES[c.category] ?? c.category}</span><span className="text-muted-foreground">{c.count}</span></div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${(c.count / maxCat) * 100}%` }} /></div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
