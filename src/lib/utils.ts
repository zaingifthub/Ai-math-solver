import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(d: Date | string, opts: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" }) {
  return new Date(d).toLocaleDateString("en-US", opts);
}

export function timeAgo(d: Date | string) {
  const s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(d);
}

export const LEVELS = [
  { value: "BEGINNER", label: "Beginner" },
  { value: "MIDDLE_SCHOOL", label: "Middle school" },
  { value: "HIGH_SCHOOL", label: "High school" },
  { value: "COLLEGE", label: "College" },
] as const;

export const CATEGORY_NAMES: Record<string, string> = {
  arithmetic: "Arithmetic", algebra: "Algebra", equation: "Equations", polynomial: "Polynomials", system: "Systems", inequality: "Inequalities",
  function: "Functions", exponent: "Exponents", logarithm: "Logarithms", trigonometry: "Trigonometry", geometry: "Geometry", derivative: "Derivatives",
  integral: "Integrals", limit: "Limits", statistics: "Statistics", probability: "Probability", matrix: "Matrices", vector: "Vectors", units: "Units", "word-problem": "Word problems",
};
