import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { JsonLd } from "./json-ld";
import { MathText } from "@/components/math/tex";

export function FaqSection({ faqs, title = "Frequently asked questions", schema = true }: { faqs: { q: string; a: string }[]; title?: string; schema?: boolean }) {
  if (!faqs.length) return null;
  return (
    <section className="mt-12" aria-labelledby="faq-heading">
      <h2 id="faq-heading" className="mb-2 text-2xl font-semibold tracking-tight">{title}</h2>
      <Accordion type="multiple" className="rounded-xl border bg-card px-5">
        {faqs.map((f, i) => (
          <AccordionItem key={i} value={`faq-${i}`}>
            <AccordionTrigger>{f.q}</AccordionTrigger>
            <AccordionContent>
              <MathText text={f.a} />
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
      {schema && (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a.replace(/\$/g, "") } })),
          }}
        />
      )}
    </section>
  );
}
