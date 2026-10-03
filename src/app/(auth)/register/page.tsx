import { Suspense } from "react";
import { RegisterForm } from "@/components/auth/auth-forms";
import { buildMetadata } from "@/lib/seo";
import { features } from "@/lib/env";

export const metadata = buildMetadata({ title: "Create your free account", description: "Sign up for AI Math Solver — free step-by-step solutions, an AI tutor and progress tracking.", path: "/register", noindex: true });

export default function RegisterPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Create your free account</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">More daily solutions, AI tutoring, history and progress tracking.</p>
      <Suspense>
        <RegisterForm googleEnabled={features.google} />
      </Suspense>
    </>
  );
}
