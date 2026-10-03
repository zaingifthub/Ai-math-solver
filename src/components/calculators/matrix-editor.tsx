"use client";
import { useEffect, useState } from "react";
import { NativeSelect } from "@/components/ui/input";

function parse(value: string): string[][] {
  try {
    const arr = JSON.parse(value) as unknown;
    if (Array.isArray(arr) && arr.every((r) => Array.isArray(r))) return (arr as unknown[][]).map((r) => r.map((x) => String(x)));
  } catch {
    /* fallthrough */
  }
  return [["1", "0"], ["0", "1"]];
}

/** Grid editor for small matrices; emits the [[...]] literal accepted by the engine. */
export function MatrixEditor({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const [cells, setCells] = useState<string[][]>(() => parse(value));
  const rows = cells.length;
  const cols = cells[0]?.length ?? 0;

  useEffect(() => {
    onChange(`[${cells.map((r) => `[${r.map((c) => c.trim() || "0").join(", ")}]`).join(", ")}]`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cells]);

  const resize = (r: number, c: number) => setCells((prev) => Array.from({ length: r }, (_, i) => Array.from({ length: c }, (_, j) => prev[i]?.[j] ?? (i === j ? "1" : "0"))));

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Size</span>
        <NativeSelect className="h-8 w-16 py-0" value={rows} onChange={(e) => resize(Number(e.target.value), cols)} aria-label={`${label} rows`}>
          {[1, 2, 3, 4, 5, 6].map((n) => <option key={n}>{n}</option>)}
        </NativeSelect>
        <span>×</span>
        <NativeSelect className="h-8 w-16 py-0" value={cols} onChange={(e) => resize(rows, Number(e.target.value))} aria-label={`${label} columns`}>
          {[1, 2, 3, 4, 5, 6].map((n) => <option key={n}>{n}</option>)}
        </NativeSelect>
      </div>
      <div className="inline-grid gap-1.5 rounded-lg border-x-2 border-foreground/60 px-2 py-1" style={{ gridTemplateColumns: `repeat(${cols}, minmax(3rem, 4rem))` }}>
        {cells.map((r, i) =>
          r.map((c, j) => (
            <input
              key={`${i}-${j}`}
              value={c}
              inputMode="decimal"
              aria-label={`${label} row ${i + 1} column ${j + 1}`}
              onChange={(e) => setCells((prev) => prev.map((row, a) => row.map((x, b) => (a === i && b === j ? e.target.value : x))))}
              className="h-9 rounded-md border bg-card px-1 text-center font-mono text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          )),
        )}
      </div>
    </div>
  );
}
