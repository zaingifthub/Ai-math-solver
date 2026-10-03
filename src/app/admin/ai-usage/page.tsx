import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/misc";
import { features } from "@/lib/env";
import { AI_MODEL } from "@/lib/ai/client";
import { daysAgo } from "@/lib/time";

export default async function AiUsagePage() {
  const user = await getCurrentUser();
  if (!hasRole(user?.role, "ADMIN")) redirect("/admin");
  const since = daysAgo(30);
  const [byKind, topUsers, failures] = await Promise.all([
    prisma.usageEvent.groupBy({ by: ["kind", "model"], where: { createdAt: { gte: since } }, _count: { _all: true }, _sum: { inputTokens: true, outputTokens: true, costMicros: true } }),
    prisma.usageEvent.groupBy({ by: ["userId"], where: { createdAt: { gte: since }, userId: { not: null }, kind: { in: ["AI_EXPLAIN", "TUTOR", "OCR"] } }, _count: { _all: true }, _sum: { costMicros: true }, orderBy: { _sum: { costMicros: "desc" } }, take: 10 }),
    prisma.usageEvent.count({ where: { createdAt: { gte: since }, success: false } }),
  ]);
  const users = await prisma.user.findMany({ where: { id: { in: topUsers.map((u) => u.userId!).filter(Boolean) } }, select: { id: true, email: true, plan: true } });
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">AI usage</h1>
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-5"><p className="text-sm text-muted-foreground">AI status</p><p className="mt-1 text-lg font-semibold">{features.ai ? "Enabled" : "Disabled"}</p></Card>
        <Card className="p-5"><p className="text-sm text-muted-foreground">Model</p><p className="mt-1 font-mono text-lg font-semibold">{AI_MODEL}</p></Card>
        <Card className="p-5"><p className="text-sm text-muted-foreground">Failed requests (30d)</p><p className="mt-1 text-lg font-semibold">{failures}</p></Card>
      </div>
      <Card>
        <CardHeader><CardTitle>Last 30 days by feature</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <THead><TR><TH>Feature</TH><TH>Model</TH><TH>Requests</TH><TH>Input tokens</TH><TH>Output tokens</TH><TH>Est. cost</TH></TR></THead>
            <TBody>
              {byKind.map((k) => (
                <TR key={`${k.kind}-${k.model}`}><TD>{k.kind}</TD><TD className="font-mono text-xs">{k.model ?? "—"}</TD><TD>{k._count._all}</TD><TD>{(k._sum.inputTokens ?? 0).toLocaleString()}</TD><TD>{(k._sum.outputTokens ?? 0).toLocaleString()}</TD><TD>${((k._sum.costMicros ?? 0) / 1e6).toFixed(2)}</TD></TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Top AI users (30d)</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <THead><TR><TH>User</TH><TH>Plan</TH><TH>AI requests</TH><TH>Est. cost</TH></TR></THead>
            <TBody>
              {topUsers.map((u) => {
                const info = users.find((x) => x.id === u.userId);
                return <TR key={u.userId}><TD>{info?.email ?? u.userId}</TD><TD>{info?.plan}</TD><TD>{u._count._all}</TD><TD>${((u._sum.costMicros ?? 0) / 1e6).toFixed(2)}</TD></TR>;
              })}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
