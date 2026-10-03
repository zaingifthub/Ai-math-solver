import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { features } from "@/lib/env";
import { PLANS, LIMITS } from "@/lib/plans";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/misc";
import { ManageBillingButton } from "@/components/dashboard/billing-actions";
import { formatDate } from "@/lib/utils";

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const u = (await getCurrentUser())!;
  const { status } = await searchParams;
  const [user, sub] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: u.id }, select: { plan: true, credits: true, stripeCustomerId: true } }),
    prisma.subscription.findFirst({ where: { userId: u.id }, orderBy: { updatedAt: "desc" } }),
  ]);
  const plan = PLANS.find((p) => p.id === user.plan)!;
  const limits = LIMITS[user.plan];
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Plan & billing</h1>
      {status === "success" && <Alert variant="success">Thanks for upgrading! Your plan will update within a few seconds.</Alert>}
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">{plan.name} plan <Badge>{user.plan === "FREE" ? "Free" : sub?.status ?? "Active"}</Badge></CardTitle>
            <CardDescription>{plan.tagline}</CardDescription>
          </div>
          {user.plan === "FREE" ? <Button asChild><Link href="/pricing">Upgrade</Link></Button> : features.stripe && user.stripeCustomerId ? <ManageBillingButton /> : null}
        </CardHeader>
        <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
          <div className="rounded-lg bg-muted/40 p-4">
            <p className="font-medium">Daily limits</p>
            <ul className="mt-2 space-y-1 text-muted-foreground">
              <li>Solutions: {limits.solvesPerDay >= 1000 ? "Unlimited" : limits.solvesPerDay}</li>
              <li>AI explanations: {limits.aiExplanationsPerDay >= 500 ? "Unlimited" : limits.aiExplanationsPerDay}</li>
              <li>Tutor messages: {limits.tutorMessagesPerDay >= 500 ? "Unlimited" : limits.tutorMessagesPerDay}</li>
              <li>Photo scans: {limits.imageScansPerDay >= 200 ? "Unlimited" : limits.imageScansPerDay}</li>
            </ul>
          </div>
          <div className="rounded-lg bg-muted/40 p-4">
            <p className="font-medium">Subscription</p>
            {sub ? (
              <ul className="mt-2 space-y-1 text-muted-foreground">
                <li>Status: {sub.status.toLowerCase()}</li>
                {sub.currentPeriodEnd && <li>{sub.cancelAtPeriodEnd ? "Ends" : "Renews"} on {formatDate(sub.currentPeriodEnd)}</li>}
              </ul>
            ) : (
              <p className="mt-2 text-muted-foreground">No active subscription.</p>
            )}
            <p className="mt-3 font-medium">Bonus credits</p>
            <p className="text-muted-foreground">{user.credits} credits (used automatically after daily limits)</p>
          </div>
        </CardContent>
      </Card>
      {!features.stripe && <p className="text-sm text-muted-foreground">Online payments are not enabled on this server yet.</p>}
    </div>
  );
}
