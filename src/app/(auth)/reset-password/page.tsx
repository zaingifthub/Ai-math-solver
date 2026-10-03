import { Suspense } from "react";
import { ResetForm } from "@/components/auth/reset-forms";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({ title: "Reset password", description: "Choose a new password.", path: "/reset-password", noindex: true });

export default function ResetPasswordPage() {
  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Choose a new password</h1>
      <Suspense>
        <ResetForm />
      </Suspense>
    </>
  );
}
