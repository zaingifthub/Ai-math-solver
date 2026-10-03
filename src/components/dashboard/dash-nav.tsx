"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, History, Bookmark, LineChart, MessageCircle, CreditCard, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/history", label: "History", icon: History },
  { href: "/dashboard/saved", label: "Saved", icon: Bookmark },
  { href: "/dashboard/progress", label: "Progress", icon: LineChart },
  { href: "/tutor", label: "Tutor chats", icon: MessageCircle },
  { href: "/dashboard/billing", label: "Plan & billing", icon: CreditCard },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function DashNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0" aria-label="Dashboard">
      {ITEMS.map((i) => {
        const active = i.href === "/dashboard" ? pathname === i.href : pathname.startsWith(i.href);
        return (
          <Link key={i.href} href={i.href} className={cn("flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors", active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
            <i.icon className="size-4" /> {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
