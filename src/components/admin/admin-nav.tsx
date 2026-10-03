"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Users, FileText, FolderTree, BookOpen, Calculator, HelpCircle, Search, Settings, CreditCard, Cpu, ScrollText, Files, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

const GROUPS = [
  { title: "Overview", items: [{ href: "/admin", label: "Analytics", icon: BarChart3 }] },
  { title: "Users & revenue", admin: true, items: [{ href: "/admin/users", label: "Users", icon: Users }, { href: "/admin/subscriptions", label: "Subscriptions", icon: CreditCard }, { href: "/admin/ai-usage", label: "AI usage", icon: Cpu }] },
  {
    title: "Content",
    items: [
      { href: "/admin/content/posts", label: "Blog posts", icon: FileText },
      { href: "/admin/content/categories", label: "Categories", icon: FolderTree },
      { href: "/admin/content/pages", label: "Pages & resources", icon: Files },
      { href: "/admin/content/formulas", label: "Formulas", icon: BookOpen },
      { href: "/admin/content/calculators", label: "Calculators", icon: Calculator },
      { href: "/admin/content/faqs", label: "FAQs", icon: HelpCircle },
    ],
  },
  { title: "System", admin: true, items: [{ href: "/admin/content/seo", label: "SEO overrides", icon: Search }, { href: "/admin/content/settings", label: "Settings", icon: Settings }, { href: "/admin/audit", label: "Audit log", icon: ScrollText }] },
];

export function AdminNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  return (
    <nav className="space-y-6" aria-label="Admin">
      {GROUPS.filter((g) => !g.admin || isAdmin).map((g) => (
        <div key={g.title}>
          <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{g.title}</p>
          <ul className="space-y-0.5">
            {g.items.map((i) => {
              const active = i.href === "/admin" ? pathname === "/admin" : pathname.startsWith(i.href);
              return (
                <li key={i.href}>
                  <Link href={i.href} className={cn("flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium", active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
                    <i.icon className="size-4" /> {i.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      <Link href="/dashboard" className="flex items-center gap-2 px-3 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Back to app</Link>
    </nav>
  );
}
