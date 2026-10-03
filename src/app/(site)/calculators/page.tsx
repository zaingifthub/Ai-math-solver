import Link from "next/link";
import * as Icons from "lucide-react";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { JsonLd } from "@/components/seo/json-ld";
import { buildMetadata } from "@/lib/seo";
import { getEnabledCalculators } from "@/lib/cms";
import { CATEGORY_LABELS, type CalcCategory } from "@/lib/calculators/types";
import { absoluteUrl } from "@/lib/site";

export const revalidate = 3600;

export const metadata = buildMetadata({
  title: "Free Math Calculators with Steps — 30+ Online Tools",
  description: "30+ free math calculators with step-by-step solutions: derivatives, integrals, quadratics, matrices, fractions, statistics, geometry and graphing.",
  path: "/calculators",
});

export default async function CalculatorsPage() {
  const calcs = await getEnabledCalculators();
  const groups = Object.entries(CATEGORY_LABELS)
    .map(([cat, label]) => ({ cat: cat as CalcCategory, label, items: calcs.filter((c) => c.category === cat) }))
    .filter((g) => g.items.length);
  return (
    <div className="container-page py-10">
      <Breadcrumbs items={[{ name: "Calculators", href: "/calculators" }]} />
      <h1 className="text-4xl font-semibold tracking-tight">Math Calculators</h1>
      <p className="mt-3 max-w-2xl text-lg text-muted-foreground">{calcs.length} free calculators that show their work. Engine-backed tools give full step-by-step solutions with verification.</p>
      <nav className="mt-6 flex flex-wrap gap-2" aria-label="Calculator categories">
        {groups.map((g) => <a key={g.cat} href={`#${g.cat}`} className="rounded-full border px-3 py-1 text-sm hover:bg-muted">{g.label}</a>)}
      </nav>
      {groups.map((g) => (
        <section key={g.cat} id={g.cat} className="mt-12 scroll-mt-24">
          <h2 className="mb-4 text-2xl font-semibold tracking-tight">{g.label}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {g.items.map((c) => {
              const Icon = ((Icons as unknown as Record<string, Icons.LucideIcon>)[c.icon] ?? Icons.Calculator) as Icons.LucideIcon;
              return (
                <Link key={c.slug} href={c.kind === "graph" ? "/graphing-calculator" : `/calculators/${c.slug}`} className="group flex gap-4 rounded-xl border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-sm">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="size-5" /></span>
                  <span>
                    <span className="font-medium group-hover:text-primary">{c.title}</span>
                    <span className="mt-1 line-clamp-2 block text-sm text-muted-foreground">{c.description}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
      <JsonLd data={{ "@context": "https://schema.org", "@type": "ItemList", name: "Math calculators", itemListElement: calcs.map((c, i) => ({ "@type": "ListItem", position: i + 1, url: absoluteUrl(c.kind === "graph" ? "/graphing-calculator" : `/calculators/${c.slug}`), name: c.title })) }} />
    </div>
  );
}
