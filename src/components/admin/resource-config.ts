import { CALCULATORS } from "@/lib/calculators/registry";

export type FieldKind = "text" | "slug" | "textarea" | "markdown" | "select" | "checkbox" | "number" | "tags" | "json" | "datetime" | "latex";

export interface AdminField {
  name: string;
  label: string;
  kind: FieldKind;
  options?: { value: string; label: string }[];
  required?: boolean;
  help?: string;
  /** async options (e.g. blog categories) */
  optionsFrom?: "categories";
}

export interface ResourceUI {
  title: string;
  singular: string;
  idField?: string;
  columns: { key: string; label: string }[];
  fields: AdminField[];
  publicUrl?: (row: Record<string, unknown>) => string | null;
}

const STATUS = [{ value: "DRAFT", label: "Draft" }, { value: "PUBLISHED", label: "Published" }, { value: "ARCHIVED", label: "Archived" }];
const seo: AdminField[] = [
  { name: "seoTitle", label: "SEO title", kind: "text", help: "Defaults to the title (max ~60 characters)." },
  { name: "seoDescription", label: "Meta description", kind: "textarea", help: "~150–160 characters." },
];

export const RESOURCE_UI: Record<string, ResourceUI> = {
  posts: {
    title: "Blog posts",
    singular: "post",
    columns: [{ key: "title", label: "Title" }, { key: "status", label: "Status" }, { key: "category.name", label: "Category" }, { key: "updatedAt", label: "Updated" }],
    fields: [
      { name: "title", label: "Title", kind: "text", required: true },
      { name: "slug", label: "Slug", kind: "slug", required: true },
      { name: "excerpt", label: "Excerpt", kind: "textarea", required: true },
      { name: "body", label: "Body (Markdown + LaTeX)", kind: "markdown", required: true },
      { name: "categoryId", label: "Category", kind: "select", optionsFrom: "categories" },
      { name: "tags", label: "Tags", kind: "tags", help: "Comma separated" },
      { name: "status", label: "Status", kind: "select", options: STATUS },
      { name: "publishedAt", label: "Publish date", kind: "datetime", help: "Future dates schedule the post." },
      { name: "readingMinutes", label: "Reading time (min)", kind: "number" },
      { name: "coverImage", label: "Cover image URL", kind: "text" },
      ...seo,
    ],
    publicUrl: (r) => (r.status === "PUBLISHED" ? `/blog/${r.slug}` : null),
  },
  categories: {
    title: "Blog categories",
    singular: "category",
    columns: [{ key: "name", label: "Name" }, { key: "slug", label: "Slug" }],
    fields: [{ name: "name", label: "Name", kind: "text", required: true }, { name: "slug", label: "Slug", kind: "slug", required: true }, { name: "description", label: "Description", kind: "textarea" }],
    publicUrl: (r) => `/blog/category/${r.slug}`,
  },
  pages: {
    title: "Pages & resources",
    singular: "page",
    columns: [{ key: "title", label: "Title" }, { key: "type", label: "Type" }, { key: "status", label: "Status" }, { key: "updatedAt", label: "Updated" }],
    fields: [
      { name: "title", label: "Title", kind: "text", required: true },
      { name: "slug", label: "Slug", kind: "slug", required: true },
      { name: "type", label: "Type", kind: "select", options: [{ value: "PAGE", label: "Page (/slug)" }, { value: "RESOURCE", label: "Learning resource (/resources/slug)" }] },
      { name: "description", label: "Description", kind: "textarea" },
      { name: "body", label: "Body (Markdown + LaTeX)", kind: "markdown", required: true },
      { name: "status", label: "Status", kind: "select", options: STATUS },
      { name: "noindex", label: "Hide from search engines (noindex)", kind: "checkbox" },
      ...seo,
    ],
    publicUrl: (r) => (r.status === "PUBLISHED" ? (r.type === "RESOURCE" ? `/resources/${r.slug}` : `/${r.slug}`) : null),
  },
  formulas: {
    title: "Formulas",
    singular: "formula",
    columns: [{ key: "name", label: "Name" }, { key: "category", label: "Category" }, { key: "status", label: "Status" }],
    fields: [
      { name: "name", label: "Name", kind: "text", required: true },
      { name: "slug", label: "Slug", kind: "slug", required: true },
      { name: "category", label: "Category", kind: "select", options: ["Algebra", "Geometry", "Trigonometry", "Calculus", "Statistics", "Linear Algebra"].map((c) => ({ value: c, label: c })) },
      { name: "latex", label: "Formula (LaTeX)", kind: "latex", required: true },
      { name: "summary", label: "Summary", kind: "textarea", required: true },
      { name: "variables", label: "Variables (JSON)", kind: "json", help: '[{"symbol":"r","meaning":"Radius"}]' },
      { name: "explanation", label: "Explanation (Markdown + LaTeX)", kind: "markdown", required: true },
      { name: "example", label: "Example (Markdown + LaTeX)", kind: "markdown", required: true },
      { name: "relatedCalculator", label: "Related calculator", kind: "select", options: [{ value: "", label: "None" }, ...CALCULATORS.map((c) => ({ value: c.slug, label: c.title }))] },
      { name: "relatedTopics", label: "Related formula slugs", kind: "tags" },
      { name: "faqs", label: "FAQs (JSON)", kind: "json", help: '[{"q":"Question?","a":"Answer."}]' },
      { name: "status", label: "Status", kind: "select", options: STATUS },
    ],
    publicUrl: (r) => `/math-formulas/${r.slug}`,
  },
  calculators: {
    title: "Calculator content",
    singular: "calculator override",
    columns: [{ key: "slug", label: "Calculator" }, { key: "enabled", label: "Enabled" }, { key: "title", label: "Custom title" }, { key: "updatedAt", label: "Updated" }],
    fields: [
      { name: "slug", label: "Calculator", kind: "select", required: true, options: CALCULATORS.map((c) => ({ value: c.slug, label: c.title })) },
      { name: "enabled", label: "Enabled (visible on site)", kind: "checkbox" },
      { name: "title", label: "Title override", kind: "text" },
      { name: "intro", label: "Intro override", kind: "textarea" },
      { name: "body", label: "Additional SEO content (Markdown + LaTeX)", kind: "markdown" },
      { name: "faqs", label: "FAQ override (JSON)", kind: "json", help: '[{"q":"...","a":"..."}]' },
      ...seo,
    ],
    publicUrl: (r) => `/calculators/${r.slug}`,
  },
  faqs: {
    title: "FAQs",
    singular: "FAQ",
    columns: [{ key: "question", label: "Question" }, { key: "scope", label: "Scope" }, { key: "order", label: "Order" }, { key: "published", label: "Published" }],
    fields: [
      { name: "scope", label: "Scope", kind: "select", options: [{ value: "global", label: "Global (home & FAQ page)" }, { value: "pricing", label: "Pricing page" }] },
      { name: "question", label: "Question", kind: "text", required: true },
      { name: "answer", label: "Answer", kind: "textarea", required: true },
      { name: "order", label: "Order", kind: "number" },
      { name: "published", label: "Published", kind: "checkbox" },
    ],
  },
  seo: {
    title: "SEO overrides",
    singular: "override",
    columns: [{ key: "path", label: "Path" }, { key: "title", label: "Title" }, { key: "noindex", label: "Noindex" }],
    fields: [
      { name: "path", label: "Path", kind: "text", required: true, help: "e.g. /ai-math-solver" },
      { name: "title", label: "Title", kind: "text" },
      { name: "description", label: "Description", kind: "textarea" },
      { name: "ogImage", label: "Open Graph image URL", kind: "text" },
      { name: "noindex", label: "Noindex", kind: "checkbox" },
    ],
  },
  settings: {
    title: "Site settings",
    singular: "setting",
    idField: "key",
    columns: [{ key: "key", label: "Key" }, { key: "updatedAt", label: "Updated" }],
    fields: [{ name: "key", label: "Key", kind: "text", required: true }, { name: "value", label: "Value (JSON)", kind: "json", required: true }],
  },
};
