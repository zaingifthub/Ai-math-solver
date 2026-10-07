import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site";
import { isIndexingDisabled } from "@/lib/indexing";

export default function robots(): MetadataRoute.Robots {
  if (isIndexingDisabled()) return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/admin", "/dashboard", "/login", "/register", "/forgot-password", "/reset-password"] }],
    sitemap: `${siteConfig.url}/sitemap.xml`,
    host: siteConfig.url,
  };
}
