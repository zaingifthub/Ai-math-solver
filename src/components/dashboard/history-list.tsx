"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Search, Trash2, Bookmark, BookmarkCheck, ShieldCheck, Camera } from "lucide-react";
import { Input, NativeSelect } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { CATEGORY_NAMES, timeAgo } from "@/lib/utils";

interface Item { id: string; input: string; answer: string | null; category: string; topic: string | null; verified: boolean; source: string; createdAt: string; bookmarked: boolean }

export function HistoryList() {
  const toast = useToast();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: Item[]; pages: number; total: number } | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), ...(q ? { q } : {}), ...(category ? { category } : {}) });
    try {
      setData(await apiFetch(`/api/history?${params}`));
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }, [page, q, category, toast]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 250);
    return () => clearTimeout(t);
  }, [load]);

  const remove = async (id: string) => {
    await apiFetch(`/api/history/${id}`, { method: "DELETE" });
    setData((d) => (d ? { ...d, items: d.items.filter((i) => i.id !== id), total: d.total - 1 } : d));
  };
  const toggleBookmark = async (item: Item) => {
    if (item.bookmarked) await apiFetch(`/api/bookmarks/${item.id}`, { method: "DELETE" });
    else await apiFetch("/api/bookmarks", { method: "POST", json: { problemId: item.id } });
    setData((d) => (d ? { ...d, items: d.items.map((i) => (i.id === item.id ? { ...i, bookmarked: !i.bookmarked } : i)) } : d));
  };
  const clearAll = async () => {
    if (!confirm("Delete your entire solution history? This cannot be undone.")) return;
    await apiFetch("/api/history", { method: "DELETE" });
    setData({ items: [], pages: 0, total: 0 });
    toast("History cleared", "success");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search your problems…" className="pl-9" aria-label="Search history" />
        </div>
        <NativeSelect value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} className="sm:w-48" aria-label="Filter by category">
          <option value="">All topics</option>
          {Object.entries(CATEGORY_NAMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </NativeSelect>
        <Button variant="outline" onClick={() => void clearAll()} disabled={!data?.total}><Trash2 /> Clear</Button>
      </div>
      {!data ? (
        <div className="space-y-2">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : data.items.length === 0 ? (
        <p className="rounded-xl border bg-card p-8 text-center text-muted-foreground">No problems found. <Link href="/solver" className="text-primary">Solve one →</Link></p>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {data.items.map((i) => (
            <li key={i.id} className="flex items-center gap-3 p-3 sm:p-4">
              <Link href={`/dashboard/history/${i.id}`} className="min-w-0 flex-1 hover:text-primary">
                <span className="block truncate font-mono text-sm">{i.input}</span>
                <span className="block truncate text-xs text-muted-foreground">= {i.answer}</span>
              </Link>
              <Badge variant="secondary" className="hidden md:inline-flex">{CATEGORY_NAMES[i.category] ?? i.category}</Badge>
              {i.source === "IMAGE" && <Camera className="size-4 text-muted-foreground" aria-label="From photo" />}
              {i.verified && <ShieldCheck className="size-4 text-success" aria-label="Verified" />}
              <span className="hidden w-16 text-right text-xs text-muted-foreground sm:block">{timeAgo(i.createdAt)}</span>
              <Button variant="ghost" size="icon-sm" onClick={() => void toggleBookmark(i)} aria-label={i.bookmarked ? "Remove bookmark" : "Bookmark"}>{i.bookmarked ? <BookmarkCheck className="text-primary" /> : <Bookmark />}</Button>
              <Button variant="ghost" size="icon-sm" onClick={() => void remove(i.id)} aria-label="Delete"><Trash2 /></Button>
            </li>
          ))}
        </ul>
      )}
      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <span className="text-sm text-muted-foreground">Page {page} of {data.pages}</span>
          <Button variant="outline" size="sm" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
}
