import "server-only";
import { cache } from "react";
import { prisma, safeQuery } from "./db";
import { BLOG_CATEGORIES, SEED_POSTS } from "./content/blog";
import { FORMULAS, type FormulaData } from "./content/formulas";
import { CALCULATORS } from "./calculators/registry";

export interface PostView {
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  category: { slug: string; name: string } | null;
  tags: string[];
  readingMinutes: number;
  publishedAt: Date;
  updatedAt: Date;
  coverImage?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  author?: string | null;
}

function seedPostView(p: (typeof SEED_POSTS)[number]): PostView {
  const cat = BLOG_CATEGORIES.find((c) => c.slug === p.category);
  return { ...p, category: cat ? { slug: cat.slug, name: cat.name } : null, publishedAt: new Date(p.publishedAt), updatedAt: new Date(p.publishedAt), author: "AI Math Solver Team" };
}

export const getBlogCategories = cache(async () =>
  safeQuery(async () => {
    const rows = await prisma.blogCategory.findMany({ orderBy: { name: "asc" } });
    return rows.length ? rows.map((r) => ({ slug: r.slug, name: r.name, description: r.description ?? "" })) : BLOG_CATEGORIES;
  }, BLOG_CATEGORIES),
);

export const getPosts = cache(async (opts: { category?: string; page?: number; perPage?: number; tag?: string } = {}) => {
  const perPage = opts.perPage ?? 12;
  const page = Math.max(1, opts.page ?? 1);
  const fallback = () => {
    const all = SEED_POSTS.filter((p) => (!opts.category || p.category === opts.category) && (!opts.tag || p.tags.includes(opts.tag)))
      .map(seedPostView)
      .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
    return { posts: all.slice((page - 1) * perPage, page * perPage), total: all.length, page, perPage };
  };
  return safeQuery(async () => {
    const where = { status: "PUBLISHED" as const, publishedAt: { lte: new Date() }, ...(opts.category ? { category: { slug: opts.category } } : {}), ...(opts.tag ? { tags: { has: opts.tag } } : {}) };
    const [rows, total] = await Promise.all([
      prisma.blogPost.findMany({ where, include: { category: true, author: { select: { name: true } } }, orderBy: { publishedAt: "desc" }, skip: (page - 1) * perPage, take: perPage }),
      prisma.blogPost.count({ where }),
    ]);
    if (total === 0 && !(await prisma.blogPost.count())) return fallback();
    return {
      posts: rows.map<PostView>((r) => ({ ...r, category: r.category ? { slug: r.category.slug, name: r.category.name } : null, publishedAt: r.publishedAt ?? r.createdAt, author: r.author?.name ?? "AI Math Solver Team" })),
      total,
      page,
      perPage,
    };
  }, fallback());
});

export const getPost = cache(async (slug: string): Promise<PostView | null> => {
  const seed = SEED_POSTS.find((p) => p.slug === slug);
  return safeQuery(async () => {
    const r = await prisma.blogPost.findUnique({ where: { slug }, include: { category: true, author: { select: { name: true } } } });
    if (!r) return (await prisma.blogPost.count()) === 0 && seed ? seedPostView(seed) : null;
    if (r.status !== "PUBLISHED" || (r.publishedAt && r.publishedAt > new Date())) return null;
    return { ...r, category: r.category ? { slug: r.category.slug, name: r.category.name } : null, publishedAt: r.publishedAt ?? r.createdAt, author: r.author?.name ?? "AI Math Solver Team" };
  }, seed ? seedPostView(seed) : null);
});

export const getAllPostSlugs = cache(async () => safeQuery(async () => {
  const rows = await prisma.blogPost.findMany({ where: { status: "PUBLISHED" }, select: { slug: true, updatedAt: true } });
  return rows.length ? rows : SEED_POSTS.map((p) => ({ slug: p.slug, updatedAt: new Date(p.publishedAt) }));
}, SEED_POSTS.map((p) => ({ slug: p.slug, updatedAt: new Date(p.publishedAt) }))));

export const getFormulas = cache(async (): Promise<FormulaData[]> =>
  safeQuery(async () => {
    const rows = await prisma.formula.findMany({ where: { status: "PUBLISHED" }, orderBy: [{ category: "asc" }, { name: "asc" }] });
    if (!rows.length) return FORMULAS;
    return rows.map((r) => ({ ...r, relatedCalculator: r.relatedCalculator ?? undefined, variables: r.variables as unknown as FormulaData["variables"], faqs: r.faqs as unknown as FormulaData["faqs"] }));
  }, FORMULAS),
);

export const getFormula = cache(async (slug: string) => (await getFormulas()).find((f) => f.slug === slug) ?? null);

export interface CalculatorOverride {
  enabled: boolean;
  title?: string | null;
  intro?: string | null;
  body?: string | null;
  faqs?: { q: string; a: string }[] | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
}

export const getCalculatorOverrides = cache(async (): Promise<Map<string, CalculatorOverride>> =>
  safeQuery(async () => {
    const rows = await prisma.calculatorContent.findMany();
    return new Map(rows.map((r) => [r.slug, { ...r, faqs: (r.faqs as CalculatorOverride["faqs"]) ?? null }]));
  }, new Map()),
);

export const getEnabledCalculators = cache(async () => {
  const overrides = await getCalculatorOverrides();
  return CALCULATORS.filter((c) => overrides.get(c.slug)?.enabled !== false);
});

export const getFaqs = cache(async (scope: string) =>
  safeQuery(async () => {
    const rows = await prisma.faq.findMany({ where: { scope, published: true }, orderBy: { order: "asc" } });
    return rows.map((r) => ({ q: r.question, a: r.answer }));
  }, [] as { q: string; a: string }[]),
);

export const getSeoOverride = cache(async (path: string) =>
  safeQuery(() => prisma.seoOverride.findUnique({ where: { path } }), null),
);

export const getPage = cache(async (slug: string) =>
  safeQuery(() => prisma.contentPage.findFirst({ where: { slug, status: "PUBLISHED" } }), null),
);

export const getPublishedPages = cache(async () =>
  safeQuery(() => prisma.contentPage.findMany({ where: { status: "PUBLISHED", noindex: false }, select: { slug: true, title: true, type: true, description: true, updatedAt: true } }), []),
);
