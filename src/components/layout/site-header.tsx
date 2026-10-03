"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { Menu, X, LayoutDashboard, LogOut, Shield, Settings, History, Sparkles } from "lucide-react";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { mainNav } from "@/lib/site";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const user = session?.user;
  const isActive = (href: string) => pathname === href || (href !== "/" && pathname.startsWith(href));

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-lg supports-[backdrop-filter]:bg-background/70">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-8">
          <Logo />
          <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
            {mainNav.map((n) => (
              <Link key={n.href} href={n.href} className={cn("rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground", isActive(n.href) && "text-foreground")}>
                {n.title}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {status === "loading" ? (
            <div className="size-8 animate-pulse rounded-full bg-muted" />
          ) : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Account menu">
                <Avatar src={user.image} name={user.name ?? user.email} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <p className="truncate">{user.name ?? "Student"}</p>
                  <p className="truncate text-xs font-normal text-muted-foreground">{user.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild><Link href="/dashboard"><LayoutDashboard /> Dashboard</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link href="/dashboard/history"><History /> History</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link href="/dashboard/settings"><Settings /> Settings</Link></DropdownMenuItem>
                {user.plan === "FREE" && <DropdownMenuItem asChild><Link href="/pricing" className="text-primary"><Sparkles /> Upgrade to Premium</Link></DropdownMenuItem>}
                {user.role !== "USER" && <DropdownMenuItem asChild><Link href="/admin"><Shield /> Admin panel</Link></DropdownMenuItem>}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => signOut({ callbackUrl: "/" })}><LogOut /> Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <Button variant="ghost" size="sm" asChild><Link href="/login">Log in</Link></Button>
              <Button size="sm" asChild><Link href="/register">Sign up free</Link></Button>
            </div>
          )}
          <Button variant="ghost" size="icon-sm" className="lg:hidden" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            {open ? <X /> : <Menu />}
          </Button>
        </div>
      </div>
      {open && (
        <nav className="border-t bg-background lg:hidden" aria-label="Mobile">
          <div className="container-page grid gap-1 py-3">
            {mainNav.map((n) => (
              <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className={cn("rounded-md px-3 py-2.5 text-sm font-medium", isActive(n.href) ? "bg-muted" : "hover:bg-muted")}>
                {n.title}
              </Link>
            ))}
            {!user && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Button variant="outline" asChild><Link href="/login" onClick={() => setOpen(false)}>Log in</Link></Button>
                <Button asChild><Link href="/register" onClick={() => setOpen(false)}>Sign up free</Link></Button>
              </div>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
