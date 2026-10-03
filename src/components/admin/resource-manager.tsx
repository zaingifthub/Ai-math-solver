"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Search, ExternalLink, Pencil, Trash2, Loader2, Eye } from "lucide-react";
import { RESOURCE_UI, type AdminField } from "./resource-config";
import { Button } from "@/components/ui/button";
import { Input, Textarea, NativeSelect } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/misc";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { MarkdownMath } from "@/components/math/markdown-math";
import { Tex } from "@/components/math/tex";
import { apiFetch } from "@/lib/api-client";
import { formatDate } from "@/lib/utils";

type Row = Record<string, unknown>;

const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100);
const get = (row: Row, path: string): unknown => path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Row)[k] : undefined), row);

function display(v: unknown): React.ReactNode {
  if (typeof v === "boolean") return v ? <Badge variant="success">Yes</Badge> : <Badge variant="secondary">No</Badge>;
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) return formatDate(v);
  if (v === "PUBLISHED") return <Badge variant="success">Published</Badge>;
  if (v === "DRAFT") return <Badge variant="secondary">Draft</Badge>;
  if (v === "ARCHIVED") return <Badge variant="outline">Archived</Badge>;
  return v === null || v === undefined || v === "" ? "—" : String(v);
}

function toFormValue(field: AdminField, v: unknown): string | boolean {
  if (field.kind === "checkbox") return Boolean(v ?? (field.name === "enabled" || field.name === "published"));
  if (field.kind === "tags") return Array.isArray(v) ? v.join(", ") : "";
  if (field.kind === "json") return v === undefined || v === null ? "" : JSON.stringify(v, null, 2);
  if (field.kind === "datetime") return v ? new Date(String(v)).toISOString().slice(0, 16) : "";
  return v === null || v === undefined ? "" : String(v);
}

function fromForm(field: AdminField, v: string | boolean): unknown {
  switch (field.kind) {
    case "checkbox": return Boolean(v);
    case "number": return v === "" ? undefined : Number(v);
    case "tags": return String(v).split(",").map((t) => t.trim()).filter(Boolean);
    case "json": {
      if (String(v).trim() === "") return field.name === "faqs" ? null : [];
      return JSON.parse(String(v));
    }
    case "datetime": return v ? new Date(String(v)).toISOString() : null;
    default: return v === "" ? null : v;
  }
}

export function ResourceManager({ resource }: { resource: string }) {
  const ui = RESOURCE_UI[resource];
  const toast = useToast();
  const idField = ui.idField ?? "id";
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: Row[]; total: number; perPage: number } | null>(null);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState<Record<string, string | boolean>>({});
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [categories, setCategories] = useState<{ value: string; label: string }[]>([]);

  const load = useCallback(async () => {
    try {
      setData(await apiFetch(`/api/admin/${resource}?page=${page}${q ? `&q=${encodeURIComponent(q)}` : ""}`));
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }, [resource, page, q, toast]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 200);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    if (!ui.fields.some((f) => f.optionsFrom === "categories")) return;
    apiFetch<{ items: Row[] }>("/api/admin/categories?perPage=100")
      .then((r) => setCategories([{ value: "", label: "None" }, ...r.items.map((c) => ({ value: String(c.id), label: String(c.name) }))]))
      .catch(() => undefined);
  }, [ui.fields]);

  const open = (row: Row | null) => {
    setEditing(row ?? {});
    setForm(Object.fromEntries(ui.fields.map((f) => [f.name, toFormValue(f, row ? row[f.name] : f.kind === "select" && f.options ? f.options[0]?.value : undefined)])));
  };

  const save = async () => {
    if (!editing) return;
    let payload: Row;
    try {
      payload = Object.fromEntries(ui.fields.map((f) => [f.name, fromForm(f, form[f.name] ?? "")]).filter(([, v]) => v !== undefined));
    } catch {
      toast("One of the JSON fields is invalid.", "error");
      return;
    }
    setSaving(true);
    try {
      const id = editing[idField];
      if (id) await apiFetch(`/api/admin/${resource}/${encodeURIComponent(String(id))}`, { method: "PATCH", json: payload });
      else await apiFetch(`/api/admin/${resource}`, { method: "POST", json: payload });
      toast(`${ui.singular[0].toUpperCase()}${ui.singular.slice(1)} saved`, "success");
      setEditing(null);
      void load();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row: Row) => {
    if (!confirm(`Delete this ${ui.singular}? This cannot be undone.`)) return;
    try {
      await apiFetch(`/api/admin/${resource}/${encodeURIComponent(String(row[idField]))}`, { method: "DELETE" });
      toast("Deleted", "success");
      void load();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  const setField = (name: string, v: string | boolean) =>
    setForm((f) => {
      const next = { ...f, [name]: v };
      const editingExisting = Boolean(editing?.[idField]);
      if (!editingExisting && (name === "title" || name === "name") && ui.fields.some((x) => x.kind === "slug") && (!f.slug || f.slug === slugify(String(f[name] ?? "")))) next.slug = slugify(String(v));
      return next;
    });

  const pages = data ? Math.ceil(data.total / data.perPage) : 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{ui.title}</h1>
        <Button onClick={() => open(null)}><Plus /> New {ui.singular}</Button>
      </div>
      <div className="relative max-w-md"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" placeholder="Search…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div>
      <div className="rounded-xl border bg-card">
        <Table>
          <THead><TR>{ui.columns.map((c) => <TH key={c.key}>{c.label}</TH>)}<TH className="text-right">Actions</TH></TR></THead>
          <TBody>
            {data?.items.map((row) => {
              const url = ui.publicUrl?.(row);
              return (
                <TR key={String(row[idField])}>
                  {ui.columns.map((c, i) => <TD key={c.key} className={i === 0 ? "max-w-sm truncate font-medium" : "text-sm"}>{display(get(row, c.key))}</TD>)}
                  <TD className="text-right">
                    <div className="flex justify-end gap-1">
                      {url && <Button variant="ghost" size="icon-sm" asChild><Link href={url} target="_blank" aria-label="View on site"><ExternalLink /></Link></Button>}
                      <Button variant="ghost" size="icon-sm" onClick={() => open(row)} aria-label="Edit"><Pencil /></Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => void remove(row)} aria-label="Delete"><Trash2 /></Button>
                    </div>
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
        {data && data.items.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">Nothing here yet.</p>}
        {!data && <p className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Loading…</p>}
      </div>
      {pages > 1 && (
        <div className="flex justify-end gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button><Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button></div>
      )}

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>{editing?.[idField] ? `Edit ${ui.singular}` : `New ${ui.singular}`}</DialogTitle></DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
            className="grid gap-4"
          >
            {ui.fields.map((f) => {
              const id = `fld-${f.name}`;
              const val = form[f.name];
              const options = f.optionsFrom === "categories" ? categories : f.options ?? [];
              return (
                <div key={f.name} className="space-y-1.5">
                  {f.kind === "checkbox" ? (
                    <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={Boolean(val)} onChange={(e) => setField(f.name, e.target.checked)} className="size-4 accent-[var(--primary)]" /> {f.label}</label>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <Label htmlFor={id}>{f.label}{f.required && " *"}</Label>
                        {f.kind === "markdown" && <button type="button" onClick={() => setPreview(preview === f.name ? null : f.name)} className="inline-flex cursor-pointer items-center gap-1 text-xs text-primary"><Eye className="size-3.5" /> {preview === f.name ? "Edit" : "Preview"}</button>}
                      </div>
                      {f.kind === "select" ? (
                        <NativeSelect id={id} value={String(val ?? "")} onChange={(e) => setField(f.name, e.target.value)} required={f.required} disabled={f.name === "slug" && Boolean(editing?.[idField]) && resource === "calculators"}>
                          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </NativeSelect>
                      ) : f.kind === "markdown" ? (
                        preview === f.name ? (
                          <div className="max-h-96 overflow-y-auto rounded-lg border p-4"><MarkdownMath source={String(val ?? "")} /></div>
                        ) : (
                          <Textarea id={id} value={String(val ?? "")} onChange={(e) => setField(f.name, e.target.value)} rows={14} className="font-mono text-xs" required={f.required} />
                        )
                      ) : f.kind === "textarea" || f.kind === "json" ? (
                        <Textarea id={id} value={String(val ?? "")} onChange={(e) => setField(f.name, e.target.value)} rows={f.kind === "json" ? 6 : 3} className={f.kind === "json" ? "font-mono text-xs" : ""} required={f.required} />
                      ) : f.kind === "latex" ? (
                        <>
                          <Input id={id} value={String(val ?? "")} onChange={(e) => setField(f.name, e.target.value)} className="font-mono" required={f.required} />
                          {val ? <div className="overflow-x-auto rounded-lg bg-muted/40 p-2"><Tex tex={String(val)} display /></div> : null}
                        </>
                      ) : (
                        <Input id={id} type={f.kind === "number" ? "number" : f.kind === "datetime" ? "datetime-local" : "text"} value={String(val ?? "")} onChange={(e) => setField(f.name, e.target.value)} required={f.required} className={f.kind === "slug" ? "font-mono" : ""} />
                      )}
                    </>
                  )}
                  {f.help && <p className="text-xs text-muted-foreground">{f.help}</p>}
                </div>
              );
            })}
            <div className="flex justify-end gap-2 border-t pt-4">
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving && <Loader2 className="animate-spin" />} Save</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
