import Link from "next/link";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { buildMetadata } from "@/lib/seo";
import { getPublishedPages } from "@/lib/cms";

export const revalidate = 3600;
export const metadata = buildMetadata({ title: "Learning Resources", description: "Free math learning resources: study guides, worksheets and references.", path: "/resources" });

export default async function ResourcesPage() {
  const pages = (await getPublishedPages()).filter((p) => p.type === "RESOURCE");
  return (
    <div className="container-page py-10">
      <Breadcrumbs items={[{ name: "Resources", href: "/resources" }]} />
      <h1 className="text-4xl font-semibold tracking-tight">Learning Resources</h1>
      <p className="mt-3 max-w-2xl text-lg text-muted-foreground">Study guides and references curated by our team.</p>
      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {pages.map((p) => (
          <Link key={p.slug} href={`/resources/${p.slug}`} className="rounded-2xl border bg-card p-6 hover:border-primary/40">
            <h2 className="font-semibold">{p.title}</h2>
            {p.description && <p className="mt-2 text-sm text-muted-foreground">{p.description}</p>}
          </Link>
        ))}
      </div>
      {pages.length === 0 && <p className="mt-10 text-muted-foreground">Resources are coming soon. Meanwhile, explore the <Link href="/math-formulas" className="text-primary">formula library</Link> and <Link href="/blog" className="text-primary">blog</Link>.</p>}
    </div>
  );
}
