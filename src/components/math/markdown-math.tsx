"use client";
import { useMemo } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import katex from "katex";
import { cn } from "@/lib/utils";

/** Client-side Markdown + LaTeX renderer for AI output (sanitized with DOMPurify; math inserted after sanitizing). */
export function MarkdownMath({ source, className }: { source: string; className?: string }) {
  const html = useMemo(() => {
    const math: string[] = [];
    const stash = (tex: string, display: boolean) => {
      math.push(katex.renderToString(tex, { displayMode: display, throwOnError: false, trust: false, strict: "ignore" }));
      return `@@M${math.length - 1}@@`;
    };
    let text = source
      .replace(/\\\[([\s\S]+?)\\\]/g, (_m, t) => `$$${t}$$`)
      .replace(/\\\(([\s\S]+?)\\\)/g, (_m, t) => `$${t}$`);
    text = text.replace(/\$\$([\s\S]+?)\$\$/g, (_m, t) => `\n\n${stash(t.trim(), true)}\n\n`);
    text = text.replace(/(^|[^\\$])\$([^\n$]+?)\$/g, (_m, pre, t) => `${pre}${stash(t, false)}`);
    const raw = marked.parse(text, { async: false, gfm: true, breaks: true }) as string;
    const clean = typeof window === "undefined" ? raw.replace(/<[^>]*>/g, "") : DOMPurify.sanitize(raw, { USE_PROFILES: { html: true }, FORBID_TAGS: ["style", "form", "input", "iframe"], FORBID_ATTR: ["style", "onerror", "onclick"] });
    return clean.replace(/@@M(\d+)@@/g, (_m, i) => math[Number(i)] ?? "");
  }, [source]);
  return <div className={cn("prose-math text-[15px] leading-relaxed", className)} dangerouslySetInnerHTML={{ __html: html }} />;
}
