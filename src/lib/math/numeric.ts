/** Numerical utilities used for solving fallbacks and for independent verification. */

export type Fn = (x: number) => number;

export function close(a: number, b: number, tol = 1e-7): boolean {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return a === b;
  return Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
}

/** Brent-style bisection refinement on a bracket with sign change. */
export function bisect(f: Fn, a: number, b: number, iters = 100): number {
  let fa = f(a);
  for (let i = 0; i < iters; i++) {
    const m = (a + b) / 2;
    const fm = f(m);
    if (fm === 0 || (b - a) / 2 < 1e-14) return m;
    if (Math.sign(fm) === Math.sign(fa)) {
      a = m;
      fa = fm;
    } else b = m;
  }
  return (a + b) / 2;
}

/** Newton refinement with numerical derivative; returns null if it diverges. */
export function newton(f: Fn, x0: number, iters = 50): number | null {
  let x = x0;
  for (let i = 0; i < iters; i++) {
    const fx = f(x);
    if (!Number.isFinite(fx)) return null;
    if (Math.abs(fx) < 1e-14) return x;
    const h = 1e-7 * Math.max(1, Math.abs(x));
    const d = (f(x + h) - f(x - h)) / (2 * h);
    if (!Number.isFinite(d) || d === 0) return null;
    const nx = x - fx / d;
    if (Math.abs(nx - x) < 1e-13 * Math.max(1, Math.abs(x))) return nx;
    x = nx;
  }
  return Math.abs(f(x)) < 1e-8 ? x : null;
}

/** Clean up floating noise: snap to integers/simple fractions when extremely close. */
export function snap(x: number): number {
  const r = Math.round(x);
  if (Math.abs(x - r) < 1e-9) return r;
  for (const d of [2, 3, 4, 5, 6, 8, 10, 12]) {
    const n = Math.round(x * d);
    if (Math.abs(x - n / d) < 1e-10) return n / d;
  }
  return x;
}

/**
 * Find real roots of f on [a, b] by dense sampling + sign-change bracketing + refinement.
 * Also catches tangent roots (local minima of |f| near zero).
 */
export function findRealRoots(f: Fn, a = -100, b = 100, samples = 20000): number[] {
  const roots: number[] = [];
  const step = (b - a) / samples;
  let px = a;
  let pf = f(a);
  const pushRoot = (r: number) => {
    if (!Number.isFinite(r)) return;
    const fr = f(r);
    if (!Number.isFinite(fr) || Math.abs(fr) > 1e-6 * Math.max(1, Math.abs(r))) return;
    if (!roots.some((x) => Math.abs(x - r) < 1e-7 * Math.max(1, Math.abs(r)))) roots.push(snap(r));
  };
  if (pf === 0) pushRoot(a);
  let ppf = NaN;
  for (let i = 1; i <= samples; i++) {
    const x = a + i * step;
    const fx = f(x);
    if (Number.isFinite(fx) && Number.isFinite(pf)) {
      if (fx === 0) pushRoot(x);
      else if (Math.sign(fx) !== Math.sign(pf)) {
        const r = bisect(f, px, x);
        // Reject sign changes caused by poles (|f| blows up near r)
        if (Math.abs(f(r)) < 1e-6 * Math.max(1, Math.abs(r))) pushRoot(r);
      } else if (Number.isFinite(ppf) && Math.abs(pf) < Math.abs(fx) && Math.abs(pf) < Math.abs(ppf) && Math.abs(pf) < 1e-3) {
        const r = newton(f, px);
        if (r !== null) pushRoot(r);
      }
    }
    ppf = pf;
    px = x;
    pf = fx;
  }
  return roots.sort((x, y) => x - y);
}

/** Adaptive Simpson integration. */
export function integrate(f: Fn, a: number, b: number, eps = 1e-10, maxDepth = 50): number {
  const simpson = (l: number, r: number, fl: number, fm: number, fr: number) => ((r - l) / 6) * (fl + 4 * fm + fr);
  const rec = (l: number, r: number, fl: number, fm: number, fr: number, whole: number, e: number, depth: number): number => {
    const m = (l + r) / 2;
    const lm = (l + m) / 2;
    const rm = (m + r) / 2;
    const flm = f(lm);
    const frm = f(rm);
    const left = simpson(l, m, fl, flm, fm);
    const right = simpson(m, r, fm, frm, fr);
    if (depth <= 0 || Math.abs(left + right - whole) <= 15 * e) return left + right + (left + right - whole) / 15;
    return rec(l, m, fl, flm, fm, left, e / 2, depth - 1) + rec(m, r, fm, frm, fr, right, e / 2, depth - 1);
  };
  if (a === b) return 0;
  // Nudge endpoints slightly to avoid evaluating removable singularities exactly at the bounds.
  const fa = Number.isFinite(f(a)) ? f(a) : f(a + 1e-12 * Math.max(1, Math.abs(a)));
  const fb = Number.isFinite(f(b)) ? f(b) : f(b - 1e-12 * Math.max(1, Math.abs(b)));
  const fm = f((a + b) / 2);
  return rec(a, b, fa, fm, fb, simpson(a, b, fa, fm, fb), eps, maxDepth);
}

/** Integral over possibly infinite bounds using the substitution x = t/(1-t²). */
export function integrateImproper(f: Fn, a: number, b: number): number {
  if (Number.isFinite(a) && Number.isFinite(b)) return integrate(f, a, b);
  const g = (t: number) => {
    const x = t / (1 - t * t);
    const dx = (1 + t * t) / (1 - t * t) ** 2;
    return f(x) * dx;
  };
  const toT = (x: number) => (x === Infinity ? 1 - 1e-9 : x === -Infinity ? -1 + 1e-9 : (Math.sqrt(1 + 4 * x * x) - 1) / (2 * x || 1) || 0);
  return integrate(g, toT(a), toT(b), 1e-9);
}

/** Central-difference derivative. */
export function numDerivative(f: Fn, x: number): number {
  const h = 1e-5 * Math.max(1, Math.abs(x));
  return (f(x - 2 * h) - 8 * f(x - h) + 8 * f(x + h) - f(x + 2 * h)) / (12 * h);
}

/** Deterministic sample points spread across a range (avoids integers which often hit singularities). */
export function samplePoints(n = 7, lo = -3, hi = 3): number[] {
  const pts: number[] = [];
  for (let i = 0; i < n; i++) pts.push(lo + ((hi - lo) * (i + 0.37)) / n + 0.0123 * i);
  return pts;
}

/** Numerically approximate lim_{x→a} f(x) from one side. */
export function oneSidedLimit(f: Fn, a: number, side: 1 | -1): number {
  if (!Number.isFinite(a)) {
    const xs = [1e3, 1e4, 1e5, 1e6].map((x) => x * Math.sign(a));
    const vals = xs.map(f);
    const last = vals[vals.length - 1];
    if (Math.abs(last) > 1e8) return Math.sign(last) * Infinity;
    return Math.abs(vals[2] - last) < 1e-3 * Math.max(1, Math.abs(last)) ? last : NaN;
  }
  const hs = [1e-3, 1e-4, 1e-5, 1e-6, 1e-7];
  const vals = hs.map((h) => f(a + side * h * Math.max(1, Math.abs(a))));
  const last = vals[vals.length - 1];
  if (vals.every(Number.isFinite) && Math.abs(last) > 1e6 && Math.abs(vals[4]) > Math.abs(vals[2])) return Math.sign(last) * Infinity;
  if (!Number.isFinite(last)) return NaN;
  const spread = Math.abs(vals[3] - last);
  return spread < 1e-3 * Math.max(1, Math.abs(last)) ? last : NaN;
}

/** Durand–Kerner: all complex roots of a polynomial (coefficients highest degree first). */
export function polyRoots(coeffs: number[]): { re: number; im: number }[] {
  const lead = coeffs[0];
  const c = coeffs.map((x) => x / lead);
  const n = c.length - 1;
  if (n < 1) return [];
  type C = { re: number; im: number };
  const mul = (a: C, b: C): C => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
  const sub = (a: C, b: C): C => ({ re: a.re - b.re, im: a.im - b.im });
  const div = (a: C, b: C): C => {
    const d = b.re * b.re + b.im * b.im;
    return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d };
  };
  const evalP = (z: C): C => c.reduce<C>((acc, k) => ({ re: mul(acc, z).re + k, im: mul(acc, z).im }), { re: 0, im: 0 });
  let roots: C[] = Array.from({ length: n }, (_, k) => {
    const r = 1 + Math.max(...c.slice(1).map(Math.abs));
    const ang = (2 * Math.PI * k) / n + 0.4;
    return { re: r * 0.9 * Math.cos(ang), im: r * 0.9 * Math.sin(ang) };
  });
  for (let it = 0; it < 2000; it++) {
    let delta = 0;
    roots = roots.map((z, i) => {
      let den: C = { re: 1, im: 0 };
      roots.forEach((w, j) => {
        if (i !== j) den = mul(den, sub(z, w));
      });
      const nz = sub(z, div(evalP(z), den));
      delta = Math.max(delta, Math.hypot(nz.re - z.re, nz.im - z.im));
      return nz;
    });
    if (delta < 1e-15) break;
  }
  return roots.map((z) => ({ re: snap(z.re), im: Math.abs(z.im) < 1e-9 ? 0 : z.im }));
}
