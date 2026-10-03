import { getAdminStats } from "@/lib/admin-stats";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { CATEGORY_NAMES } from "@/lib/utils";

export default async function AdminHome() {
  const s = await getAdminStats();
  const maxSolves = Math.max(1, ...s.daily.map((d) => d.solves));
  const cards = [
    { label: "Total users", value: s.users.total.toLocaleString() },
    { label: "New users (30d)", value: s.users.new30.toLocaleString() },
    { label: "Paid users", value: `${s.users.premium + s.users.education} (${(s.users.conversion * 100).toFixed(1)}%)` },
    { label: "Active subscriptions", value: s.subscriptions.active },
    { label: "Problems (24h)", value: s.problems.last24h.toLocaleString() },
    { label: "Problems (30d)", value: s.problems.last30.toLocaleString() },
    { label: "AI requests (30d)", value: s.ai.requests30.toLocaleString() },
    { label: "AI cost (30d, est.)", value: `$${s.ai.costUsd.toFixed(2)}` },
  ];
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label} className="p-5"><p className="text-sm text-muted-foreground">{c.label}</p><p className="mt-1 text-2xl font-semibold">{c.value}</p></Card>
        ))}
      </div>
      <Card>
        <CardHeader><CardTitle>Solves & signups — last 30 days</CardTitle></CardHeader>
        <CardContent>
          <div className="flex h-48 items-end gap-1" role="img" aria-label="Daily solves chart">
            {s.daily.map((d) => (
              <div key={d.day} className="flex flex-1 flex-col items-center justify-end gap-1" title={`${d.day}: ${d.solves} solves, ${d.signups} signups`}>
                <div className="w-full rounded-t bg-primary/80" style={{ height: `${(d.solves / maxSolves) * 100}%`, minHeight: d.solves ? 2 : 0 }} />
                {d.signups > 0 && <span className="size-1.5 rounded-full bg-success" />}
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Bars = solves per day; green dots = days with signups.</p>
        </CardContent>
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Top problem categories (30d)</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {s.topCategories.map((c) => <li key={c.category} className="flex justify-between"><span>{CATEGORY_NAMES[c.category] ?? c.category}</span><span className="text-muted-foreground">{c.count}</span></li>)}
              {s.topCategories.length === 0 && <li className="text-muted-foreground">No data yet.</li>}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Usage by type (30d)</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {s.usageByKind.map((k) => <li key={k.kind} className="flex justify-between"><span>{k.kind}</span><span className="text-muted-foreground">{k.count} · ${k.costUsd.toFixed(2)}</span></li>)}
              {s.usageByKind.length === 0 && <li className="text-muted-foreground">No data yet.</li>}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
