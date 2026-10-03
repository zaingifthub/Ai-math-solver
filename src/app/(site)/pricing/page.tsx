import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { FaqSection } from "@/components/seo/faq-section";
import { JsonLd } from "@/components/seo/json-ld";
import { PricingTable } from "@/components/marketing/pricing-table";
import { buildMetadata } from "@/lib/seo";
import { getFaqs } from "@/lib/cms";
import { PLANS } from "@/lib/plans";
import { features } from "@/lib/env";

export const revalidate = 3600;
export const metadata = buildMetadata({ title: "Pricing — Free, Premium & Education Plans", description: "Start free with verified step-by-step solutions. Upgrade to Premium for unlimited AI explanations, tutoring and photo scans, or Education for classrooms.", path: "/pricing" });

export default async function PricingPage() {
  const faqs = await getFaqs("pricing");
  return (
    <div className="container-page py-10">
      <Breadcrumbs items={[{ name: "Pricing", href: "/pricing" }]} />
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Simple, student-friendly pricing</h1>
        <p className="mt-4 text-lg text-muted-foreground">Verified math help is free every day. Upgrade when you want unlimited AI tutoring.</p>
      </div>
      <div className="mt-12">
        <PricingTable billingEnabled={features.stripe} />
      </div>
      <div className="mx-auto max-w-3xl">
        <FaqSection faqs={faqs.length ? faqs : [{ q: "Can I cancel anytime?", a: "Yes, cancel from your billing page and keep access until the end of the period." }]} />
      </div>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Product",
          name: "AI Math Solver",
          description: "Step-by-step math solver with AI tutor",
          offers: PLANS.map((p) => ({ "@type": "Offer", name: p.name, price: p.monthly.toFixed(2), priceCurrency: "USD" })),
        }}
      />
    </div>
  );
}
