import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { Hero } from "@/components/marketing/hero";
import { HowItWorks, CtaBanner, SectionHeading } from "@/components/marketing/sections";
import { FaqSection } from "@/components/seo/faq-section";
import { JsonLd } from "@/components/seo/json-ld";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { landingMap, LANDINGS } from "@/lib/content/landings";
import { getPage, getSeoOverride } from "@/lib/cms";
import { renderMarkdown } from "@/lib/markdown";
import { buildMetadata, softwareAppSchema } from "@/lib/seo";
import { getCalculator } from "@/lib/calculators/registry";
import { formatDate } from "@/lib/utils";

export const revalidate = 3600;
export const dynamicParams = true;

export function generateStaticParams() {
  return [...LANDINGS.map((l) => ({ slug: l.slug })), { slug: "about" }, { slug: "privacy-policy" }, { slug: "terms-of-service" }];
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const override = await getSeoOverride(`/${slug}`);
  const landing = landingMap.get(slug);
  if (landing) return buildMetadata({ title: override?.title ?? landing.title, description: override?.description ?? landing.description, path: `/${slug}`, keywords: landing.keywords, absoluteTitle: true, noindex: override?.noindex });
  const page = await getPage(slug);
  if (!page || page.type !== "PAGE") return {};
  return buildMetadata({ title: page.seoTitle ?? page.title, description: page.seoDescription ?? page.description ?? page.title, path: `/${slug}`, noindex: page.noindex });
}

export default async function SlugPage({ params }: Props) {
  const { slug } = await params;
  const landing = landingMap.get(slug);
  if (landing) {
    return (
      <>
        <Hero eyebrow={landing.eyebrow} title={landing.h1} description={landing.intro} examples={landing.examples} />
        <section className="container-page py-16">
          <SectionHeading title={`What the ${landing.h1.toLowerCase()} can do`} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {landing.topics.map((t) => (
              <div key={t.name} className="rounded-2xl border bg-card p-6">
                <h3 className="font-semibold">{t.name}</h3>
                <p className="mt-1 font-mono text-xs text-primary">{t.example}</p>
                <p className="mt-2 text-sm text-muted-foreground">{t.desc}</p>
              </div>
            ))}
          </div>
        </section>
        <HowItWorks />
        <section className="container-page max-w-3xl space-y-10 py-8">
          {landing.sections.map((s) => (
            <div key={s.heading}>
              <h2 className="text-2xl font-semibold tracking-tight">{s.heading}</h2>
              <p className="mt-3 leading-relaxed text-muted-foreground">{s.body}</p>
            </div>
          ))}
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Related calculators</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {landing.calculators.map((c) => {
                const def = getCalculator(c);
                return def ? <Link key={c} href={def.kind === "graph" ? "/graphing-calculator" : `/calculators/${c}`} className="rounded-full border bg-card px-4 py-2 text-sm hover:border-primary/40">{def.title}</Link> : null;
              })}
            </div>
          </div>
          <FaqSection faqs={landing.faqs} />
        </section>
        <CtaBanner />
        <JsonLd data={softwareAppSchema(landing.h1, landing.description, `/${slug}`)} />
      </>
    );
  }
  const page = await getPage(slug);
  if (!page || page.type !== "PAGE") notFound();
  return (
    <article className="container-page max-w-3xl py-12">
      <Breadcrumbs items={[{ name: page.title, href: `/${slug}` }]} />
      <h1 className="text-4xl font-semibold tracking-tight">{page.title}</h1>
      {page.description && <p className="mt-3 text-lg text-muted-foreground">{page.description}</p>}
      <div className="prose-math mt-8" dangerouslySetInnerHTML={{ __html: renderMarkdown(page.body) }} />
      <p className="mt-10 text-xs text-muted-foreground">Last updated {formatDate(page.updatedAt)}</p>
    </article>
  );
}
