import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteConfig.name,
    short_name: "Math Solver",
    description: siteConfig.description,
    start_url: "/solver",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#4f46e5",
    categories: ["education", "productivity"],
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
