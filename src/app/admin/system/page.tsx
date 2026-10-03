import { redirect } from "next/navigation";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { runSystemChecks } from "@/lib/system-checks";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/misc";
import { formatDate } from "@/lib/utils";

export default async function SystemPage() {
  const user = await getCurrentUser();
  if (!hasRole(user?.role, "ADMIN")) redirect("/admin");
  const [checks, locked, suspended, admins] = await Promise.all([
    runSystemChecks(),
    prisma.user.findMany({ where: { lockedUntil: { gt: new Date() } }, select: { email: true, lockedUntil: true } }).catch(() => []),
    prisma.user.findMany({ where: { status: "SUSPENDED" }, select: { email: true, updatedAt: true }, take: 50 }).catch(() => []),
    prisma.user.findMany({ where: { role: { in: ["ADMIN", "EDITOR"] } }, select: { email: true, role: true, lastLoginAt: true } }).catch(() => []),
  ]);
  const icon = { ok: <CheckCircle2 className="size-4 text-success" />, warn: <AlertTriangle className="size-4 text-amber-500" />, error: <XCircle className="size-4 text-destructive" /> };
  const errors = checks.filter((c) => c.status === "error").length;
  const warns = checks.filter((c) => c.status === "warn").length;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">System health & security</h1>
        <p className="text-sm text-muted-foreground">{errors ? `${errors} problem(s) need attention` : "No blocking problems"}{warns ? ` · ${warns} warning(s)` : ""}. Secrets are never displayed.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Configuration checks</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <THead><TR><TH>Area</TH><TH>Check</TH><TH>Status</TH><TH>Details</TH></TR></THead>
            <TBody>
              {checks.map((c) => (
                <TR key={c.area + c.label}><TD className="text-xs text-muted-foreground">{c.area}</TD><TD className="font-medium">{c.label}</TD><TD>{icon[c.status]}</TD><TD className="text-sm">{c.detail}</TD></TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Staff accounts</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">{admins.map((a) => <p key={a.email}>{a.email} <span className="text-xs text-muted-foreground">· {a.role} · last login {a.lastLoginAt ? formatDate(a.lastLoginAt) : "never"}</span></p>)}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Locked (failed logins)</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">{locked.length ? locked.map((u) => <p key={u.email}>{u.email} <span className="text-xs text-muted-foreground">until {u.lockedUntil?.toISOString().slice(11, 16)} UTC</span></p>) : <p className="text-muted-foreground">None</p>}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Suspended users</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">{suspended.length ? suspended.map((u) => <p key={u.email}>{u.email}</p>) : <p className="text-muted-foreground">None</p>}</CardContent>
        </Card>
      </div>
    </div>
  );
}
