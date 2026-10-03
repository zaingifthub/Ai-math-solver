import { Suspense } from "react";
import { SolverWorkspace } from "@/components/solver/solver-workspace";
import { Skeleton } from "@/components/ui/misc";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Math Solver — Step-by-Step Solutions",
  description: "Enter any math problem to get a verified answer with step-by-step working, formulas used, an AI explanation and a graph.",
  path: "/solver",
});

export default function SolverPage() {
  return (
    <div className="container-page max-w-4xl py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Math Solver</h1>
      <p className="mt-2 text-muted-foreground">Type, paste LaTeX, use the math keyboard or upload a photo. Press <kbd className="rounded border bg-muted px-1.5 text-xs">Enter</kbd> to solve.</p>
      <div className="mt-6">
        <Suspense fallback={<Skeleton className="h-48 w-full rounded-2xl" />}>
          <SolverWorkspace autoFocus />
        </Suspense>
      </div>
    </div>
  );
}
