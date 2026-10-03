import { Suspense } from "react";
import { TutorChat } from "@/components/tutor/tutor-chat";
import { Skeleton } from "@/components/ui/misc";
import { buildMetadata } from "@/lib/seo";
import { features } from "@/lib/env";

export const metadata = buildMetadata({
  title: "AI Math Tutor — Explanations, Hints & Practice",
  description: "An AI math tutor that explains steps, gives hints without spoilers, shows other methods and checks your work — every calculation verified.",
  path: "/tutor",
});

export default function TutorPage() {
  return (
    <div className="container-page py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">AI Math Tutor</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">Explanations, hints, alternative methods and practice — tailored to your level. Every calculation is checked by the verified math engine.</p>
      </div>
      {!features.ai && <p className="mb-4 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">The AI tutor is not configured on this server yet (missing ANTHROPIC_API_KEY).</p>}
      <Suspense fallback={<Skeleton className="h-[70vh] w-full rounded-2xl" />}>
        <TutorChat />
      </Suspense>
    </div>
  );
}
