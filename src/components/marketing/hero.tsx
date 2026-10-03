import { Suspense } from "react";
import { ShieldCheck, Sparkles, Zap } from "lucide-react";
import { SolverWorkspace } from "@/components/solver/solver-workspace";
import { Skeleton } from "@/components/ui/misc";

export function Hero({ eyebrow, title, highlight, description, examples, h1 = true }: { eyebrow: string; title: string; highlight?: string; description: string; examples?: string[]; h1?: boolean }) {
  const Heading = h1 ? "h1" : "h2";
  return (
    <section className="relative overflow-hidden border-b">
      <div className="bg-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" aria-hidden />
      <div className="absolute left-1/2 top-0 -z-10 h-[500px] w-[900px] -translate-x-1/2 rounded-full bg-gradient-to-br from-primary/20 via-violet-400/10 to-sky-400/20 blur-3xl" aria-hidden />
      <div className="container-page relative pb-16 pt-14 sm:pt-20">
        <div className="mx-auto max-w-3xl text-center">
          <p className="inline-flex items-center gap-2 rounded-full border bg-card/80 px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur">
            <Sparkles className="size-3.5 text-primary" /> {eyebrow}
          </p>
          <Heading className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
            {title} {highlight && <span className="text-gradient">{highlight}</span>}
          </Heading>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">{description}</p>
        </div>
        <div className="mx-auto mt-10 max-w-4xl">
          <Suspense fallback={<Skeleton className="h-48 w-full rounded-2xl" />}>
            <SolverWorkspace examples={examples} compact />
          </Suspense>
        </div>
        <ul className="mx-auto mt-8 flex max-w-3xl flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-muted-foreground">
          <li className="flex items-center gap-2"><ShieldCheck className="size-4 text-success" /> Every answer independently verified</li>
          <li className="flex items-center gap-2"><Zap className="size-4 text-amber-500" /> Results in milliseconds</li>
          <li className="flex items-center gap-2"><Sparkles className="size-4 text-primary" /> AI explanations at your level</li>
        </ul>
      </div>
    </section>
  );
}
