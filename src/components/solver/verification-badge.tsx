"use client";
import { useState } from "react";
import { ShieldCheck, ShieldAlert, ShieldQuestion, Check, X, ChevronDown } from "lucide-react";
import type { Verification } from "@/lib/math/types";
import { cn } from "@/lib/utils";

export function VerificationBadge({ verification }: { verification: Verification }) {
  const [open, setOpen] = useState(false);
  const cfg = {
    verified: { icon: ShieldCheck, label: "Verified", cls: "bg-success/12 text-success border-success/25" },
    "partially-verified": { icon: ShieldAlert, label: "Partially verified", cls: "bg-warning/15 text-amber-700 dark:text-amber-300 border-warning/30" },
    unverified: { icon: ShieldQuestion, label: "Not independently verified", cls: "bg-muted text-muted-foreground border-border" },
  }[verification.status];
  const Icon = cfg.icon;
  return (
    <div>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className={cn("inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium", cfg.cls)}>
        <Icon className="size-3.5" />
        {cfg.label}
        {verification.checks.length > 0 && <ChevronDown className={cn("size-3 transition-transform", open && "rotate-180")} />}
      </button>
      {open && verification.checks.length > 0 && (
        <ul className="mt-2 space-y-1 rounded-lg border bg-muted/30 p-3 text-xs">
          {verification.checks.map((c, i) => (
            <li key={i} className="flex items-start gap-2">
              {c.passed ? <Check className="mt-0.5 size-3.5 shrink-0 text-success" /> : <X className="mt-0.5 size-3.5 shrink-0 text-destructive" />}
              <span>
                {c.label}
                {c.detail && <span className="text-muted-foreground"> — {c.detail}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
