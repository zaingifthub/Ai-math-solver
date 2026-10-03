"use client";
import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cn } from "@/lib/utils";

export function Avatar({ src, name, className }: { src?: string | null; name?: string | null; className?: string }) {
  const initials = (name ?? "?").split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return (
    <AvatarPrimitive.Root className={cn("relative flex size-8 shrink-0 overflow-hidden rounded-full", className)}>
      {src ? <AvatarPrimitive.Image src={src} alt={name ?? "Avatar"} className="aspect-square size-full" referrerPolicy="no-referrer" /> : null}
      <AvatarPrimitive.Fallback className="flex size-full items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">{initials}</AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}
