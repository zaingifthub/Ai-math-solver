import Link from "next/link";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { Tex } from "@/components/math/tex";
import { buildMetadata } from "@/lib/seo";
import { getFormulas } from "@/lib/cms";

export const revalidate = 3600;

export const metadata = buildMetadata({
  title: "Math Formulas — Algebra, Geometry, Trigonometry, Calculus & Statistics",
  description: "A complete math formula library with explanations, variables, worked examples and related calculators: quadratic formula, Pythagorean theorem, derivative rules, statistics formulas and more.",
  path: "/math-formulas",
});

export default async function FormulasPage() {
  const formulas = await getFormulas();
  const cats = [...new Set(formulas.map((f) => f.category))];
  return (
    <div className="container-page py-10">
      <Breadcrumbs items={[{ name: "Math Formulas", href: "/math-formulas" }]} />
      <h1 className="text-4xl font-semibold tracking-tight">Math Formula Library</h1>
      <p className="mt-3 max-w-2xl text-lg text-muted-foreground">{formulas.length} essential formulas, each with what every variable means, why it works, an example and a calculator to try it.</p>
      <nav className="mt-6 flex flex-wrap gap-2">
        {cats.map((c) => <a key={c} href={`#${c.toLowerCase().replace(/\s+/g, "-")}`} className="rounded-full border px-3 py-1 text-sm hover:bg-muted">{c}</a>)}
      </nav>
      {cats.map((c) => (
        <section key={c} id={c.toLowerCase().replace(/\s+/g, "-")} className="mt-12 scroll-mt-24">
          <h2 className="mb-4 text-2xl font-semibold tracking-tight">{c}</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {formulas.filter((f) => f.category === c).map((f) => (
              <Link key={f.slug} href={`/math-formulas/${f.slug}`} className="rounded-xl border bg-card p-5 transition-colors hover:border-primary/40">
                <h3 className="font-medium">{f.name}</h3>
                <div className="mt-2 overflow-x-auto"><Tex tex={f.latex} display /></div>
                <p className="mt-1 text-sm text-muted-foreground">{f.summary}</p>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
