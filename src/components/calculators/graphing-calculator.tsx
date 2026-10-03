"use client";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { GraphCanvas, GRAPH_COLORS, type GraphPoint } from "@/components/graph/graph-canvas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function GraphingCalculator({ initial = ["x^2 - 4", "x + 2"] }: { initial?: string[] }) {
  const [exprs, setExprs] = useState<string[]>(initial);
  const [applied, setApplied] = useState<string[]>(initial);
  const [pointsText, setPointsText] = useState("");
  const [markers, setMarkers] = useState<{ roots: GraphPoint[]; intersections: GraphPoint[] }>({ roots: [], intersections: [] });

  const points: GraphPoint[] = [...pointsText.matchAll(/\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)/g)].map((m) => ({ x: Number(m[1]), y: Number(m[2]), label: `(${m[1]}, ${m[2]})` }));
  const apply = (next = exprs) => setApplied(next.map((e) => e.trim()).filter(Boolean));

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <div className="space-y-4">
        <div className="rounded-2xl border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">Functions y =</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              apply();
            }}
            className="space-y-2"
          >
            {exprs.map((ex, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="size-3 shrink-0 rounded-full" style={{ background: GRAPH_COLORS[i % GRAPH_COLORS.length] }} aria-hidden />
                <Input value={ex} onChange={(e) => setExprs((xs) => xs.map((x, j) => (j === i ? e.target.value : x)))} onBlur={() => apply()} className="font-mono" aria-label={`Function ${i + 1}`} placeholder="e.g. sin(x)" />
                <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove function" onClick={() => { const next = exprs.filter((_, j) => j !== i); setExprs(next); apply(next); }}>
                  <Trash2 />
                </Button>
              </div>
            ))}
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" size="sm" onClick={() => setExprs((xs) => [...xs, ""])} disabled={exprs.length >= 8}><Plus /> Add function</Button>
              <Button type="submit" size="sm">Plot</Button>
            </div>
          </form>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <label htmlFor="points" className="mb-2 block text-sm font-semibold">Points</label>
          <Input id="points" value={pointsText} onChange={(e) => setPointsText(e.target.value)} placeholder="(1, 2), (3, -1)" className="font-mono" />
        </div>
        <div className="rounded-2xl border bg-card p-4 text-sm">
          <h2 className="mb-2 font-semibold">Roots (visible)</h2>
          <p className="font-mono text-xs text-muted-foreground">{markers.roots.length ? markers.roots.map((r) => `x = ${r.x}`).join(", ") : "none in view"}</p>
          <h2 className="mb-2 mt-3 font-semibold">Intersections</h2>
          <p className="font-mono text-xs text-muted-foreground">{markers.intersections.length ? markers.intersections.map((r) => `(${r.x}, ${r.y})`).join(", ") : "none in view"}</p>
        </div>
      </div>
      <GraphCanvas expressions={applied} points={points} height={520} onMarkers={setMarkers} />
    </div>
  );
}
