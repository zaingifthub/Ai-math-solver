export const siteConfig = {
  name: process.env.NEXT_PUBLIC_SITE_NAME || "AI Math Solver",
  url: (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, ""),
  description:
    "AI Math Solver gives verified step-by-step solutions for algebra, calculus, geometry, statistics and more — with an AI tutor, photo math scanner, graphing and 20+ free calculators.",
  tagline: "Verified step-by-step math solutions with an AI tutor",
  twitter: "@aimathsolver",
  locale: "en_US",
};

export const mainNav = [
  { title: "Solver", href: "/solver" },
  { title: "AI Tutor", href: "/tutor" },
  { title: "Calculators", href: "/calculators" },
  { title: "Graphing", href: "/graphing-calculator" },
  { title: "Formulas", href: "/math-formulas" },
  { title: "Practice", href: "/practice" },
  { title: "Blog", href: "/blog" },
  { title: "Pricing", href: "/pricing" },
];

export const solverPages = [
  { href: "/ai-math-solver", title: "AI Math Solver" },
  { href: "/math-solver", title: "Math Solver" },
  { href: "/algebra-solver", title: "Algebra Solver" },
  { href: "/calculus-solver", title: "Calculus Solver" },
  { href: "/geometry-solver", title: "Geometry Solver" },
  { href: "/statistics-solver", title: "Statistics Solver" },
];

export function absoluteUrl(path = "/") {
  return `${siteConfig.url}${path.startsWith("/") ? path : `/${path}`}`;
}
