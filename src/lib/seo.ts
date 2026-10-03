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

/** Builds complete metadata: canonical URL, Open Graph, Twitter card and robots directives. */
export function buildMetadata(i: SeoInput): Metadata {
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
