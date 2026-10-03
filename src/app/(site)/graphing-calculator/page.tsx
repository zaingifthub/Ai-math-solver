import { GraphingCalculator } from "@/components/calculators/graphing-calculator";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { FaqSection } from "@/components/seo/faq-section";
import { JsonLd } from "@/components/seo/json-ld";
import { buildMetadata } from "@/lib/seo";
import { getCalculator } from "@/lib/calculators/registry";
import { absoluteUrl } from "@/lib/site";

export const metadata = buildMetadata({
  title: "Free Online Graphing Calculator — Plot Functions, Roots & Intersections",
  description: "Graph multiple functions online for free. Zoom, pan, and automatically find roots and intersection points. Works on phones, tablets and desktops.",
  path: "/graphing-calculator",
  keywords: ["graphing calculator", "online graphing calculator", "function plotter"],
});

export default function GraphingPage() {
  const def = getCalculator("graphing-calculator")!;
  return (
    <div className="container-page py-10">
      <Breadcrumbs items={[{ name: "Calculators", href: "/calculators" }, { name: "Graphing Calculator", href: "/graphing-calculator" }]} />
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Graphing Calculator</h1>
      <p className="mt-3 max-w-3xl text-lg text-muted-foreground">{def.intro}</p>
      <div className="mt-8">
        <GraphingCalculator />
      </div>
      <section className="mt-12 max-w-3xl">
        <h2 className="text-2xl font-semibold tracking-tight">How to use it</h2>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-muted-foreground">{def.howTo.map((h) => <li key={h}>{h}</li>)}</ol>
        <h2 className="mt-10 text-2xl font-semibold tracking-tight">Supported functions</h2>
        <p className="mt-3 text-muted-foreground">Polynomials (x^3 - 2x), rational functions (1/(x - 1)), roots (sqrt(x), cbrt(x)), exponentials and logs (e^x, ln(x), log(x)), trig and inverse trig (sin, cos, tan, asin…), hyperbolic functions, abs(x) and constants pi and e.</p>
        <FaqSection faqs={def.faqs} />
      </section>
      <JsonLd data={{ "@context": "https://schema.org", "@type": "WebApplication", name: "Graphing Calculator", url: absoluteUrl("/graphing-calculator"), applicationCategory: "EducationalApplication", operatingSystem: "Any", offers: { "@type": "Offer", price: "0", priceCurrency: "USD" } }} />
    </div>
  );
}
