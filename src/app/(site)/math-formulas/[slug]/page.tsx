import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { FaqSection } from "@/components/seo/faq-section";
import { JsonLd } from "@/components/seo/json-ld";
import { Tex } from "@/components/math/tex";
import { Button } from "@/components/ui/button";
import { getFormula, getFormulas } from "@/lib/cms";
import { FORMULAS } from "@/lib/content/formulas";
import { getCalculator } from "@/lib/calculators/registry";
import { renderMarkdown } from "@/lib/markdown";
import { buildMetadata } from "@/lib/seo";
import { absoluteUrl } from "@/lib/site";

export const revalidate = 3600;
export const dynamicParams = true;

export function generateStaticParams() {
  return FORMULAS.map((f) => ({ slug: f.slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const f = await getFormula((await params).slug);
  if (!f) return {};
  return buildMetadata({ title: `${f.name} — Formula, Explanation & Examples`, description: `${f.summary} Learn what each variable means, see a worked example and try the related calculator.`, path: `/math-formulas/${f.slug}` });
}

export default async function FormulaPage({ params }: Props) {
  const f = await getFormula((await params).slug);
  if (!f) notFound();
  const all = await getFormulas();
  const related = f.relatedTopics.map((s) => all.find((x) => x.slug === s)).filter(Boolean);
  const calc = f.relatedCalculator ? getCalculator(f.relatedCalculator) : undefined;
  return (
    <article className="container-page max-w-3xl py-10">
      <Breadcrumbs items={[{ name: "Math Formulas", href: "/math-formulas" }, { name: f.category, href: `/math-formulas#${f.category.toLowerCase().replace(/\s+/g, "-")}` }, { name: f.name, href: `/math-formulas/${f.slug}` }]} />
      <h1 className="text-4xl font-semibold tracking-tight">{f.name}</h1>
      <p className="mt-3 text-lg text-muted-foreground">{f.summary}</p>
      <div className="mt-8 overflow-x-auto rounded-2xl border bg-gradient-to-br from-primary/8 to-sky-500/5 p-6 text-xl">
        <Tex tex={f.latex} display />
      </div>
      {f.variables.length > 0 && (
        <section className="mt-10">
          <h2 className="text-2xl font-semibold tracking-tight">Variables</h2>
          <dl className="mt-4 divide-y rounded-xl border bg-card">
            {f.variables.map((v) => (
              <div key={v.symbol} className="flex gap-4 p-4">
                <dt className="w-28 shrink-0 font-mono text-sm font-semibold">{v.symbol}</dt>
                <dd className="text-sm text-muted-foreground">{v.meaning}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
      <section className="mt-10">
        <h2 className="text-2xl font-semibold tracking-tight">Explanation</h2>
        <div className="prose-math mt-3" dangerouslySetInnerHTML={{ __html: renderMarkdown(f.explanation) }} />
      </section>
      <section className="mt-10">
        <h2 className="text-2xl font-semibold tracking-tight">Example</h2>
        <div className="prose-math mt-3 rounded-xl border bg-card p-5" dangerouslySetInnerHTML={{ __html: renderMarkdown(f.example) }} />
      </section>
      {calc && (
        <div className="mt-10 flex flex-col items-start justify-between gap-4 rounded-2xl border bg-card p-6 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-semibold">Try it: {calc.title}</h2>
            <p className="text-sm text-muted-foreground">{calc.description}</p>
          </div>
          <Button asChild><Link href={calc.kind === "graph" ? "/graphing-calculator" : `/calculators/${calc.slug}`}>Open calculator</Link></Button>
        </div>
      )}
      <FaqSection faqs={f.faqs} />
      {related.length > 0 && (
        <section className="mt-12">
          <h2 className="text-2xl font-semibold tracking-tight">Related formulas</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {related.map((r) => (
              <Link key={r!.slug} href={`/math-formulas/${r!.slug}`} className="rounded-xl border bg-card p-4 hover:border-primary/40">
                <p className="font-medium">{r!.name}</p>
                <p className="text-sm text-muted-foreground">{r!.summary}</p>
              </Link>
            ))}
          </div>
        </section>
      )}
      <JsonLd data={{ "@context": "https://schema.org", "@type": "LearningResource", name: f.name, description: f.summary, url: absoluteUrl(`/math-formulas/${f.slug}`), educationalLevel: "High school, College", learningResourceType: "Formula", about: f.category, inLanguage: "en" }} />
    </article>
  );
}
