export type FieldType = "text" | "expression" | "number" | "select" | "list" | "matrix";

export interface CalcField {
  name: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  default?: string;
  options?: { value: string; label: string }[];
  optional?: boolean;
  help?: string;
  /** Only show this field when another field has one of these values. */
  showIf?: { field: string; values: string[] };
}

export interface InstantResult {
  results: { label: string; latex: string }[];
  steps: { title: string; latex?: string; text?: string }[];
}

export type CalcCategory = "algebra" | "calculus" | "arithmetic" | "geometry" | "statistics" | "linear-algebra" | "trigonometry" | "graphing" | "conversion";

export interface CalculatorDef {
  slug: string;
  title: string;
  shortTitle: string;
  category: CalcCategory;
  description: string;
  icon: string;
  kind: "engine" | "instant" | "scientific" | "graph";
  fields?: CalcField[];
  /** engine: build the solver query from field values */
  build?: (v: Record<string, string>) => string;
  /** instant: compute results client-side */
  compute?: (v: Record<string, string>) => InstantResult;
  intro: string;
  howTo: string[];
  examples: { problem: string; answer: string; note?: string }[];
  faqs: { q: string; a: string }[];
  related: string[];
  formulas?: string[];
  keywords: string[];
}

export const CATEGORY_LABELS: Record<CalcCategory, string> = {
  algebra: "Algebra",
  calculus: "Calculus",
  arithmetic: "Arithmetic & Numbers",
  geometry: "Geometry",
  statistics: "Statistics & Probability",
  "linear-algebra": "Linear Algebra",
  trigonometry: "Trigonometry",
  graphing: "Graphing",
  conversion: "Conversions",
};
