import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { PostCard, Pagination } from "@/components/marketing/post-card";
import { getPosts, getBlogCategories } from "@/lib/cms";
import { BLOG_CATEGORIES } from "@/lib/content/blog";
import { buildMetadata } from "@/lib/seo";

export const revalidate = 600;
export const dynamicParams = true;

export function generateStaticParams() {
  return BLOG_CATEGORIES.map((c) => ({ slug: c.slug }));
}

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const cat = (await getBlogCategories()).find((c) => c.slug === slug);
  if (!cat) return {};
  return buildMetadata({ title: `${cat.name} Articles`, description: cat.description || `${cat.name} articles and guides.`, path: `/blog/category/${slug}` });
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const page = Math.max(1, Number((await searchParams).page ?? 1) || 1);
  const cat = (await getBlogCategories()).find((c) => c.slug === slug);
  if (!cat) notFound();
  const { posts, total, perPage } = await getPosts({ category: slug, page });
  return (
    <div className="container-page py-10">
      <Breadcrumbs items={[{ name: "Blog", href: "/blog" }, { name: cat.name, href: `/blog/category/${slug}` }]} />
      <h1 className="text-4xl font-semibold tracking-tight">{cat.name}</h1>
      {cat.description && <p className="mt-3 max-w-2xl text-lg text-muted-foreground">{cat.description}</p>}
      <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{posts.map((p) => <PostCard key={p.slug} post={p} />)}</div>
      {posts.length === 0 && <p className="mt-10 text-muted-foreground">No articles in this category yet.</p>}
      <Pagination page={page} total={total} perPage={perPage} base={`/blog/category/${slug}`} />
    </div>
  );
}
