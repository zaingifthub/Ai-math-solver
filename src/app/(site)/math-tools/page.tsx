import Link from "next/link";
import { Calculator, MessageCircle, LineChart, BookOpen, Target, Camera, Sigma, FileText } from "lucide-react";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { buildMetadata } from "@/lib/seo";
import { solverPages } from "@/lib/site";
import { getEnabledCalculators } from "@/lib/cms";

export const revalidate = 3600;

export const metadata = buildMetadata({
  title: "Math Tools — Solvers, Calculators, Graphing, Formulas & Practice",
  description: "Every free math tool in one place: AI math solver, photo math scanner, AI tutor, 30+ step-by-step calculators, graphing calculator, formula library and practice quizzes.",
  path: "/math-tools",
});

const CORE = [
  { href: "/solver", title: "Math Solver", desc: "Any problem, step by step, verified.", icon: Sigma },
  { href: "/solver", title: "Photo Math Scanner", desc: "Upload or snap a photo of your homework.", icon: Camera },
  { href: "/tutor", title: "AI Math Tutor", desc: "Ask questions, get hints, learn concepts.", icon: MessageCircle },
  { href: "/graphing-calculator", title: "Graphing Calculator", desc: "Plot functions, roots and intersections.", icon: LineChart },
  { href: "/math-formulas", title: "Formula Library", desc: "Formulas with variables, examples and FAQs.", icon: BookOpen },
  { href: "/practice", title: "Practice & Quizzes", desc: "Unlimited problems with instant feedback.", icon: Target },
  { href: "/calculators", title: "Calculator Library", desc: "30+ dedicated calculators.", icon: Calculator },
  { href: "/blog", title: "Math Blog", desc: "Guides, explanations and study tips.", icon: FileText },
];

export default async function MathToolsPage() {
  const calcs = await getEnabledCalculators();
  return (
    <div className="container-page py-10">
      <Breadcrumbs items={[{ name: "Math Tools", href: "/math-tools" }]} />
      <h1 className="text-4xl font-semibold tracking-tight">Math Tools</h1>
      <p className="mt-3 max-w-2xl text-lg text-muted-foreground">Everything you need to solve, understand and practice math — free.</p>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {CORE.map((t) => (
          <Link key={t.title} href={t.href} className="rounded-2xl border bg-card p-6 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm">
            <t.icon className="size-6 text-primary" />
            <h2 className="mt-3 font-semibold">{t.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t.desc}</p>
          </Link>
        ))}
      </div>
      <h2 className="mt-14 text-2xl font-semibold tracking-tight">Solvers by subject</h2>
      <div className="mt-4 flex flex-wrap gap-2">
        {solverPages.map((s) => <Link key={s.href} href={s.href} className="rounded-full border bg-card px-4 py-2 text-sm hover:border-primary/40">{s.title}</Link>)}
      </div>
      <h2 className="mt-14 text-2xl font-semibold tracking-tight">All calculators</h2>
      <ul className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
        {calcs.map((c) => <li key={c.slug}><Link href={c.kind === "graph" ? "/graphing-calculator" : `/calculators/${c.slug}`} className="text-sm text-muted-foreground hover:text-primary">{c.title}</Link></li>)}
      </ul>
    </div>
  );
}
