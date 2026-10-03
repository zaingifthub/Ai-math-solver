import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { JsonLd } from "@/components/seo/json-ld";
import { PostCard } from "@/components/marketing/post-card";
import { CtaBanner } from "@/components/marketing/sections";
import { getPost, getPosts } from "@/lib/cms";
import { SEED_POSTS } from "@/lib/content/blog";
import { renderMarkdown } from "@/lib/markdown";
import { buildMetadata } from "@/lib/seo";
import { absoluteUrl, siteConfig } from "@/lib/site";
import { formatDate } from "@/lib/utils";

export const revalidate = 600;
export const dynamicParams = true;

export function generateStaticParams() {
  return SEED_POSTS.map((p) => ({ slug: p.slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await getPost((await params).slug);
  if (!post) return {};
  return buildMetadata({ title: post.seoTitle ?? post.title, description: post.seoDescription ?? post.excerpt, path: `/blog/${post.slug}`, type: "article", publishedTime: post.publishedAt.toISOString(), modifiedTime: post.updatedAt.toISOString(), image: post.coverImage ?? undefined, keywords: post.tags });
}

export default async function PostPage({ params }: Props) {
  const post = await getPost((await params).slug);
  if (!post) notFound();
  const html = renderMarkdown(post.body);
  const { posts: related } = await getPosts({ category: post.category?.slug, perPage: 4 });
  return (
    <>
      <article className="container-page max-w-3xl py-10">
        <Breadcrumbs items={[{ name: "Blog", href: "/blog" }, ...(post.category ? [{ name: post.category.name, href: `/blog/category/${post.category.slug}` }] : []), { name: post.title, href: `/blog/${post.slug}` }]} />
        <header>
          {post.category && <Link href={`/blog/category/${post.category.slug}`} className="text-sm font-semibold uppercase tracking-wide text-primary">{post.category.name}</Link>}
          <h1 className="mt-2 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">{post.title}</h1>
          <p className="mt-4 text-lg text-muted-foreground">{post.excerpt}</p>
          <p className="mt-4 text-sm text-muted-foreground">By {post.author} · <time dateTime={post.publishedAt.toISOString()}>{formatDate(post.publishedAt)}</time> · {post.readingMinutes} min read</p>
        </header>
        <div className="prose-math mt-10 text-[17px] leading-8" dangerouslySetInnerHTML={{ __html: html }} />
        {post.tags.length > 0 && (
          <div className="mt-10 flex flex-wrap gap-2">{post.tags.map((t) => <span key={t} className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">#{t}</span>)}</div>
        )}
      </article>
      {related.filter((p) => p.slug !== post.slug).length > 0 && (
        <section className="container-page py-10">
          <h2 className="mb-5 text-2xl font-semibold tracking-tight">Keep reading</h2>
          <div className="grid gap-5 md:grid-cols-3">{related.filter((p) => p.slug !== post.slug).slice(0, 3).map((p) => <PostCard key={p.slug} post={p} />)}</div>
        </section>
      )}
      <CtaBanner title="Practice what you just learned" description="Solve your own problems step by step and ask the AI tutor about anything that's unclear." />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: post.title,
          description: post.excerpt,
          datePublished: post.publishedAt.toISOString(),
          dateModified: post.updatedAt.toISOString(),
          author: { "@type": "Organization", name: post.author ?? siteConfig.name },
          publisher: { "@type": "Organization", name: siteConfig.name, logo: { "@type": "ImageObject", url: absoluteUrl("/icon.svg") } },
          mainEntityOfPage: absoluteUrl(`/blog/${post.slug}`),
          image: post.coverImage ?? absoluteUrl(`/og?title=${encodeURIComponent(post.title)}`),
          keywords: post.tags.join(", "),
        }}
      />
    </>
  );
}
