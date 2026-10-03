/**
 * Client IP for rate limiting and quotas. X-Real-IP is set by our reverse proxy (see deploy/nginx.conf)
 * and by Vercel; otherwise use the right-most X-Forwarded-For hop, which was appended by the nearest
 * proxy. The left-most entry is client-controlled and must never be trusted.
 */
export function ipFromHeaders(get: (name: string) => string | null | undefined): string {
  const real = get("x-real-ip")?.trim();
  if (real) return real;
  const hops = (get("x-forwarded-for") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return hops[hops.length - 1] ?? "0.0.0.0";
}
