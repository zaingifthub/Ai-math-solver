import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { features } from "@/lib/env";

export default async function SubscriptionsPage() {
  const user = await getCurrentUser();
  if (!hasRole(user?.role, "ADMIN")) redirect("/admin");
  const subs = await prisma.subscription.findMany({ orderBy: { updatedAt: "desc" }, take: 200, include: { user: { select: { email: true } } } });
  const byPlan = await prisma.user.groupBy({ by: ["plan"], _count: { _all: true } });
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Subscriptions</h1>
      {!features.stripe && <p className="rounded-lg border bg-warning/10 p-3 text-sm">Stripe is not configured. Set STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET and price IDs to enable billing.</p>}
      <div className="flex flex-wrap gap-3">{byPlan.map((p) => <div key={p.plan} className="rounded-xl border bg-card px-5 py-3"><p className="text-xs text-muted-foreground">{p.plan}</p><p className="text-xl font-semibold">{p._count._all}</p></div>)}</div>
      <div className="rounded-xl border bg-card">
        <Table>
          <THead><TR><TH>User</TH><TH>Plan</TH><TH>Status</TH><TH>Period end</TH><TH>Stripe ID</TH></TR></THead>
          <TBody>
            {subs.map((s) => (
              <TR key={s.id}>
                <TD>{s.user.email}</TD>
                <TD>{s.plan}</TD>
                <TD><Badge variant={s.status === "ACTIVE" || s.status === "TRIALING" ? "success" : "secondary"}>{s.status}</Badge>{s.cancelAtPeriodEnd && <span className="ml-2 text-xs text-muted-foreground">cancels</span>}</TD>
                <TD className="text-xs">{s.currentPeriodEnd ? formatDate(s.currentPeriodEnd) : "—"}</TD>
                <TD className="font-mono text-xs text-muted-foreground">{s.stripeSubscriptionId}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
        {subs.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No subscriptions yet.</p>}
      </div>
    </div>
  );
}
