import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { cookies, headers } from "next/headers";
import { ZodError } from "zod";
import { ipFromHeaders } from "./ip";

export { ipFromHeaders };

export const GUEST_COOKIE = "ams_gid";

export function getClientIp(req?: NextRequest | Request): string {
  return ipFromHeaders((n) => req?.headers.get(n));
}

export function hashValue(value: string): string {
  return createHash("sha256").update(`${process.env.NEXTAUTH_SECRET ?? "ams"}:${value}`).digest("hex").slice(0, 32);
}

/**
 * CSRF protection for state-changing API routes: browsers always send Origin on
 * cross-site POST/PUT/PATCH/DELETE, so require it (or Referer) to match our host.
 * NextAuth's own routes use its double-submit CSRF token.
 */
export function isSameOrigin(req: NextRequest | Request): boolean {
  const method = req.method.toUpperCase();
  if (["GET", "HEAD", "OPTIONS"].includes(method)) return true;
  const origin = req.headers.get("origin") ?? req.headers.get("referer");
  if (!origin) return false;
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const allowed = new Set([host, process.env.NEXT_PUBLIC_SITE_URL ? new URL(process.env.NEXT_PUBLIC_SITE_URL).host : null].filter(Boolean));
  return allowed.has(originHost);
}

export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string, public extra?: Record<string, unknown>) {
    super(message);
  }
}

export function jsonError(status: number, message: string, code?: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, code, ...extra }, { status });
}

function isDatabaseUnavailable(e: unknown): boolean {
  const err = e as { name?: string; code?: string; errorCode?: string };
  return err?.name === "PrismaClientInitializationError" || ["P1000", "P1001", "P1002", "P1003", "P1017"].includes(err?.code ?? err?.errorCode ?? "");
}

/** Wrap a route handler with CSRF/origin checks and uniform error handling. */
export function apiHandler<C = unknown>(handler: (req: NextRequest, ctx: C) => Promise<Response>, opts: { csrf?: boolean; maxBodyBytes?: number } = {}) {
  const maxBody = opts.maxBodyBytes ?? 1024 * 1024;
  return async (req: NextRequest, ctx: C): Promise<Response> => {
    try {
      if (opts.csrf !== false && !isSameOrigin(req)) return jsonError(403, "Cross-site request blocked.", "CSRF");
      // Reject oversized bodies before they are buffered into memory
      const length = Number(req.headers.get("content-length") ?? 0);
      if (length > maxBody) return jsonError(413, "Request is too large.", "PAYLOAD_TOO_LARGE");
      return await handler(req, ctx);
    } catch (e) {
      if (e instanceof ApiError) return jsonError(e.status, e.message, e.code, e.extra);
      if (e instanceof ZodError) return jsonError(400, e.issues[0]?.message ?? "Invalid input.", "VALIDATION", { issues: e.issues.slice(0, 5) });
      if (e instanceof SyntaxError) return jsonError(400, "Malformed request body.", "BAD_JSON");
      if (isDatabaseUnavailable(e)) {
        console.error("[api] database unavailable", (e as Error).message);
        return jsonError(503, "This feature is temporarily unavailable. Please try again shortly.", "DB_UNAVAILABLE");
      }
      console.error("[api] unhandled error", e);
      return jsonError(500, "Something went wrong. Please try again.", "INTERNAL");
    }
  };
}

/** Get or create a stable anonymous id for guest usage tracking. */
export async function getGuestId(): Promise<string> {
  const store = await cookies();
  const existing = store.get(GUEST_COOKIE)?.value;
  if (existing && /^[a-f0-9-]{36}$/.test(existing)) return existing;
  const id = randomUUID();
  try {
    store.set(GUEST_COOKIE, id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 });
  } catch {
    /* cookies are read-only in some render contexts */
  }
  return id;
}

export async function requestMeta() {
  const h = await headers();
  const ip = ipFromHeaders((n) => h.get(n));
  return {
    ip: ip === "0.0.0.0" ? undefined : ip,
    userAgent: h.get("user-agent")?.slice(0, 300) ?? undefined,
  };
}
