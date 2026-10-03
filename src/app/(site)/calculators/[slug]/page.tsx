import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { CalculatorWidget } from "@/components/calculators/calculator-widget";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { FaqSection } from "@/components/seo/faq-section";
import { JsonLd } from "@/components/seo/json-ld";
import { MathText } from "@/components/math/tex";
import { Tex } from "@/components/math/tex";
import { CALCULATORS, getCalculator } from "@/lib/calculators/registry";
import { CATEGORY_LABELS } from "@/lib/calculators/types";
import { getCalculatorOverrides, getFormulas } from "@/lib/cms";
import { renderMarkdown } from "@/lib/markdown";
import { buildMetadata } from "@/lib/seo";
import { absoluteUrl } from "@/lib/site";

export const revalidate = 3600;

export function generateStaticParams() {
  return CALCULATORS.filter((c) => c.kind !== "graph").map((c) => ({ slug: c.slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const def = getCalculator(slug);
  if (!def) return {};
  const o = (await getCalculatorOverrides()).get(slug);
  return buildMetadata({ title: o?.seoTitle ?? `${o?.title ?? def.title} — Free with Steps`, description: o?.seoDescription ?? def.description, path: `/calculators/${slug}`, keywords: def.keywords });
}

export default async function CalculatorPage({ params }: Props) {
  const { slug } = await params;
  const def = getCalculator(slug);
  const overrides = await getCalculatorOverrides();
  const o = overrides.get(slug);
  if (!def || def.kind === "graph" || o?.enabled === false) notFound();
  const formulas = (await getFormulas()).filter((f) => def.formulas?.includes(f.slug));
  const title = o?.title ?? def.title;
  const faqs = o?.faqs?.length ? o.faqs : def.faqs;
  const related = def.related.map((r) => getCalculator(r)).filter((c) => c && overrides.get(c.slug)?.enabled !== false);
  return (
    <div className="container-page py-10">
      <Breadcrumbs items={[{ name: "Calculators", href: "/calculators" }, { name: CATEGORY_LABELS[def.category], href: `/calculators#${def.category}` }, { name: title, href: `/calculators/${slug}` }]} />
      <div className="grid gap-10 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
          <p className="mt-3 max-w-3xl text-lg text-muted-foreground">{o?.intro ?? def.intro}</p>
          <div className="mt-8">
            <CalculatorWidget slug={slug} />
          </div>

          <section className="mt-14">
            <h2 className="text-2xl font-semibold tracking-tight">How to use the {title.toLowerCase()}</h2>
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-muted-foreground">
              {def.howTo.map((h, i) => <li key={i}><MathText text={h} /></li>)}
            </ol>
          </section>

          <section className="mt-12">
            <h2 className="text-2xl font-semibold tracking-tight">Examples</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {def.examples.map((ex, i) => (
                <div key={i} className="rounded-xl border bg-card p-4">
                  <p className="font-mono text-sm">{ex.problem}</p>
                  <p className="mt-2 text-sm"><span className="text-muted-foreground">Answer:</span> <strong>{ex.answer}</strong></p>
                  {ex.note && <p className="mt-1 text-xs text-muted-foreground">{ex.note}</p>}
                </div>
              ))}
            </div>
          </section>

          {o?.body && <section className="prose-math mt-12" dangerouslySetInnerHTML={{ __html: renderMarkdown(o.body) }} />}

          {formulas.length > 0 && (
            <section className="mt-12">
              <h2 className="text-2xl font-semibold tracking-tight">Formulas</h2>
              <div className="mt-4 grid gap-3">
                {formulas.map((f) => (
                  <Link key={f.slug} href={`/math-formulas/${f.slug}`} className="rounded-xl border bg-card p-4 transition-colors hover:border-primary/40">
                    <p className="font-medium">{f.name}</p>
                    <div className="overflow-x-auto"><Tex tex={f.latex} display /></div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <FaqSection faqs={faqs} />
        </div>
        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-xl border bg-card p-5">
            <h2 className="text-sm font-semibold">Related calculators</h2>
            <ul className="mt-3 space-y-2">
              {related.map((r) => (
                <li key={r!.slug}><Link href={r!.kind === "graph" ? "/graphing-calculator" : `/calculators/${r!.slug}`} className="text-sm text-muted-foreground hover:text-primary">{r!.title}</Link></li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border bg-gradient-to-br from-primary/10 to-sky-500/5 p-5">
            <h2 className="text-sm font-semibold">Need more than a calculator?</h2>
            <p className="mt-2 text-sm text-muted-foreground">Ask the AI tutor to explain any step, give a hint or create practice problems.</p>
            <Link href="/tutor" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">Open AI tutor →</Link>
          </div>
        </aside>
      </div>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: title,
          url: absoluteUrl(`/calculators/${slug}`),
          description: def.description,
          applicationCategory: "EducationalApplication",
          operatingSystem: "Any",
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        }}
      />
      <JsonLd data={{ "@context": "https://schema.org", "@type": "HowTo", name: `How to use the ${title}`, step: def.howTo.map((h, i) => ({ "@type": "HowToStep", position: i + 1, text: h.replace(/\$/g, "") })) }} />
    </div>
  );
}
