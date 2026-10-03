import { numTex, numText, polyTex, roundSig, simplifySqrt, gcd, fracTex, fracText, toFraction } from "../format";
import { polyRoots } from "../numeric";
import { evalPoly, rationalRootCandidates, syntheticDivide, toIntegerCoeffs } from "../poly";
import type { Formula, Step } from "../types";

export interface Root {
  tex: string;
  text: string;
  value: number;
  im?: number;
  exact: boolean;
  multiplicity?: number;
}

export function realRoot(value: number): Root {
  return { tex: numTex(value), text: numText(value), value, exact: !!toFraction(value, 1000) };
}

/** Exact roots of ax²+bx+c with full step-by-step quadratic formula work. */
export function quadraticRoots(a: number, b: number, c: number, v = "x"): { roots: Root[]; steps: Step[]; formulas: Formula[]; discriminant: number } {
  const steps: Step[] = [];
  const formulas: Formula[] = [
    { name: "Quadratic formula", latex: `${v} = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}` },
    { name: "Discriminant", latex: "\\Delta = b^2 - 4ac" },
  ];
  steps.push({
    title: "Identify the coefficients",
    latex: `a = ${numTex(a)},\\quad b = ${numTex(b)},\\quad c = ${numTex(c)}`,
    text: `Compare with the standard form $a${v}^2 + b${v} + c = 0$.`,
  });
  const D = b * b - 4 * a * c;
  steps.push({
    title: "Compute the discriminant",
    latex: `\\Delta = (${numTex(b)})^2 - 4(${numTex(a)})(${numTex(c)}) = ${numTex(D)}`,
    text:
      Math.abs(D) < 1e-12
        ? "Since $\\Delta = 0$, there is exactly one repeated real root."
        : D > 0
          ? "Since $\\Delta > 0$, there are two distinct real roots."
          : "Since $\\Delta < 0$, there are no real roots — the roots are complex conjugates.",
  });
  steps.push({
    title: "Apply the quadratic formula",
    latex: `${v} = \\frac{-(${numTex(b)}) \\pm \\sqrt{${numTex(D)}}}{2(${numTex(a)})}`,
  });

  const ints = toIntegerCoeffs([a, b, c]);
  const roots: Root[] = [];
  if (ints) {
    // Exact arithmetic on scaled integer coefficients (same roots)
    const [A, B, C] = ints;
    const Di = B * B - 4 * A * C;
    const den = 2 * A;
    if (Di === 0) {
      const r = -B / den;
      roots.push({ ...realRoot(r), multiplicity: 2 });
    } else if (Di > 0) {
      const s = Math.sqrt(Di);
      if (Number.isInteger(s)) {
        roots.push(realRoot((-B + s) / den), realRoot((-B - s) / den));
      } else {
        const [k, m] = simplifySqrt(Di);
        const g = gcd(gcd(Math.abs(B), k), Math.abs(den)) || 1;
        let [bb, kk, dd] = [-B / g, k / g, den / g];
        if (dd < 0) [bb, kk, dd] = [-bb, kk, -dd];
        const rad = `${kk === 1 ? "" : kk}\\sqrt{${m}}`;
        const radT = `${kk === 1 ? "" : kk}√${m}`;
        for (const sign of [1, -1]) {
          const value = (bb + sign * kk * Math.sqrt(m)) / dd;
          const numer = bb === 0 ? `${sign < 0 ? "-" : ""}${rad}` : `${bb} ${sign > 0 ? "+" : "-"} ${rad}`;
          const numerT = bb === 0 ? `${sign < 0 ? "-" : ""}${radT}` : `${bb} ${sign > 0 ? "+" : "-"} ${radT}`;
          roots.push({
            tex: dd === 1 ? numer : `\\frac{${numer}}{${dd}}`,
            text: dd === 1 ? numerT : `(${numerT})/${dd}`,
            value,
            exact: true,
          });
        }
      }
      if (!Number.isInteger(Math.sqrt(Di))) {
        const [k, m] = simplifySqrt(Di);
        if (k > 1) steps.push({ title: "Simplify the square root", latex: `\\sqrt{${Di}} = \\sqrt{${k * k} \\cdot ${m}} = ${k}\\sqrt{${m}}` });
      }
    } else {
      const [k, m] = simplifySqrt(-Di);
      const re = -B / den;
      const imCoef = k / den;
      const imAbs = Math.abs(imCoef);
      const reTex = Math.abs(re) < 1e-15 ? "" : fracTex(-B, den);
      const imTex = m === 1 ? (Math.abs(imAbs - 1) < 1e-12 ? "i" : `${fracTex(Math.abs(k), Math.abs(den))}i`) : `${fracTex(Math.abs(k), Math.abs(den)) === "1" ? "" : fracTex(Math.abs(k), Math.abs(den))}\\sqrt{${m}}\\,i`;
      const imText = m === 1 ? `${fracText(Math.abs(k), Math.abs(den)) === "1" ? "" : fracText(Math.abs(k), Math.abs(den))}i` : `${fracText(Math.abs(k), Math.abs(den))}√${m}i`;
      for (const sign of [1, -1]) {
        roots.push({
          tex: `${reTex}${reTex ? (sign > 0 ? " + " : " - ") : sign > 0 ? "" : "-"}${imTex}`,
          text: `${Math.abs(re) < 1e-15 ? "" : fracText(-B, den)}${Math.abs(re) < 1e-15 ? (sign > 0 ? "" : "-") : sign > 0 ? " + " : " - "}${imText}`,
          value: re,
          im: sign * imAbs * Math.sqrt(m),
          exact: true,
        });
      }
    }
  } else {
    if (D >= 0) {
      const s = Math.sqrt(D);
      const r1 = (-b + s) / (2 * a);
      const r2 = (-b - s) / (2 * a);
      roots.push(realRoot(r1));
      if (Math.abs(D) > 1e-12) roots.push(realRoot(r2));
      else roots[0].multiplicity = 2;
    } else {
      const re = -b / (2 * a);
      const im = Math.sqrt(-D) / (2 * Math.abs(a));
      for (const sign of [1, -1])
        roots.push({ tex: `${roundSig(re)} ${sign > 0 ? "+" : "-"} ${roundSig(im)}i`, text: `${roundSig(re)} ${sign > 0 ? "+" : "-"} ${roundSig(im)}i`, value: re, im: sign * im, exact: false });
    }
  }
  steps.push({
    title: roots.length === 1 ? "Write the repeated root" : "Write the solutions",
    latex: roots.map((r, i) => `${v}${roots.length > 1 ? `_{${i + 1}}` : ""} = ${r.tex}`).join(",\\quad "),
  });
  return { roots, steps, formulas, discriminant: D };
}

/** Factoring method for a quadratic with rational roots (used as alternative method). */
export function quadraticFactoringSteps(a: number, b: number, c: number, v = "x"): Step[] | null {
  const ints = toIntegerCoeffs([a, b, c]);
  if (!ints) return null;
  const [A, B, C] = ints;
  const D = B * B - 4 * A * C;
  if (D < 0 || !Number.isInteger(Math.sqrt(D))) return null;
  const s = Math.sqrt(D);
  const r1 = (-B + s) / (2 * A);
  const r2 = (-B - s) / (2 * A);
  const factor = (r: number) => {
    const f = toFraction(r, 1000)!;
    const [p, q] = f;
    if (q === 1) return p === 0 ? v : `(${v} ${p > 0 ? "-" : "+"} ${Math.abs(p)})`;
    return `(${q}${v} ${p > 0 ? "-" : "+"} ${Math.abs(p)})`;
  };
  const steps: Step[] = [];
  if (A !== 1) steps.push({ title: "Use the ac-method", text: `Find two numbers that multiply to $ac = ${A * C}$ and add to $b = ${B}$.` });
  else steps.push({ title: "Find two numbers", text: `Find two numbers that multiply to $${C}$ and add to $${B}$: they are $${numTex(-r1)}$ and $${numTex(-r2)}$.` });
  const f1 = toFraction(r1, 1000)!;
  const f2 = toFraction(r2, 1000)!;
  const lead = A / (f1[1] * f2[1]);
  steps.push({ title: "Factor", latex: `${lead !== 1 ? numTex(lead) : ""}${factor(r1)}${r1 === r2 ? "^2" : factor(r2)} = 0` });
  steps.push({ title: "Zero product property", text: "Set each factor equal to zero.", latex: r1 === r2 ? `${v} = ${numTex(r1)}` : `${v} = ${numTex(r1)} \\quad\\text{or}\\quad ${v} = ${numTex(r2)}` });
  return steps;
}

/** Completing-the-square method (alternative method). */
export function completingSquareSteps(a: number, b: number, c: number, v = "x"): Step[] {
  const h = b / (2 * a);
  const k = h * h - c / a;
  return [
    { title: "Divide by a", latex: `${v}^2 ${b / a >= 0 ? "+" : "-"} ${numTex(Math.abs(b / a))}${v} = ${numTex(-c / a)}` },
    { title: "Add (b/2a)² to both sides", latex: `${v}^2 ${b / a >= 0 ? "+" : "-"} ${numTex(Math.abs(b / a))}${v} + ${numTex(h * h)} = ${numTex(-c / a)} + ${numTex(h * h)}` },
    { title: "Write as a perfect square", latex: `\\left(${v} ${h >= 0 ? "+" : "-"} ${numTex(Math.abs(h))}\\right)^2 = ${numTex(k)}` },
    { title: "Take square roots", latex: k >= 0 ? `${v} = ${numTex(-h)} \\pm \\sqrt{${numTex(k)}}` : `${v} = ${numTex(-h)} \\pm i\\sqrt{${numTex(-k)}}` },
  ];
}

/** Roots of a polynomial of any degree with steps (rational root theorem + synthetic division + quadratic formula). */
export function polynomialRoots(coeffs: number[], v = "x"): { roots: Root[]; steps: Step[]; formulas: Formula[] } {
  const steps: Step[] = [];
  const formulas: Formula[] = [];
  let work = [...coeffs];
  const roots: Root[] = [];

  // Factor out powers of v
  let zeroMult = 0;
  while (work.length > 1 && Math.abs(work[work.length - 1]) < 1e-12) {
    work.pop();
    zeroMult++;
  }
  if (zeroMult > 0) {
    steps.push({ title: "Factor out the common power", latex: `${zeroMult === 1 ? v : `${v}^{${zeroMult}}`}\\left(${polyTex(work, v)}\\right) = 0`, text: `So $${v} = 0$ is a root${zeroMult > 1 ? ` with multiplicity ${zeroMult}` : ""}.` });
    roots.push({ ...realRoot(0), multiplicity: zeroMult });
  }

  if (work.length - 1 >= 3) {
    const ints = toIntegerCoeffs(work);
    if (ints) {
      formulas.push({ name: "Rational Root Theorem", latex: "x = \\pm\\frac{p}{q},\; p \\mid a_0,\; q \\mid a_n" });
      const cands = rationalRootCandidates(ints);
      steps.push({
        title: "List possible rational roots",
        text: `By the Rational Root Theorem, any rational root is $\\pm\\frac{p}{q}$ where $p$ divides ${Math.abs(ints[ints.length - 1])} and $q$ divides ${Math.abs(ints[0])}.`,
        latex: `\\pm\\left\\{${cands.filter((x) => x > 0).slice(0, 16).map((x) => numTex(x)).join(", ")}${cands.length > 32 ? ", \\ldots" : ""}\\right\\}`,
      });
      let progressed = true;
      while (work.length - 1 >= 3 && progressed) {
        progressed = false;
        for (const r of cands) {
          if (Math.abs(evalPoly(work, r)) < 1e-9 * Math.max(1, ...work.map(Math.abs))) {
            const { quotient } = syntheticDivide(work, r);
            steps.push({
              title: `Test ${v} = ${numText(r)}`,
              latex: `P(${numTex(r)}) = 0 \;\\Rightarrow\; (${v} ${r >= 0 ? "-" : "+"} ${numTex(Math.abs(r))}) \\text{ is a factor}`,
            });
            steps.push({
              title: "Synthetic division",
              latex: `${polyTex(work, v)} = \\left(${v} ${r >= 0 ? "-" : "+"} ${numTex(Math.abs(r))}\\right)\\left(${polyTex(quotient, v)}\\right)`,
            });
            const existing = roots.find((x) => Math.abs(x.value - r) < 1e-12 && !x.im);
            if (existing) existing.multiplicity = (existing.multiplicity ?? 1) + 1;
            else roots.push(realRoot(r));
            work = quotient;
            progressed = true;
            break;
          }
        }
      }
    }
  }

  const deg = work.length - 1;
  if (deg === 2) {
    const q = quadraticRoots(work[0], work[1], work[2], v);
    if (coeffs.length - 1 > 2) steps.push({ title: "Solve the remaining quadratic", latex: `${polyTex(work, v)} = 0` });
    steps.push(...q.steps);
    formulas.push(...q.formulas);
    for (const r of q.roots) {
      const existing = roots.find((x) => !x.im && !r.im && Math.abs(x.value - r.value) < 1e-9);
      if (existing) existing.multiplicity = (existing.multiplicity ?? 1) + (r.multiplicity ?? 1);
      else roots.push(r);
    }
  } else if (deg === 1) {
    const r = -work[1] / work[0];
    steps.push({ title: "Solve the remaining linear factor", latex: `${polyTex(work, v)} = 0 \;\\Rightarrow\; ${v} = ${numTex(r)}` });
    const existing = roots.find((x) => !x.im && Math.abs(x.value - r) < 1e-9);
    if (existing) existing.multiplicity = (existing.multiplicity ?? 1) + 1;
    else roots.push(realRoot(r));
  } else if (deg >= 3) {
    const numeric = polyRoots(work);
    steps.push({
      title: "Solve numerically",
      text: `The remaining factor $${polyTex(work, v)}$ has no rational roots, so its roots are found numerically (Durand–Kerner iteration).`,
    });
    for (const z of numeric) {
      if (z.im === 0) roots.push({ tex: `\\approx ${roundSig(z.re, 8)}`, text: `≈ ${roundSig(z.re, 8)}`, value: z.re, exact: false });
      else roots.push({ tex: `\\approx ${roundSig(z.re, 6)} ${z.im > 0 ? "+" : "-"} ${roundSig(Math.abs(z.im), 6)}i`, text: `≈ ${roundSig(z.re, 6)} ${z.im > 0 ? "+" : "-"} ${roundSig(Math.abs(z.im), 6)}i`, value: z.re, im: z.im, exact: false });
    }
  }
  roots.sort((x, y) => (x.im ? 1 : 0) - (y.im ? 1 : 0) || x.value - y.value);
  return { roots, steps, formulas };
}
