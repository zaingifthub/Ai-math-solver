"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const GRAPH_COLORS = ["#6366f1", "#ef4444", "#10b981", "#f59e0b", "#0ea5e9", "#d946ef", "#64748b", "#84cc16"];

export interface GraphPoint {
  x: number;
  y: number;
  label?: string;
}

interface Props {
  expressions: string[];
  points?: GraphPoint[];
  xRange?: [number, number];
  height?: number;
  showRoots?: boolean;
  showIntersections?: boolean;
  className?: string;
  onMarkers?: (m: { roots: GraphPoint[]; intersections: GraphPoint[] }) => void;
}

type Fn = (x: number) => number;

function niceStep(range: number, px: number) {
  const target = range / (px / 80);
  const pow = Math.pow(10, Math.floor(Math.log10(target)));
  for (const m of [1, 2, 5, 10]) if (m * pow >= target) return m * pow;
  return 10 * pow;
}

function fmtTick(v: number, step: number) {
  const digits = Math.max(0, -Math.floor(Math.log10(step)));
  return Math.abs(v) < step / 2 ? "0" : v.toFixed(Math.min(digits, 6));
}

function bisect(f: Fn, a: number, b: number) {
  let fa = f(a);
  for (let i = 0; i < 60; i++) {
    const m = (a + b) / 2;
    const fm = f(m);
    if (Math.sign(fm) === Math.sign(fa)) {
      a = m;
      fa = fm;
    } else b = m;
  }
  return (a + b) / 2;
}

function zeros(f: Fn, lo: number, hi: number, n = 600): number[] {
  const out: number[] = [];
  let px = lo;
  let pf = f(lo);
  for (let i = 1; i <= n; i++) {
    const x = lo + ((hi - lo) * i) / n;
    const fx = f(x);
    if (Number.isFinite(fx) && Number.isFinite(pf) && Math.sign(fx) !== Math.sign(pf)) {
      const r = bisect(f, px, x);
      const scale = Math.max(1, Math.abs(f(px)), Math.abs(f(x)));
      if (Math.abs(f(r)) < 1e-6 * scale) out.push(r);
    } else if (fx === 0) out.push(x);
    px = x;
    pf = fx;
  }
  return out;
}

const round = (v: number) => (Math.abs(v - Math.round(v)) < 1e-9 ? Math.round(v) : Number(v.toPrecision(6)));

export function GraphCanvas({ expressions, points = [], xRange, height = 360, showRoots = true, showIntersections = true, className, onMarkers }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [fns, setFns] = useState<(Fn | null)[]>([]);
  const [size, setSize] = useState({ w: 600, h: height });
  const [lo, hi] = xRange ?? [-10, 10];
  // null = auto-fit the configured x-range to the current width
  const [userView, setUserView] = useState<{ cx: number; cy: number; scale: number } | null>(null);
  const [viewFor, setViewFor] = useState(xRange);
  if (viewFor !== xRange) {
    setViewFor(xRange);
    setUserView(null);
  }
  const fitted = useMemo(() => ({ cx: (lo + hi) / 2, cy: 0, scale: size.w / (hi - lo) }), [lo, hi, size.w]);
  const view = userView ?? fitted;
  const setView = useCallback((u: (v: { cx: number; cy: number; scale: number }) => { cx: number; cy: number; scale: number }) => setUserView((prev) => u(prev ?? fitted)), [fitted]);
  const [hover, setHover] = useState<{ x: number; y: number; px: number; py: number } | null>(null);
  const [markers, setMarkers] = useState<{ roots: GraphPoint[]; intersections: GraphPoint[] }>({ roots: [], intersections: [] });
  const drag = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);
  const pinch = useRef<{ d: number; scale: number } | null>(null);

  // Compile expressions lazily (mathjs is only loaded when a graph is shown)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { compile } = await import("mathjs");
      const compiled = expressions.map((e) => {
        try {
          const c = compile(e.replace(/\bln\(/g, "log(").replace(/^\s*y\s*=\s*/, ""));
          return (x: number) => {
            try {
              const v = c.evaluate({ x });
              return typeof v === "number" ? v : NaN;
            } catch {
              return NaN;
            }
          };
        } catch {
          return null;
        }
      });
      if (!cancelled) setFns(compiled);
    })();
    return () => {
      cancelled = true;
    };
  }, [expressions]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setSize({ w: Math.max(240, entry.contentRect.width), h: height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [height]);

  const toPx = useCallback((x: number, y: number) => [size.w / 2 + (x - view.cx) * view.scale, size.h / 2 - (y - view.cy) * view.scale] as const, [size, view]);
  const toWorld = useCallback((px: number, py: number) => [view.cx + (px - size.w / 2) / view.scale, view.cy - (py - size.h / 2) / view.scale] as const, [size, view]);

  // Roots & intersections in the visible range
  useEffect(() => {
    const t = setTimeout(() => {
      const [x0] = toWorld(0, 0);
      const [x1] = toWorld(size.w, 0);
      const valid = fns.filter((f): f is Fn => !!f);
      const roots: GraphPoint[] = showRoots ? valid.flatMap((f) => zeros(f, x0, x1).map((x) => ({ x: round(x), y: 0 }))) : [];
      const inter: GraphPoint[] = [];
      if (showIntersections) {
        for (let i = 0; i < valid.length; i++)
          for (let j = i + 1; j < valid.length; j++) {
            const f = valid[i];
            const g = valid[j];
            for (const x of zeros((t) => f(t) - g(t), x0, x1)) inter.push({ x: round(x), y: round(f(x)) });
          }
      }
      const m = { roots: roots.slice(0, 30), intersections: inter.slice(0, 30) };
      setMarkers(m);
      onMarkers?.(m);
    }, 120);
    return () => clearTimeout(t);
  }, [fns, view, size, showRoots, showIntersections, toWorld, onMarkers]);

  // Draw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size.w * dpr;
    canvas.height = size.h * dpr;
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const styles = getComputedStyle(canvas);
    const dark = document.documentElement.classList.contains("dark");
    const gridColor = dark ? "rgba(148,163,184,0.12)" : "rgba(100,116,139,0.12)";
    const axisColor = dark ? "rgba(226,232,240,0.6)" : "rgba(30,41,59,0.6)";
    const textColor = styles.color || (dark ? "#cbd5e1" : "#475569");
    ctx.clearRect(0, 0, size.w, size.h);

    const [x0, y1] = toWorld(0, 0);
    const [x1, y0] = toWorld(size.w, size.h);
    const step = niceStep(x1 - x0, size.w);
    ctx.lineWidth = 1;
    ctx.font = "11px ui-sans-serif, system-ui";
    ctx.fillStyle = textColor;
    // grid
    ctx.strokeStyle = gridColor;
    ctx.beginPath();
    for (let x = Math.ceil(x0 / step) * step; x <= x1; x += step) {
      const [px] = toPx(x, 0);
      ctx.moveTo(px, 0);
      ctx.lineTo(px, size.h);
    }
    for (let y = Math.ceil(y0 / step) * step; y <= y1; y += step) {
      const [, py] = toPx(0, y);
      ctx.moveTo(0, py);
      ctx.lineTo(size.w, py);
    }
    ctx.stroke();
    // axes
    const [ox, oy] = toPx(0, 0);
    ctx.strokeStyle = axisColor;
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(0, oy);
    ctx.lineTo(size.w, oy);
    ctx.moveTo(ox, 0);
    ctx.lineTo(ox, size.h);
    ctx.stroke();
    // labels
    const ly = Math.min(Math.max(oy + 14, 14), size.h - 4);
    const lx = Math.min(Math.max(ox + 4, 4), size.w - 30);
    for (let x = Math.ceil(x0 / step) * step; x <= x1; x += step) {
      if (Math.abs(x) < step / 2) continue;
      const [px] = toPx(x, 0);
      ctx.fillText(fmtTick(x, step), px + 3, ly);
    }
    for (let y = Math.ceil(y0 / step) * step; y <= y1; y += step) {
      if (Math.abs(y) < step / 2) continue;
      const [, py] = toPx(0, y);
      ctx.fillText(fmtTick(y, step), lx, py - 3);
    }
    // curves
    fns.forEach((f, i) => {
      if (!f) return;
      ctx.strokeStyle = GRAPH_COLORS[i % GRAPH_COLORS.length];
      ctx.lineWidth = 2.25;
      ctx.beginPath();
      let pen = false;
      let prevPy = 0;
      for (let px = 0; px <= size.w; px += 1) {
        const [x] = toWorld(px, 0);
        const y = f(x);
        if (!Number.isFinite(y)) {
          pen = false;
          continue;
        }
        const [, py] = toPx(x, y);
        if (pen && Math.abs(py - prevPy) > size.h * 1.5) pen = false; // asymptote
        if (!pen) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
        pen = true;
        prevPy = py;
      }
      ctx.stroke();
    });
    // markers
    const dot = (p: GraphPoint, color: string, r = 4.5) => {
      const [px, py] = toPx(p.x, p.y);
      if (px < -10 || px > size.w + 10 || py < -10 || py > size.h + 10) return;
      ctx.fillStyle = color;
      ctx.strokeStyle = dark ? "#0f172a" : "#fff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (p.label) {
        ctx.fillStyle = textColor;
        ctx.fillText(p.label, px + 7, py - 7);
      }
    };
    markers.roots.forEach((p) => dot(p, "#64748b", 3.5));
    markers.intersections.forEach((p) => dot(p, "#f59e0b"));
    points.forEach((p) => dot(p, "#ef4444", 5));
  }, [fns, size, view, markers, points, toPx, toWorld]);

  const zoom = (factor: number, px = size.w / 2, py = size.h / 2) => {
    const [wx, wy] = toWorld(px, py);
    setView((v) => {
      const scale = Math.min(1e6, Math.max(1e-3, v.scale * factor));
      return { scale, cx: wx - (px - size.w / 2) / scale, cy: wy + (py - size.h / 2) / scale };
    });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      zoom(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - rect.left, e.clientY - rect.top);
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  });

  return (
    <div ref={wrapRef} className={cn("relative w-full select-none overflow-hidden rounded-xl border bg-card text-muted-foreground", className)}>
      <canvas
        ref={canvasRef}
        style={{ width: size.w, height: size.h, touchAction: "none" }}
        className="block cursor-grab active:cursor-grabbing"
        role="img"
        aria-label={`Graph of ${expressions.join(", ")}`}
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY, cx: view.cx, cy: view.cy };
        }}
        onPointerMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const px = e.clientX - rect.left;
          const py = e.clientY - rect.top;
          if (drag.current && !pinch.current) {
            const d = drag.current;
            setView((v) => ({ ...v, cx: d.cx - (e.clientX - d.x) / v.scale, cy: d.cy + (e.clientY - d.y) / v.scale }));
          }
          const [wx, wy] = toWorld(px, py);
          setHover({ x: wx, y: wy, px, py });
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerLeave={() => {
          drag.current = null;
          setHover(null);
        }}
        onTouchStart={(e) => {
          if (e.touches.length === 2) {
            const [a, b] = [e.touches[0], e.touches[1]];
            pinch.current = { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), scale: view.scale };
          }
        }}
        onTouchMove={(e) => {
          if (e.touches.length === 2 && pinch.current) {
            const [a, b] = [e.touches[0], e.touches[1]];
            const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
            const p = pinch.current;
            setView((v) => ({ ...v, scale: Math.min(1e6, Math.max(1e-3, p.scale * (d / p.d))) }));
          }
        }}
        onTouchEnd={() => (pinch.current = null)}
      />
      {hover && (
        <div className="pointer-events-none absolute left-2 top-2 rounded-md border bg-card/90 px-2 py-1 font-mono text-[11px] text-foreground shadow-sm">
          ({round(hover.x)}, {round(hover.y)})
        </div>
      )}
      <div className="absolute bottom-2 right-2 flex gap-1">
        {[
          { icon: ZoomIn, label: "Zoom in", on: () => zoom(1.4) },
          { icon: ZoomOut, label: "Zoom out", on: () => zoom(1 / 1.4) },
          { icon: Maximize2, label: "Reset view", on: () => setUserView(null) },
        ].map(({ icon: Icon, label, on }) => (
          <button key={label} type="button" onClick={on} aria-label={label} title={label} className="cursor-pointer rounded-md border bg-card/90 p-1.5 text-foreground shadow-sm hover:bg-muted">
            <Icon className="size-4" />
          </button>
        ))}
      </div>
    </div>
  );
}
