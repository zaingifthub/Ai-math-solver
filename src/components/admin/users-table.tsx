"use client";
import { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Input, NativeSelect } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { formatDate } from "@/lib/utils";

interface U { id: string; name: string | null; email: string | null; role: string; plan: string; status: string; credits: number; createdAt: string; lastLoginAt: string | null; _count: { problems: number } }

export function UsersTable() {
  const toast = useToast();
  const [q, setQ] = useState("");
  const [plan, setPlan] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: U[]; total: number; perPage: number } | null>(null);

  const load = useCallback(async () => {
    const p = new URLSearchParams({ page: String(page), ...(q ? { q } : {}), ...(plan ? { plan } : {}) });
    try {
      setData(await apiFetch(`/api/admin/users?${p}`));
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }, [page, q, plan, toast]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 250);
    return () => clearTimeout(t);
  }, [load]);

  const update = async (id: string, patch: Partial<U>) => {
    try {
      await apiFetch(`/api/admin/users/${id}`, { method: "PATCH", json: patch });
      setData((d) => (d ? { ...d, items: d.items.map((u) => (u.id === id ? { ...u, ...patch } : u)) } : d));
      toast("User updated", "success");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  const remove = async (u: U) => {
    if (!confirm(`Permanently delete ${u.email}? This removes all of their data.`)) return;
    try {
      await apiFetch(`/api/admin/users/${u.id}`, { method: "DELETE" });
      setData((d) => (d ? { ...d, items: d.items.filter((x) => x.id !== u.id), total: d.total - 1 } : d));
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  const pages = data ? Math.ceil(data.total / data.perPage) : 1;
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" placeholder="Search by name or email" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div>
        <NativeSelect className="sm:w-44" value={plan} onChange={(e) => { setPlan(e.target.value); setPage(1); }} aria-label="Filter by plan"><option value="">All plans</option><option>FREE</option><option>PREMIUM</option><option>EDUCATION</option></NativeSelect>
      </div>
      <div className="rounded-xl border bg-card">
        <Table>
          <THead><TR><TH>User</TH><TH>Role</TH><TH>Plan</TH><TH>Status</TH><TH>Credits</TH><TH>Problems</TH><TH>Joined</TH><TH /></TR></THead>
          <TBody>
            {data?.items.map((u) => (
              <TR key={u.id}>
                <TD><p className="font-medium">{u.name ?? "—"}</p><p className="text-xs text-muted-foreground">{u.email}</p></TD>
                <TD><NativeSelect className="h-8 w-28 py-0 text-xs" value={u.role} onChange={(e) => void update(u.id, { role: e.target.value })}><option>USER</option><option>EDITOR</option><option>ADMIN</option></NativeSelect></TD>
                <TD><NativeSelect className="h-8 w-32 py-0 text-xs" value={u.plan} onChange={(e) => void update(u.id, { plan: e.target.value })}><option>FREE</option><option>PREMIUM</option><option>EDUCATION</option></NativeSelect></TD>
                <TD>
                  <button type="button" className="cursor-pointer" onClick={() => void update(u.id, { status: u.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE" })} title="Toggle suspension">
                    <Badge variant={u.status === "ACTIVE" ? "success" : "destructive"}>{u.status}</Badge>
                  </button>
                </TD>
                <TD><Input className="h-8 w-20 text-xs" type="number" min={0} defaultValue={u.credits} onBlur={(e) => Number(e.target.value) !== u.credits && void update(u.id, { credits: Number(e.target.value) })} aria-label="Credits" /></TD>
                <TD>{u._count.problems}</TD>
                <TD className="text-xs text-muted-foreground">{formatDate(u.createdAt)}</TD>
                <TD><Button variant="ghost" size="sm" className="text-destructive" onClick={() => void remove(u)}>Delete</Button></TD>
              </TR>
            ))}
          </TBody>
        </Table>
        {data && data.items.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No users found.</p>}
      </div>
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{data?.total ?? 0} users</span>
        <div className="flex gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button><Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button></div>
      </div>
    </div>
  );
}
