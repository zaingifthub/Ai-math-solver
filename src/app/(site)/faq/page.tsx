import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { FaqSection } from "@/components/seo/faq-section";
import { buildMetadata } from "@/lib/seo";
import { getFaqs } from "@/lib/cms";

export const revalidate = 3600;
export const metadata = buildMetadata({ title: "Frequently Asked Questions", description: "Answers to common questions about AI Math Solver: accuracy, supported topics, photo scanning, plans and privacy.", path: "/faq" });

export default async function FaqPage() {
  const [general, pricing] = await Promise.all([getFaqs("global"), getFaqs("pricing")]);
  return (
    <div className="container-page max-w-3xl py-10">
      <Breadcrumbs items={[{ name: "FAQ", href: "/faq" }]} />
      <h1 className="text-4xl font-semibold tracking-tight">Frequently asked questions</h1>
      <FaqSection faqs={[...general, ...pricing]} title="General & billing" />
      {general.length + pricing.length === 0 && <p className="mt-6 text-muted-foreground">FAQs are being updated.</p>}
    </div>
  );
}
