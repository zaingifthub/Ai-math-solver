/** Number formatting helpers: exact fractions, surds and readable decimals. */

export function gcd(a: number, b: number): number {
  a = Math.abs(Math.round(a));
  b = Math.abs(Math.round(b));
  while (b) [a, b] = [b, a % b];
  return a;
}

export function lcm(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return Math.abs(Math.round(a) * Math.round(b)) / gcd(a, b);
}

export function isInt(x: number, tol = 1e-9): boolean {
  return Number.isFinite(x) && Math.abs(x - Math.round(x)) < tol * Math.max(1, Math.abs(x));
}

/** Best rational approximation via continued fractions. Returns null if no small-denominator match. */
export function toFraction(x: number, maxDen = 10000, tol = 1e-9): [number, number] | null {
  if (!Number.isFinite(x)) return null;
  if (isInt(x)) return [Math.round(x), 1];
  const sign = x < 0 ? -1 : 1;
  let v = Math.abs(x);
  let [h0, h1, k0, k1] = [0, 1, 1, 0];
  for (let i = 0; i < 40; i++) {
    const a = Math.floor(v);
    [h0, h1] = [h1, a * h1 + h0];
    [k0, k1] = [k1, a * k1 + k0];
    if (k1 > maxDen) return null;
    if (Math.abs(h1 / k1 - Math.abs(x)) < tol * Math.max(1, Math.abs(x))) return [sign * h1, k1];
    const frac = v - a;
    if (frac < 1e-15) break;
    v = 1 / frac;
  }
  return null;
}

export function roundSig(x: number, sig = 6): string {
  if (!Number.isFinite(x)) return x > 0 ? "∞" : x < 0 ? "-∞" : "undefined";
  if (x === 0) return "0";
  if (isInt(x, 1e-12) && Math.abs(x) < 1e15) return String(Math.round(x));
  const s = Number(x.toPrecision(sig));
  if (Math.abs(s) >= 1e-4 && Math.abs(s) < 1e15) return String(s);
  return s.toExponential(sig - 1);
}

export function fracTex(n: number, d: number): string {
  if (d < 0) [n, d] = [-n, -d];
  const g = gcd(n, d) || 1;
  n /= g;
  d /= g;
  if (d === 1) return String(n);
  return `${n < 0 ? "-" : ""}\\frac{${Math.abs(n)}}{${d}}`;
}

export function fracText(n: number, d: number): string {
  if (d < 0) [n, d] = [-n, -d];
  const g = gcd(n, d) || 1;
  n /= g;
  d /= g;
  return d === 1 ? String(n) : `${n}/${d}`;
}

/** Format a real number exactly when rational, otherwise as a rounded decimal. */
export function numTex(x: number): string {
  if (!Number.isFinite(x)) return x > 0 ? "\\infty" : x < 0 ? "-\\infty" : "\\text{undefined}";
  const f = toFraction(x, 1000);
  if (f) return fracTex(f[0], f[1]);
  const known = recognizeConstant(x);
  if (known) return known.tex;
  return roundSig(x);
}

export function numText(x: number): string {
  if (!Number.isFinite(x)) return roundSig(x);
  const f = toFraction(x, 1000);
  if (f) return fracText(f[0], f[1]);
  const known = recognizeConstant(x);
  if (known) return known.text;
  return roundSig(x);
}

/** Recognize simple multiples of π, √n and e for nicer display. */
export function recognizeConstant(x: number): { tex: string; text: string } | null {
  if (!Number.isFinite(x) || x === 0) return null;
  const pf = toFraction(x / Math.PI, 24, 1e-10);
  if (pf && pf[0] !== 0) {
    const [n, d] = pf;
    const coef = n === 1 ? "" : n === -1 ? "-" : String(n);
    return {
      tex: d === 1 ? `${coef}\\pi` : `${n < 0 ? "-" : ""}\\frac{${Math.abs(n) === 1 ? "" : Math.abs(n)}\\pi}{${d}}`,
      text: d === 1 ? `${coef}π` : `${n === 1 ? "" : n === -1 ? "-" : n}π/${d}`,
    };
  }
  const ef = toFraction(x / Math.E, 12, 1e-10);
  if (ef && ef[0] !== 0) {
    const [n, d] = ef;
    const c = Math.abs(n) === 1 ? "" : String(Math.abs(n));
    const sg = n < 0 ? "-" : "";
    return d === 1 ? { tex: `${sg}${c}e`, text: `${sg}${c}e` } : { tex: `${sg}\\frac{${c}e}{${d}}`, text: `${sg}${c}e/${d}` };
  }
  for (const r of [2, 3, 5, 6, 7, 10]) {
    const sf = toFraction(x / Math.sqrt(r), 12, 1e-10);
    if (sf && sf[0] !== 0) {
      const [n, d] = sf;
      const coef = Math.abs(n) === 1 ? "" : String(Math.abs(n));
      const sign = n < 0 ? "-" : "";
      return d === 1
        ? { tex: `${sign}${coef}\\sqrt{${r}}`, text: `${sign}${coef}√${r}` }
        : { tex: `${sign}\\frac{${coef}\\sqrt{${r}}}{${d}}`, text: `${sign}${coef}√${r}/${d}` };
    }
  }
  return null;
}

/** Simplify √n for a non-negative integer n → [k, m] with √n = k√m. */
export function simplifySqrt(n: number): [number, number] {
  let k = 1;
  let m = Math.round(n);
  for (let f = 2; f * f <= m; f++) {
    while (m % (f * f) === 0) {
      k *= f;
      m /= f * f;
    }
  }
  return [k, m];
}

/** LaTeX of a polynomial from coefficients (highest degree first). */
export function polyTex(coeffs: number[], v = "x"): string {
  const deg = coeffs.length - 1;
  const parts: string[] = [];
  coeffs.forEach((c, i) => {
    const p = deg - i;
    if (Math.abs(c) < 1e-12) return;
    const abs = Math.abs(c);
    const cTex = numTex(abs);
    const coefStr = p === 0 ? cTex : abs === 1 ? "" : cTex;
    const varStr = p === 0 ? "" : p === 1 ? v : `${v}^{${p}}`;
    const sign = c < 0 ? "-" : "+";
    parts.push(`${parts.length === 0 ? (sign === "-" ? "-" : "") : ` ${sign} `}${coefStr}${varStr}`);
  });
  return parts.length ? parts.join("") : "0";
}

export function polyStr(coeffs: number[], v = "x"): string {
  const deg = coeffs.length - 1;
  const parts: string[] = [];
  coeffs.forEach((c, i) => {
    const p = deg - i;
    if (Math.abs(c) < 1e-12) return;
    const abs = Math.abs(c);
    const cs = numText(abs);
    const coefStr = p === 0 ? cs : abs === 1 ? "" : `${cs}*`;
    const varStr = p === 0 ? "" : p === 1 ? v : `${v}^${p}`;
    const sign = c < 0 ? "-" : "+";
    parts.push(`${parts.length === 0 ? (sign === "-" ? "-" : "") : ` ${sign} `}${coefStr.includes("/") && p > 0 ? `(${cs})*` : coefStr}${varStr}`);
  });
  return parts.length ? parts.join("") : "0";
}
