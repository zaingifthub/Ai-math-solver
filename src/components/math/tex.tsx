import katex from "katex";
import { cn } from "@/lib/utils";

/** Renders LaTeX with KaTeX. Works in server and client components. trust:false prevents \href/\url injection. */
export function Tex({ tex, display = false, className }: { tex: string; display?: boolean; className?: string }) {
  let html: string;
  try {
    html = katex.renderToString(tex, { displayMode: display, throwOnError: false, trust: false, strict: "ignore", output: "html" });
  } catch {
    html = tex.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
  }
  return <span className={cn(display ? "block" : "inline", className)} dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Plain text with $inline$ math and **bold** segments. */
export function MathText({ text, className }: { text: string; className?: string }) {
  const parts = text.split(/(\$[^$]+\$|\*\*[^*]+\*\*)/g).filter(Boolean);
  return (
    <span className={className}>
      {parts.map((p, i) =>
        p.startsWith("$") && p.endsWith("$") && p.length > 2 ? (
          <Tex key={i} tex={p.slice(1, -1)} />
        ) : p.startsWith("**") && p.endsWith("**") ? (
          <strong key={i}>{p.slice(2, -2)}</strong>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </span>
  );
}
