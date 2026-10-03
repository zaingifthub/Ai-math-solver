import Link from "next/link";
import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { PostCard, Pagination } from "@/components/marketing/post-card";
import { getPosts, getBlogCategories } from "@/lib/cms";
import { buildMetadata } from "@/lib/seo";

export const revalidate = 600;

type Props = { searchParams: Promise<{ page?: string }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const page = Number((await searchParams).page ?? 1);
  return buildMetadata({ title: page > 1 ? `Math Blog — Page ${page}` : "Math Blog — Guides, Explanations & Study Tips", description: "Clear explanations of algebra, calculus, geometry and statistics, homework help with worked examples, and evidence-based study tips.", path: page > 1 ? `/blog?page=${page}` : "/blog" });
}

export default async function BlogPage({ searchParams }: Props) {
  const page = Math.max(1, Number((await searchParams).page ?? 1) || 1);
  const [{ posts, total, perPage }, categories] = await Promise.all([getPosts({ page }), getBlogCategories()]);
  return (
    <div className="container-page py-10">
      <Breadcrumbs items={[{ name: "Blog", href: "/blog" }]} />
      <h1 className="text-4xl font-semibold tracking-tight">Math Blog</h1>
      <p className="mt-3 max-w-2xl text-lg text-muted-foreground">Guides, worked examples and study strategies from the AI Math Solver team.</p>
      <nav className="mt-6 flex flex-wrap gap-2" aria-label="Categories">
        {categories.map((c) => <Link key={c.slug} href={`/blog/category/${c.slug}`} className="rounded-full border px-3 py-1 text-sm hover:bg-muted">{c.name}</Link>)}
      </nav>
      <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {posts.map((p) => <PostCard key={p.slug} post={p} />)}
      </div>
      {posts.length === 0 && <p className="mt-10 text-muted-foreground">No articles yet.</p>}
      <Pagination page={page} total={total} perPage={perPage} base="/blog" />
    </div>
  );
}
