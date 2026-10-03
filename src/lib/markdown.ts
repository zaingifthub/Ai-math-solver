import { marked } from "marked";
import sanitizeHtml from "sanitize-html";
import katex from "katex";

/**
 * Render Markdown with $inline$ and $$display$$ LaTeX to safe HTML.
 * Math is rendered by KaTeX (trust disabled) and inserted after the Markdown
 * HTML has been sanitized, so user/CMS content cannot inject scripts.
 */
export function renderMarkdown(src: string): string {
  const math: string[] = [];
  const stash = (tex: string, display: boolean) => {
    let html: string;
    try {
      html = katex.renderToString(tex, { displayMode: display, throwOnError: false, trust: false, strict: "ignore", output: "html" });
    } catch {
      html = sanitizeHtml(tex);
    }
    math.push(html);
    return `@@MATH${math.length - 1}@@`;
  };
  let text = src.replace(/\$\$([\s\S]+?)\$\$/g, (_m, t) => `\n\n${stash(t.trim(), true)}\n\n`);
  text = text.replace(/(^|[^\\$])\$([^\n$]+?)\$/g, (_m, pre, t) => `${pre}${stash(t, false)}`);
  const html = marked.parse(text, { async: false, gfm: true, breaks: false }) as string;
  const clean = sanitizeHtml(html, {
    allowedTags: ["h1", "h2", "h3", "h4", "p", "a", "ul", "ol", "li", "strong", "em", "code", "pre", "blockquote", "table", "thead", "tbody", "tr", "th", "td", "hr", "br", "img", "del"],
    allowedAttributes: { a: ["href", "title", "rel", "target"], img: ["src", "alt", "title", "width", "height", "loading"], th: ["align"], td: ["align"] },
    allowedSchemes: ["http", "https", "mailto"],
    allowProtocolRelative: false,
    transformTags: {
      a: (tagName, attribs) => {
        const external = /^https?:\/\//.test(attribs.href ?? "");
        return { tagName, attribs: { ...attribs, ...(external ? { rel: "noopener noreferrer nofollow", target: "_blank" } : {}) } };
      },
      img: (tagName, attribs) => ({ tagName, attribs: { ...attribs, loading: "lazy" } }),
    },
  });
  return clean.replace(/@@MATH(\d+)@@/g, (_m, i) => math[Number(i)] ?? "");
}

export function stripMarkdown(src: string, max = 160): string {
  const t = src.replace(/\$\$?[^$]*\$\$?/g, "").replace(/[#*_`>[\]()|-]/g, "").replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}
