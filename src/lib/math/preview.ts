/** Client-side live preview of what the user typed (LaTeX). Loaded lazily to keep the main bundle small. */
import { normalizeText, parseExpr, splitRelation } from "./normalize";
import { toTex } from "./mathjs";

const REL_TEX: Record<string, string> = { "=": "=", "<": "<", ">": ">", "<=": "\\le", ">=": "\\ge", "!=": "\\ne" };

export function previewTex(input: string): string | null {
  const s = normalizeText(input);
  if (!s) return null;
  try {
    let stripped = s
      .replace(/^(solve|simplify|factor|expand|evaluate|find|calculate|compute|what is)\s*:?\s*/i, "")
      .replace(/^(the\s+)?((second|third|partial)\s+)?(derivative|integral|antiderivative|limit|integrate|differentiate|domain|inverse|vertex|zeros|roots)\s+(of\s+)?/i, "")
      .replace(/\s+(with respect to|wrt)\s+[a-z]\s*$/i, "")
      .replace(/\s+d[a-z]\s*$/, "")
      .replace(/,?\s*solve for [a-z]\s*$/i, "");
    // Skip previews for prose (word problems, unit conversions, commands with arguments)
    const words = (stripped.match(/[a-zA-Z]{3,}/g) ?? []).filter((w) => !/^(sin|cos|tan|sec|csc|cot|asin|acos|atan|sinh|cosh|tanh|log|log10|sqrt|cbrt|exp|abs|pi|theta|nthRoot|alpha|beta|lambda|sigma|Infinity)$/i.test(w));
    if (words.length > 0 || /\[\[|<\d/.test(stripped)) return null;
    stripped = stripped.trim();
    const parts = stripped.split(/;/).map((p) => p.trim()).filter(Boolean);
    const texParts = parts.map((p) => {
      const rel = splitRelation(p);
      if (rel) {
        const sides = [rel[0].lhs, ...rel.map((r) => r.rhs)].map((x) => toTex(parseExpr(x)));
        return sides.reduce((acc, side, i) => (i === 0 ? side : `${acc} ${REL_TEX[rel[i - 1].op]} ${side}`), "");
      }
      return toTex(parseExpr(p));
    });
    return texParts.length > 1 ? `\\begin{cases} ${texParts.join(" \\\\ ")} \\end{cases}` : texParts[0];
  } catch {
    return null;
  }
}
