import Link from "next/link";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="container-page flex min-h-[60vh] flex-col items-center justify-center py-24 text-center">
        <p className="font-mono text-sm text-primary">404</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">This page doesn&apos;t add up</h1>
        <p className="mt-3 max-w-md text-muted-foreground">The page you&apos;re looking for doesn&apos;t exist or has moved. Try the solver or browse our calculators.</p>
        <div className="mt-6 flex gap-3">
          <Button asChild><Link href="/solver">Open the solver</Link></Button>
          <Button variant="outline" asChild><Link href="/calculators">Browse calculators</Link></Button>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
