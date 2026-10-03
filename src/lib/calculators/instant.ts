/** Client-safe instant calculators (no server dependencies). */
import type { InstantResult } from "./types";

const gcd2 = (a: number, b: number): number => {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
};
const fmt = (x: number, d = 10) => {
  if (!Number.isFinite(x)) return "\\text{undefined}";
  const r = Number(x.toPrecision(d));
  return Math.abs(r) >= 1e15 || (Math.abs(r) < 1e-6 && r !== 0) ? r.toExponential(6) : String(r);
};
const frac = (n: number, d: number) => {
  if (d < 0) [n, d] = [-n, -d];
  const g = gcd2(n, d) || 1;
  n /= g;
  d /= g;
  return d === 1 ? String(n) : `${n < 0 ? "-" : ""}\\frac{${Math.abs(n)}}{${d}}`;
};
const num = (v: string | undefined, name: string) => {
  const x = Number(String(v ?? "").trim());
  if (v === undefined || String(v).trim() === "" || !Number.isFinite(x)) throw new Error(`Enter a valid number for ${name}.`);
  return x;
};
const pos = (v: string | undefined, name: string) => {
  const x = num(v, name);
  if (x <= 0) throw new Error(`${name} must be positive.`);
  return x;
};
const ints = (s: string | undefined) => {
  const arr = String(s ?? "")
    .split(/[\s,;]+/)
    .filter(Boolean)
    .map(Number);
  if (arr.length < 2 || arr.some((x) => !Number.isInteger(x) || x === 0)) throw new Error("Enter at least two non-zero whole numbers separated by commas.");
  if (arr.some((x) => Math.abs(x) > 1e12)) throw new Error("Numbers must be smaller than 10^12.");
  return arr.map(Math.abs);
};
function primeFactors(n: number): Map<number, number> {
  const m = new Map<number, number>();
  for (let p = 2; p * p <= n; p++) while (n % p === 0) { m.set(p, (m.get(p) ?? 0) + 1); n /= p; }
  if (n > 1) m.set(n, (m.get(n) ?? 0) + 1);
  return m;
}
const pfTex = (m: Map<number, number>) => [...m.entries()].map(([p, e]) => (e > 1 ? `${p}^{${e}}` : String(p))).join(" \\times ") || "1";

export const INSTANT: Record<string, (v: Record<string, string>) => InstantResult> = {
  percentage(v) {
    const mode = v.mode ?? "of";
    const a = num(v.a, "the first value");
    const b = num(v.b, "the second value");
    if (mode === "of") {
      const r = (a / 100) * b;
      return { results: [{ label: `${a}% of ${b}`, latex: fmt(r) }], steps: [{ title: "Convert the percent to a decimal", latex: `${a}\\% = ${fmt(a / 100)}` }, { title: "Multiply", latex: `${fmt(a / 100)} \\times ${b} = ${fmt(r)}` }] };
    }
    if (mode === "what") {
      if (b === 0) throw new Error("The whole cannot be zero.");
      const r = (a / b) * 100;
      return { results: [{ label: `${a} is what % of ${b}`, latex: `${fmt(r)}\\%` }], steps: [{ title: "Divide part by whole", latex: `\\frac{${a}}{${b}} = ${fmt(a / b)}` }, { title: "Multiply by 100", latex: `${fmt(a / b)} \\times 100 = ${fmt(r)}\\%` }] };
    }
    if (a === 0) throw new Error("The original value cannot be zero.");
    const r = ((b - a) / Math.abs(a)) * 100;
    return { results: [{ label: r >= 0 ? "Percent increase" : "Percent decrease", latex: `${fmt(Math.abs(r))}\\%` }], steps: [{ title: "Find the change", latex: `${b} - ${a} = ${fmt(b - a)}` }, { title: "Divide by the original and multiply by 100", latex: `\\frac{${fmt(b - a)}}{${Math.abs(a)}} \\times 100 = ${fmt(r)}\\%` }] };
  },
  gcf(v) {
    const xs = ints(v.numbers);
    const g = xs.reduce(gcd2);
    const steps = xs.map((x) => ({ title: `Prime factorization of ${x}`, latex: `${x} = ${pfTex(primeFactors(x))}` }));
    steps.push({ title: "Multiply the common prime factors (lowest powers)", latex: `\\gcd(${xs.join(", ")}) = ${g}` });
    if (xs.length === 2) {
      let [a, b] = xs;
      const eu: string[] = [];
      while (b) { eu.push(`${a} = ${Math.floor(a / b)} \\times ${b} + ${a % b}`); [a, b] = [b, a % b]; }
      steps.push({ title: "Check with the Euclidean algorithm", latex: eu.join(" \\\\ ") });
    }
    return { results: [{ label: "Greatest common factor", latex: String(g) }], steps };
  },
  lcm(v) {
    const xs = ints(v.numbers);
    const l = xs.reduce((a, b) => (a / gcd2(a, b)) * b);
    const all = new Map<number, number>();
    const steps = xs.map((x) => {
      const pf = primeFactors(x);
      pf.forEach((e, p) => all.set(p, Math.max(all.get(p) ?? 0, e)));
      return { title: `Prime factorization of ${x}`, latex: `${x} = ${pfTex(pf)}` };
    });
    steps.push({ title: "Take each prime with its highest power", latex: `\\operatorname{lcm} = ${pfTex(all)} = ${l}` });
    return { results: [{ label: "Least common multiple", latex: String(l) }], steps };
  },
  slope(v) {
    const [x1, y1, x2, y2] = [num(v.x1, "x₁"), num(v.y1, "y₁"), num(v.x2, "x₂"), num(v.y2, "y₂")];
    if (x1 === x2 && y1 === y2) throw new Error("The two points must be different.");
    const dx = x2 - x1, dy = y2 - y1;
    const d = Math.hypot(dx, dy);
    const results = [{ label: "Distance", latex: fmt(d) }, { label: "Midpoint", latex: `(${fmt((x1 + x2) / 2)}, ${fmt((y1 + y2) / 2)})` }];
    const steps: InstantResult["steps"] = [];
    if (dx === 0) {
      results.unshift({ label: "Slope", latex: "\\text{undefined (vertical line)}" }, { label: "Equation", latex: `x = ${x1}` });
      steps.push({ title: "Vertical line", text: "The x-coordinates are equal, so the run is 0 and the slope is undefined." });
    } else {
      const isInt = Number.isInteger(dy) && Number.isInteger(dx);
      const m = dy / dx;
      const b = y1 - m * x1;
      const mTex = isInt ? frac(dy, dx) : fmt(m);
      results.unshift({ label: "Slope (m)", latex: mTex }, { label: "Slope-intercept form", latex: `y = ${mTex === "1" ? "" : mTex === "-1" ? "-" : mTex}x ${b >= 0 ? "+" : "-"} ${fmt(Math.abs(b))}` }, { label: "Angle of inclination", latex: `${fmt((Math.atan(m) * 180) / Math.PI, 6)}^\\circ` });
      steps.push({ title: "Slope formula", latex: `m = \\frac{y_2 - y_1}{x_2 - x_1} = \\frac{${y2} - (${y1})}{${x2} - (${x1})} = \\frac{${fmt(dy)}}{${fmt(dx)}} = ${mTex}` });
      steps.push({ title: "Find the y-intercept", latex: `b = y_1 - m x_1 = ${y1} - (${fmt(m)})(${x1}) = ${fmt(b)}` });
    }
    steps.push({ title: "Distance formula", latex: `d = \\sqrt{(${fmt(dx)})^2 + (${fmt(dy)})^2} = ${fmt(d)}` });
    return { results, steps };
  },
  area(v) {
    const s = v.shape ?? "rectangle";
    const shapes: Record<string, () => InstantResult> = {
      rectangle: () => { const l = pos(v.a, "length"), w = pos(v.b, "width"); return { results: [{ label: "Area", latex: fmt(l * w) }, { label: "Perimeter", latex: fmt(2 * (l + w)) }], steps: [{ title: "A = l × w", latex: `A = ${l} \\times ${w} = ${fmt(l * w)}` }] }; },
      square: () => { const a = pos(v.a, "side"); return { results: [{ label: "Area", latex: fmt(a * a) }, { label: "Perimeter", latex: fmt(4 * a) }], steps: [{ title: "A = s²", latex: `A = ${a}^2 = ${fmt(a * a)}` }] }; },
      circle: () => { const r = pos(v.a, "radius"); return { results: [{ label: "Area", latex: `${fmt(r * r)}\\pi \\approx ${fmt(Math.PI * r * r)}` }, { label: "Circumference", latex: `${fmt(2 * r)}\\pi \\approx ${fmt(2 * Math.PI * r)}` }], steps: [{ title: "A = πr²", latex: `A = \\pi (${r})^2 = ${fmt(r * r)}\\pi` }] }; },
      triangle: () => { const b = pos(v.a, "base"), h = pos(v.b, "height"); return { results: [{ label: "Area", latex: fmt(0.5 * b * h) }], steps: [{ title: "A = ½bh", latex: `A = \\frac{1}{2}(${b})(${h}) = ${fmt(0.5 * b * h)}` }] }; },
      trapezoid: () => { const a = pos(v.a, "base 1"), b = pos(v.b, "base 2"), h = pos(v.c, "height"); return { results: [{ label: "Area", latex: fmt(0.5 * (a + b) * h) }], steps: [{ title: "A = ½(a + b)h", latex: `A = \\frac{1}{2}(${a} + ${b})(${h}) = ${fmt(0.5 * (a + b) * h)}` }] }; },
      parallelogram: () => { const b = pos(v.a, "base"), h = pos(v.b, "height"); return { results: [{ label: "Area", latex: fmt(b * h) }], steps: [{ title: "A = bh", latex: `A = ${b} \\times ${h} = ${fmt(b * h)}` }] }; },
      ellipse: () => { const a = pos(v.a, "semi-major axis"), b = pos(v.b, "semi-minor axis"); return { results: [{ label: "Area", latex: `${fmt(a * b)}\\pi \\approx ${fmt(Math.PI * a * b)}` }], steps: [{ title: "A = πab", latex: `A = \\pi(${a})(${b}) = ${fmt(a * b)}\\pi` }] }; },
    };
    if (!shapes[s]) throw new Error("Choose a shape.");
    return shapes[s]();
  },
  volume(v) {
    const s = v.shape ?? "cube";
    const P = Math.PI;
    const shapes: Record<string, () => InstantResult> = {
      cube: () => { const a = pos(v.a, "side"); return { results: [{ label: "Volume", latex: fmt(a ** 3) }, { label: "Surface area", latex: fmt(6 * a * a) }], steps: [{ title: "V = s³", latex: `V = ${a}^3 = ${fmt(a ** 3)}` }] }; },
      box: () => { const l = pos(v.a, "length"), w = pos(v.b, "width"), h = pos(v.c, "height"); return { results: [{ label: "Volume", latex: fmt(l * w * h) }, { label: "Surface area", latex: fmt(2 * (l * w + l * h + w * h)) }], steps: [{ title: "V = lwh", latex: `V = ${l} \\times ${w} \\times ${h} = ${fmt(l * w * h)}` }] }; },
      sphere: () => { const r = pos(v.a, "radius"); return { results: [{ label: "Volume", latex: `\\frac{${fmt(4 * r ** 3)}}{3}\\pi \\approx ${fmt((4 / 3) * P * r ** 3)}` }, { label: "Surface area", latex: `${fmt(4 * r * r)}\\pi \\approx ${fmt(4 * P * r * r)}` }], steps: [{ title: "V = (4/3)πr³", latex: `V = \\frac{4}{3}\\pi(${r})^3 \\approx ${fmt((4 / 3) * P * r ** 3)}` }] }; },
      cylinder: () => { const r = pos(v.a, "radius"), h = pos(v.b, "height"); return { results: [{ label: "Volume", latex: `${fmt(r * r * h)}\\pi \\approx ${fmt(P * r * r * h)}` }, { label: "Surface area", latex: fmt(2 * P * r * (r + h)) }], steps: [{ title: "V = πr²h", latex: `V = \\pi(${r})^2(${h}) = ${fmt(r * r * h)}\\pi` }] }; },
      cone: () => { const r = pos(v.a, "radius"), h = pos(v.b, "height"); const l = Math.hypot(r, h); return { results: [{ label: "Volume", latex: fmt((P * r * r * h) / 3) }, { label: "Slant height", latex: fmt(l) }, { label: "Surface area", latex: fmt(P * r * (r + l)) }], steps: [{ title: "V = (1/3)πr²h", latex: `V = \\frac{1}{3}\\pi(${r})^2(${h}) \\approx ${fmt((P * r * r * h) / 3)}` }] }; },
      pyramid: () => { const b = pos(v.a, "base area"), h = pos(v.b, "height"); return { results: [{ label: "Volume", latex: fmt((b * h) / 3) }], steps: [{ title: "V = (1/3)Bh", latex: `V = \\frac{1}{3}(${b})(${h}) = ${fmt((b * h) / 3)}` }] }; },
    };
    if (!shapes[s]) throw new Error("Choose a solid.");
    return shapes[s]();
  },
  triangle(v) {
    const mode = v.mode ?? "sss";
    const deg = (r: number) => (r * 180) / Math.PI;
    const rad = (d: number) => (d * Math.PI) / 180;
    let a: number, b: number, c: number, A: number, B: number, C: number;
    const steps: InstantResult["steps"] = [];
    if (mode === "sss") {
      [a, b, c] = [pos(v.a, "side a"), pos(v.b, "side b"), pos(v.c, "side c")];
      if (a + b <= c || a + c <= b || b + c <= a) throw new Error("These sides violate the triangle inequality.");
      A = deg(Math.acos((b * b + c * c - a * a) / (2 * b * c)));
      B = deg(Math.acos((a * a + c * c - b * b) / (2 * a * c)));
      C = 180 - A - B;
      steps.push({ title: "Law of cosines for angle A", latex: `\\cos A = \\frac{b^2 + c^2 - a^2}{2bc} \\Rightarrow A = ${fmt(A, 6)}^\\circ` });
    } else if (mode === "sas") {
      [b, c] = [pos(v.b, "side b"), pos(v.c, "side c")];
      A = num(v.angle, "angle A");
      if (A <= 0 || A >= 180) throw new Error("The angle must be between 0° and 180°.");
      a = Math.sqrt(b * b + c * c - 2 * b * c * Math.cos(rad(A)));
      B = deg(Math.acos((a * a + c * c - b * b) / (2 * a * c)));
      C = 180 - A - B;
      steps.push({ title: "Law of cosines for side a", latex: `a^2 = b^2 + c^2 - 2bc\\cos A \\Rightarrow a = ${fmt(a, 8)}` });
    } else {
      A = num(v.angle, "angle A");
      B = num(v.angle2, "angle B");
      c = pos(v.c, "side c");
      if (A <= 0 || B <= 0 || A + B >= 180) throw new Error("Angles must be positive and sum to less than 180°.");
      C = 180 - A - B;
      a = (c * Math.sin(rad(A))) / Math.sin(rad(C));
      b = (c * Math.sin(rad(B))) / Math.sin(rad(C));
      steps.push({ title: "Angle sum", latex: `C = 180^\\circ - ${A}^\\circ - ${B}^\\circ = ${fmt(C, 6)}^\\circ` });
      steps.push({ title: "Law of sines", latex: `\\frac{a}{\\sin A} = \\frac{c}{\\sin C} \\Rightarrow a = ${fmt(a, 8)},\; b = ${fmt(b, 8)}` });
    }
    const s = (a + b + c) / 2;
    const area = Math.sqrt(Math.max(0, s * (s - a) * (s - b) * (s - c)));
    steps.push({ title: "Area by Heron's formula", latex: `s = ${fmt(s, 8)},\; A = \\sqrt{s(s-a)(s-b)(s-c)} = ${fmt(area, 8)}` });
    const type = [a, b, c].every((x) => Math.abs(x - a) < 1e-9) ? "Equilateral" : Math.abs(a - b) < 1e-9 || Math.abs(b - c) < 1e-9 || Math.abs(a - c) < 1e-9 ? "Isosceles" : "Scalene";
    const angleType = [A, B, C].some((x) => Math.abs(x - 90) < 1e-7) ? "right" : [A, B, C].some((x) => x > 90) ? "obtuse" : "acute";
    return {
      results: [
        { label: "Sides", latex: `a = ${fmt(a, 8)},\; b = ${fmt(b, 8)},\; c = ${fmt(c, 8)}` },
        { label: "Angles", latex: `A = ${fmt(A, 6)}^\\circ,\; B = ${fmt(B, 6)}^\\circ,\; C = ${fmt(C, 6)}^\\circ` },
        { label: "Area", latex: fmt(area, 8) },
        { label: "Perimeter", latex: fmt(a + b + c, 8) },
        { label: "Type", latex: `\\text{${type}, ${angleType}}` },
      ],
      steps,
    };
  },
  probability(v) {
    const pa = num(v.pa, "P(A)"), pb = num(v.pb, "P(B)");
    if (pa < 0 || pa > 1 || pb < 0 || pb > 1) throw new Error("Probabilities must be between 0 and 1.");
    const both = pa * pb;
    return {
      results: [
        { label: "P(A and B)", latex: fmt(both) },
        { label: "P(A or B)", latex: fmt(pa + pb - both) },
        { label: "P(not A)", latex: fmt(1 - pa) },
        { label: "P(not B)", latex: fmt(1 - pb) },
        { label: "P(exactly one)", latex: fmt(pa + pb - 2 * both) },
        { label: "P(neither)", latex: fmt((1 - pa) * (1 - pb)) },
      ],
      steps: [
        { title: "Independent events: multiply", latex: `P(A \\cap B) = P(A)P(B) = ${pa} \\times ${pb} = ${fmt(both)}` },
        { title: "Addition rule", latex: `P(A \\cup B) = P(A) + P(B) - P(A \\cap B) = ${fmt(pa + pb - both)}` },
        { title: "Complement rule", latex: `P(A') = 1 - P(A) = ${fmt(1 - pa)}` },
      ],
    };
  },
  exponent(v) {
    const b = num(v.base, "the base"), e = num(v.exp, "the exponent");
    const r = Math.pow(b, e);
    if (!Number.isFinite(r)) throw new Error("The result is undefined or too large.");
    const steps: InstantResult["steps"] = [{ title: "Definition", latex: Number.isInteger(e) && e > 0 && e <= 10 ? `${b}^{${e}} = ${Array(e).fill(`(${b})`).join(" \\cdot ")}` : `${b}^{${e}}` }];
    if (e < 0) steps.push({ title: "Negative exponent", latex: `${b}^{${e}} = \\frac{1}{${b}^{${-e}}}` });
    if (!Number.isInteger(e)) steps.push({ title: "Fractional exponent", latex: `a^{m/n} = \\sqrt[n]{a^m}` });
    return { results: [{ label: `${b}^${e}`, latex: fmt(r, 12) }], steps };
  },
};
