import Link from "next/link";
import { Logo } from "./logo";
import { siteConfig, solverPages } from "@/lib/site";

const columns = [
  { title: "Solvers", links: solverPages.map((s) => ({ href: s.href, label: s.title })) },
  {
    title: "Popular calculators",
    links: [
      { href: "/calculators/derivative-calculator", label: "Derivative Calculator" },
      { href: "/calculators/integral-calculator", label: "Integral Calculator" },
      { href: "/calculators/quadratic-formula-calculator", label: "Quadratic Formula" },
      { href: "/calculators/fraction-calculator", label: "Fraction Calculator" },
      { href: "/graphing-calculator", label: "Graphing Calculator" },
      { href: "/calculators", label: "All calculators →" },
    ],
  },
  {
    title: "Learn",
    links: [
      { href: "/tutor", label: "AI Math Tutor" },
      { href: "/practice", label: "Practice & Quizzes" },
      { href: "/math-formulas", label: "Formula Library" },
      { href: "/blog", label: "Blog" },
      { href: "/math-tools", label: "All Math Tools" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/pricing", label: "Pricing" },
      { href: "/about", label: "About" },
      { href: "/faq", label: "FAQ" },
      { href: "/privacy-policy", label: "Privacy Policy" },
      { href: "/terms-of-service", label: "Terms of Service" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t bg-muted/30">
      <div className="container-page grid gap-10 py-14 md:grid-cols-6">
        <div className="md:col-span-2">
          <Logo />
          <p className="mt-4 max-w-xs text-sm text-muted-foreground">{siteConfig.tagline}. Exact answers from a real math engine, explained by AI.</p>
        </div>
        {columns.map((c) => (
          <div key={c.title}>
            <h2 className="text-sm font-semibold">{c.title}</h2>
            <ul className="mt-3 space-y-2">
              {c.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t">
        <div className="container-page flex flex-col items-center justify-between gap-2 py-6 text-xs text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} {siteConfig.name}. All rights reserved.</p>
          <p>Made for students, teachers and lifelong learners worldwide.</p>
        </div>
      </div>
    </footer>
  );
}
