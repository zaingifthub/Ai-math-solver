import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";
import { CALCULATORS } from "@/lib/calculators/registry";
import { getAllPostSlugs, getFormulas, getBlogCategories, getPublishedPages } from "@/lib/cms";
import { LANDINGS } from "@/lib/content/landings";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticPaths: [string, number, MetadataRoute.Sitemap[number]["changeFrequency"]][] = [
    ["/", 1, "daily"],
    ["/solver", 0.95, "weekly"],
    ["/tutor", 0.8, "weekly"],
    ["/calculators", 0.9, "weekly"],
    ["/graphing-calculator", 0.85, "monthly"],
    ["/math-tools", 0.8, "weekly"],
    ["/math-formulas", 0.85, "weekly"],
    ["/practice", 0.7, "weekly"],
    ["/blog", 0.8, "daily"],
    ["/pricing", 0.6, "monthly"],
    ["/faq", 0.5, "monthly"],
  ];
  const [posts, formulas, categories, pages] = await Promise.all([getAllPostSlugs(), getFormulas(), getBlogCategories(), getPublishedPages()]);
  return [
    ...staticPaths.map(([p, priority, changeFrequency]) => ({ url: absoluteUrl(p), lastModified: now, priority, changeFrequency })),
    ...LANDINGS.map((l) => ({ url: absoluteUrl(`/${l.slug}`), lastModified: now, priority: 0.9, changeFrequency: "weekly" as const })),
    ...CALCULATORS.filter((c) => c.kind !== "graph").map((c) => ({ url: absoluteUrl(`/calculators/${c.slug}`), lastModified: now, priority: 0.8, changeFrequency: "monthly" as const })),
    ...formulas.map((f) => ({ url: absoluteUrl(`/math-formulas/${f.slug}`), lastModified: now, priority: 0.6, changeFrequency: "monthly" as const })),
    ...categories.map((c) => ({ url: absoluteUrl(`/blog/category/${c.slug}`), lastModified: now, priority: 0.5, changeFrequency: "weekly" as const })),
    ...posts.map((p) => ({ url: absoluteUrl(`/blog/${p.slug}`), lastModified: p.updatedAt, priority: 0.7, changeFrequency: "monthly" as const })),
    ...pages.map((p) => ({ url: absoluteUrl(p.type === "RESOURCE" ? `/resources/${p.slug}` : `/${p.slug}`), lastModified: p.updatedAt, priority: 0.4, changeFrequency: "monthly" as const })),
  ];
}
