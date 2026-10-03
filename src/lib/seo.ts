import type { Metadata } from "next";
import { siteConfig, absoluteUrl } from "./site";

interface SeoInput {
  title: string;
  description: string;
  path: string;
  image?: string;
  type?: "website" | "article";
  publishedTime?: string;
  modifiedTime?: string;
  noindex?: boolean;
  keywords?: string[];
  absoluteTitle?: boolean;
}

const SUFFIX = ` | ${siteConfig.name}`;
const MAX_TITLE = 65;
const MAX_DESC = 160;

/** Trim at a word boundary so search engines don't cut the snippet mid-word. */
export function clampText(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 20)).replace(/[\s,;:—-]+$/, "")}…`;
}

/** Builds complete metadata: canonical URL, Open Graph, Twitter card and robots directives. */
export function buildMetadata(input: SeoInput): Metadata {
  // Drop the brand suffix when it would push the title past ~65 characters (Google truncates around 60–70).
  const absolute = input.absoluteTitle || input.title.length + SUFFIX.length > MAX_TITLE;
  const i = { ...input, title: absolute ? clampText(input.title, 70) : input.title, description: clampText(input.description, MAX_DESC), absoluteTitle: absolute };
  const url = absoluteUrl(i.path);
  const image = i.image ?? absoluteUrl(`/og?title=${encodeURIComponent(i.title)}`);
  return {
    title: i.absoluteTitle ? { absolute: i.title } : i.title,
    description: i.description,
    keywords: i.keywords,
    alternates: { canonical: url },
    openGraph: {
      type: i.type ?? "website",
      url,
      title: i.title,
      description: i.description,
      siteName: siteConfig.name,
      locale: siteConfig.locale,
      images: [{ url: image, width: 1200, height: 630, alt: i.title }],
      ...(i.publishedTime ? { publishedTime: i.publishedTime, modifiedTime: i.modifiedTime } : {}),
    },
    twitter: { card: "summary_large_image", title: i.title, description: i.description, images: [image], site: siteConfig.twitter },
    robots: i.noindex ? { index: false, follow: true } : { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  };
}

export function softwareAppSchema(name = siteConfig.name, description = siteConfig.description, path = "/") {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name,
    description,
    url: absoluteUrl(path),
    applicationCategory: "EducationalApplication",
    operatingSystem: "Web, iOS, Android",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };
}
