import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden>
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6366f1" />
          <stop offset="1" stopColor="#0ea5e9" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#lg)" />
      <path d="M8 21.5c2.2 0 3.1-1.4 4-4.5l1.2-4.2c.7-2.4 1.6-3.8 3.8-3.8" stroke="white" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <path d="M17.5 16h7M21 12.5v7" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("flex items-center gap-2 font-semibold tracking-tight", className)} aria-label="AI Math Solver home">
      <LogoMark />
      <span className="text-[17px]">
        AI Math <span className="text-primary">Solver</span>
      </span>
    </Link>
  );
}
