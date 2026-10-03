import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { getPage } from "@/lib/cms";
import { renderMarkdown } from "@/lib/markdown";
import { buildMetadata } from "@/lib/seo";

export const revalidate = 3600;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPage(slug);
  if (!page || page.type !== "RESOURCE") return {};
  return buildMetadata({ title: page.seoTitle ?? page.title, description: page.seoDescription ?? page.description ?? page.title, path: `/resources/${slug}`, noindex: page.noindex });
}

export default async function ResourcePage({ params }: Props) {
  const { slug } = await params;
  const page = await getPage(slug);
  if (!page || page.type !== "RESOURCE") notFound();
  return (
    <article className="container-page max-w-3xl py-10">
      <Breadcrumbs items={[{ name: "Resources", href: "/resources" }, { name: page.title, href: `/resources/${slug}` }]} />
      <h1 className="text-4xl font-semibold tracking-tight">{page.title}</h1>
      {page.description && <p className="mt-3 text-lg text-muted-foreground">{page.description}</p>}
      <div className="prose-math mt-8" dangerouslySetInnerHTML={{ __html: renderMarkdown(page.body) }} />
    </article>
  );
}
