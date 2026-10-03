import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/misc";

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await getCurrentUser();
  if (!hasRole(user?.role, "ADMIN")) redirect("/admin");
  const page = Math.max(1, Number((await searchParams).page ?? 1) || 1);
  const items = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, skip: (page - 1) * 50, take: 50, include: { actor: { select: { email: true } } } });
  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Audit log</h1>
      <div className="rounded-xl border bg-card">
        <Table>
          <THead><TR><TH>Time</TH><TH>Actor</TH><TH>Action</TH><TH>Entity</TH><TH>IP</TH><TH>Details</TH></TR></THead>
          <TBody>
            {items.map((a) => (
              <TR key={a.id}>
                <TD className="whitespace-nowrap text-xs">{a.createdAt.toISOString().replace("T", " ").slice(0, 19)}</TD>
                <TD className="text-xs">{a.actor?.email ?? "system"}</TD>
                <TD className="font-mono text-xs">{a.action}</TD>
                <TD className="text-xs">{a.entityType}{a.entityId ? ` · ${a.entityId.slice(0, 12)}` : ""}</TD>
                <TD className="font-mono text-xs text-muted-foreground">{a.ip ?? "—"}</TD>
                <TD className="max-w-xs truncate font-mono text-[11px] text-muted-foreground">{a.metadata ? JSON.stringify(a.metadata) : ""}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
        {items.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No audit events yet.</p>}
      </div>
      <div className="mt-4 flex gap-2">
        {page > 1 && <a className="text-sm text-primary" href={`?page=${page - 1}`}>← Newer</a>}
        {items.length === 50 && <a className="text-sm text-primary" href={`?page=${page + 1}`}>Older →</a>}
      </div>
    </div>
  );
}
