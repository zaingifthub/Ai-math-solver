import { redirect } from "next/navigation";
import { Logo } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { AdminNav } from "@/components/admin/admin-nav";
import { getCurrentUser, hasRole } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin", robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?callbackUrl=/admin");
  if (!hasRole(user.role, "EDITOR")) redirect("/dashboard");
  return (
    <div className="min-h-dvh bg-muted/20">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/90 px-4 backdrop-blur">
        <div className="flex items-center gap-3"><Logo /><span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">Admin</span></div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground"><span className="hidden sm:inline">{user.email} · {user.role}</span><ThemeToggle /></div>
      </header>
      <div className="grid lg:grid-cols-[240px_1fr]">
        <aside className="border-b p-4 lg:sticky lg:top-14 lg:h-[calc(100dvh-3.5rem)] lg:overflow-y-auto lg:border-b-0 lg:border-r"><AdminNav isAdmin={hasRole(user.role, "ADMIN")} /></aside>
        <main id="main" className="min-w-0 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
