import Link from "next/link";
import { ForgotForm } from "@/components/auth/reset-forms";
import { buildMetadata } from "@/lib/seo";
import { emailEnabled } from "@/lib/email";

export const metadata = buildMetadata({ title: "Forgot password", description: "Reset your AI Math Solver password.", path: "/forgot-password", noindex: true });

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Forgot your password?</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">Enter your email and we&apos;ll send you a link to reset it.</p>
      {!emailEnabled() && <p className="mb-4 rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs">Email delivery is not configured on this server yet, so reset links can&apos;t be sent. Please contact support.</p>}
      <ForgotForm />
      <p className="mt-6 text-center text-sm text-muted-foreground"><Link href="/login" className="font-medium text-primary hover:underline">Back to log in</Link></p>
    </>
  );
}
