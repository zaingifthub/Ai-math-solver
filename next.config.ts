import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";
const isHttps = (process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://");
const gaEnabled = Boolean(process.env.NEXT_PUBLIC_GA_ID);

const csp = [
  "default-src 'self'",
  // Next.js injects inline bootstrap scripts; nonces would force every page to render dynamically.
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}${gaEnabled ? " https://www.googletagmanager.com" : ""} https://js.stripe.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://lh3.googleusercontent.com https://*.stripe.com",
  "font-src 'self' data:",
  `connect-src 'self'${gaEnabled ? " https://www.google-analytics.com https://*.google-analytics.com" : ""}`,
  "frame-src https://js.stripe.com https://checkout.stripe.com",
  "frame-ancestors 'none'",
  "form-action 'self' https://accounts.google.com https://checkout.stripe.com",
  "base-uri 'self'",
  "object-src 'none'",
  ...(isProd && isHttps ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(self)" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(isProd && isHttps ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }] : []),
];

const nextConfig: NextConfig = {
  // Self-contained server bundle for VPS/Docker deployments (ignored by Vercel).
  output: process.env.VERCEL ? undefined : "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  compress: true,
  // The CAS runs in a worker thread that loads nerdamer at runtime.
  serverExternalPackages: ["nerdamer"],
  outputFileTracingIncludes: { "/api/**": ["./node_modules/nerdamer/**/*"], "/**": ["./node_modules/nerdamer/**/*"] },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [{ protocol: "https", hostname: "lh3.googleusercontent.com" }],
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "mathjs"],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
    ];
  },
  async redirects() {
    return [
      { source: "/calculators/graphing-calculator", destination: "/graphing-calculator", permanent: true },
      { source: "/formulas", destination: "/math-formulas", permanent: true },
      { source: "/formulas/:slug", destination: "/math-formulas/:slug", permanent: true },
      { source: "/signup", destination: "/register", permanent: true },
      { source: "/signin", destination: "/login", permanent: true },
    ];
  },
};

export default nextConfig;
