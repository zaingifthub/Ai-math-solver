import "server-only";
import { z } from "zod";
import type { Role } from "@prisma/client";
import { prisma } from "./db";

const slug = z.string().trim().toLowerCase().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug may contain lowercase letters, numbers and dashes only.");
const status = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]);
const optStr = (max: number) => z.string().trim().max(max).optional().nullable().transform((v) => (v ? v : null));
const faqList = z.array(z.object({ q: z.string().trim().min(1).max(500), a: z.string().trim().min(1).max(4000) })).max(50);

/* eslint-disable @typescript-eslint/no-explicit-any */
type Delegate = {
  findMany: (args: any) => Promise<any[]>;
  count: (args: any) => Promise<number>;
  findUnique: (args: any) => Promise<any>;
  create: (args: any) => Promise<any>;
  update: (args: any) => Promise<any>;
  delete: (args: any) => Promise<any>;
};

export interface ResourceDef {
  label: string;
  role: Role;
  delegate: () => Delegate;
  schema: z.ZodTypeAny;
  idField?: string;
  search: string[];
  orderBy: Record<string, "asc" | "desc">;
  include?: Record<string, unknown>;
  revalidate: (row: Record<string, unknown>) => string[];
  prepare?: (data: Record<string, unknown>, existing?: Record<string, unknown> | null) => Record<string, unknown>;
}

export const RESOURCES: Record<string, ResourceDef> = {
  posts: {
    label: "Blog posts",
    role: "EDITOR",
    delegate: () => prisma.blogPost as unknown as Delegate,
    schema: z.object({
      slug,
      title: z.string().trim().min(1).max(200),
      excerpt: z.string().trim().min(1).max(500),
      body: z.string().min(1).max(200_000),
      coverImage: optStr(500),
      tags: z.array(z.string().trim().max(40)).max(20).default([]),
      status: status.default("DRAFT"),
      categoryId: optStr(40),
      readingMinutes: z.coerce.number().int().min(1).max(120).default(5),
      seoTitle: optStr(200),
      seoDescription: optStr(320),
      publishedAt: z.coerce.date().optional().nullable(),
    }),
    search: ["title", "slug"],
    orderBy: { updatedAt: "desc" },
    include: { category: { select: { name: true, slug: true } } },
    revalidate: (r) => ["/blog", `/blog/${r.slug}`, "/sitemap.xml"],
    prepare: (d, existing) => ({ ...d, publishedAt: d.status === "PUBLISHED" ? (d.publishedAt ?? existing?.publishedAt ?? new Date()) : d.publishedAt ?? null }),
  },
  categories: {
    label: "Blog categories",
    role: "EDITOR",
    delegate: () => prisma.blogCategory as unknown as Delegate,
    schema: z.object({ slug, name: z.string().trim().min(1).max(80), description: optStr(500) }),
    search: ["name", "slug"],
    orderBy: { name: "asc" },
    revalidate: (r) => ["/blog", `/blog/category/${r.slug}`],
  },
  pages: {
    label: "Pages & resources",
    role: "EDITOR",
    delegate: () => prisma.contentPage as unknown as Delegate,
    schema: z.object({
      slug,
      type: z.enum(["PAGE", "RESOURCE"]).default("PAGE"),
      title: z.string().trim().min(1).max(200),
      description: optStr(500),
      body: z.string().min(1).max(200_000),
      status: status.default("DRAFT"),
      seoTitle: optStr(200),
      seoDescription: optStr(320),
      noindex: z.boolean().default(false),
    }),
    search: ["title", "slug"],
    orderBy: { updatedAt: "desc" },
    revalidate: (r) => [`/resources/${r.slug}`, "/resources", "/sitemap.xml"],
  },
  formulas: {
    label: "Formulas",
    role: "EDITOR",
    delegate: () => prisma.formula as unknown as Delegate,
    schema: z.object({
      slug,
      name: z.string().trim().min(1).max(200),
      category: z.string().trim().min(1).max(60),
      latex: z.string().min(1).max(2000),
      summary: z.string().trim().min(1).max(500),
      variables: z.array(z.object({ symbol: z.string().max(60), meaning: z.string().max(300) })).max(30).default([]),
      explanation: z.string().min(1).max(50_000),
      example: z.string().min(1).max(50_000),
      relatedCalculator: optStr(120),
      relatedTopics: z.array(z.string().max(120)).max(20).default([]),
      faqs: faqList.default([]),
      status: status.default("PUBLISHED"),
    }),
    search: ["name", "slug", "category"],
    orderBy: { name: "asc" },
    revalidate: (r) => ["/math-formulas", `/math-formulas/${r.slug}`],
  },
  calculators: {
    label: "Calculator content",
    role: "EDITOR",
    delegate: () => prisma.calculatorContent as unknown as Delegate,
    schema: z.object({
      slug,
      enabled: z.boolean().default(true),
      title: optStr(200),
      intro: optStr(5000),
      body: optStr(100_000),
      faqs: faqList.optional().nullable(),
      seoTitle: optStr(200),
      seoDescription: optStr(320),
    }),
    search: ["slug", "title"],
    orderBy: { slug: "asc" },
    revalidate: (r) => ["/calculators", `/calculators/${r.slug}`],
  },
  faqs: {
    label: "FAQs",
    role: "EDITOR",
    delegate: () => prisma.faq as unknown as Delegate,
    schema: z.object({ scope: z.string().trim().min(1).max(60).default("global"), question: z.string().trim().min(1).max(500), answer: z.string().trim().min(1).max(5000), order: z.coerce.number().int().min(0).max(10_000).default(0), published: z.boolean().default(true) }),
    search: ["question", "scope"],
    orderBy: { order: "asc" },
    revalidate: () => ["/", "/pricing", "/faq"],
  },
  seo: {
    label: "SEO overrides",
    role: "ADMIN",
    delegate: () => prisma.seoOverride as unknown as Delegate,
    schema: z.object({ path: z.string().trim().min(1).max(300).regex(/^\/[^\s]*$/, "Path must start with /"), title: optStr(200), description: optStr(320), ogImage: optStr(500), noindex: z.boolean().default(false) }),
    search: ["path", "title"],
    orderBy: { path: "asc" },
    revalidate: (r) => [String(r.path)],
  },
  settings: {
    label: "Site settings",
    role: "ADMIN",
    delegate: () => prisma.siteSetting as unknown as Delegate,
    schema: z.object({ key: z.string().trim().min(1).max(100).regex(/^[a-z0-9_.-]+$/), value: z.unknown() }),
    idField: "key",
    search: ["key"],
    orderBy: { key: "asc" },
    revalidate: () => ["/"],
  },
};
