import Link from "next/link";
import { Logo } from "@/components/layout/logo";
import { ShieldCheck, Sparkles, LineChart } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main id="main" className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex flex-col px-4 py-8 sm:px-8">
        <Logo />
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-sm sm:p-8">{children}</div>
        </div>
        <p className="text-center text-xs text-muted-foreground"><Link href="/" className="hover:underline">← Back to home</Link></p>
      </div>
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-indigo-700 via-violet-700 to-sky-700 p-12 text-white lg:flex lg:flex-col lg:justify-center">
        <div className="bg-grid absolute inset-0 opacity-10" aria-hidden />
        <div className="relative max-w-md">
          <h2 className="text-3xl font-semibold tracking-tight">Understand math, don&apos;t just finish it.</h2>
          <ul className="mt-8 space-y-5 text-white/90">
            <li className="flex gap-3"><ShieldCheck className="size-5 shrink-0" /> Every answer computed and verified by a real math engine.</li>
            <li className="flex gap-3"><Sparkles className="size-5 shrink-0" /> An AI tutor that explains at your level and gives hints, not just answers.</li>
            <li className="flex gap-3"><LineChart className="size-5 shrink-0" /> Track progress by topic and focus on your weak areas.</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
