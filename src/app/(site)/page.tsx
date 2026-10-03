import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Hero } from "@/components/marketing/hero";
import { HowItWorks, FeatureGrid, ComparisonTable, Audiences, CtaBanner, SectionHeading } from "@/components/marketing/sections";
import { TopicGrid } from "@/components/marketing/topic-grid";
import { FaqSection } from "@/components/seo/faq-section";
import { JsonLd } from "@/components/seo/json-ld";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { buildMetadata, softwareAppSchema } from "@/lib/seo";
import { getPosts, getFaqs } from "@/lib/cms";
import { CALCULATORS } from "@/lib/calculators/registry";
import { formatDate } from "@/lib/utils";

export const revalidate = 3600;

export const metadata = buildMetadata({
  title: "AI Math Solver — Free Step-by-Step Math Solutions with an AI Tutor",
  description: "Solve any math problem with verified step-by-step solutions. Algebra, calculus, geometry, statistics, photo math scanning, graphing, 30+ calculators and an AI math tutor.",
  path: "/",
  absoluteTitle: true,
  keywords: ["ai math solver", "math solver", "step by step math", "math homework help", "calculus solver", "algebra solver"],
});

const DEFAULT_FAQS = [
  { q: "Is AI Math Solver free?", a: "Yes. Every day you get free verified step-by-step solutions plus unlimited access to calculators, graphing, formulas and practice. Premium removes all limits." },
  { q: "How do you make sure answers are correct?", a: "Answers are computed by a symbolic math engine — not guessed by AI — and then independently verified (for example by substituting solutions back or comparing with numerical calculus). The checks are shown with every answer." },
  { q: "What topics can it solve?", a: "Arithmetic, fractions, algebra, equations, inequalities, polynomials, functions, exponents, logarithms, trigonometry, geometry, limits, derivatives, integrals, statistics, probability, matrices, vectors and word problems." },
  { q: "Can I upload a photo of my homework?", a: "Yes. Upload a photo or screenshot, confirm the transcription, and get the full solution." },
];

export default async function HomePage() {
  const [{ posts }, faqs] = await Promise.all([getPosts({ perPage: 3 }), getFaqs("global")]);
  const popular = ["derivative-calculator", "integral-calculator", "quadratic-formula-calculator", "matrix-calculator", "fraction-calculator", "statistics-calculator", "triangle-calculator", "graphing-calculator"]
    .map((s) => CALCULATORS.find((c) => c.slug === s)!)
    .filter(Boolean);
  return (
    <>
      <Hero eyebrow="Engine-verified answers · AI-powered explanations" title="Solve any math problem," highlight="step by step." description="Type it, paste it or snap a photo. Get the exact answer, every step explained, and an AI tutor for follow-up questions — from basic arithmetic to college calculus." />
      <section className="container-page py-16">
        <SectionHeading eyebrow="20+ problem types" title="Try a topic" description="Click any topic to see a fully worked, verified example." />
        <TopicGrid />
      </section>
      <HowItWorks />
      <FeatureGrid />
      <ComparisonTable />
      <section className="container-page py-20">
        <SectionHeading eyebrow="Calculator library" title="Popular math calculators" description="Dedicated tools with examples, formulas and step-by-step results." />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {popular.map((c) => (
            <Link key={c.slug} href={c.kind === "graph" ? "/graphing-calculator" : `/calculators/${c.slug}`} className="rounded-xl border bg-card p-4 transition-colors hover:border-primary/40">
              <p className="font-medium">{c.title}</p>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{c.description}</p>
            </Link>
          ))}
        </div>
        <div className="mt-6 text-center"><Button variant="outline" asChild><Link href="/calculators">All calculators <ArrowRight /></Link></Button></div>
      </section>
      <Audiences />
      {posts.length > 0 && (
        <section className="container-page py-20">
          <SectionHeading eyebrow="Learn" title="From the blog" />
          <div className="grid gap-4 md:grid-cols-3">
            {posts.map((p) => (
              <Card key={p.slug} className="flex flex-col p-6">
                <p className="text-xs font-medium uppercase tracking-wide text-primary">{p.category?.name}</p>
                <h3 className="mt-2 font-semibold leading-snug"><Link href={`/blog/${p.slug}`} className="hover:text-primary">{p.title}</Link></h3>
                <p className="mt-2 line-clamp-3 flex-1 text-sm text-muted-foreground">{p.excerpt}</p>
                <p className="mt-4 text-xs text-muted-foreground">{formatDate(p.publishedAt)} · {p.readingMinutes} min read</p>
              </Card>
            ))}
          </div>
        </section>
      )}
      <div className="container-page max-w-3xl">
        <FaqSection faqs={faqs.length ? faqs : DEFAULT_FAQS} />
      </div>
      <CtaBanner />
      <JsonLd data={softwareAppSchema()} />
    </>
  );
}
