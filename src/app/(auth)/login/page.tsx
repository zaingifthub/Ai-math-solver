import { Suspense } from "react";
import { LoginForm } from "@/components/auth/auth-forms";
import { buildMetadata } from "@/lib/seo";
import { features } from "@/lib/env";

export const metadata = buildMetadata({ title: "Log in", description: "Log in to AI Math Solver.", path: "/login", noindex: true });

export default function LoginPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">Log in to see your history, progress and saved problems.</p>
      <Suspense>
        <LoginForm googleEnabled={features.google} />
      </Suspense>
    </>
  );
}
