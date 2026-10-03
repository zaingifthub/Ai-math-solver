import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

const configured = Boolean(process.env.NEXTAUTH_SECRET) || process.env.NODE_ENV !== "production";

/**
 * When auth is not configured (e.g. a preview deployment without NEXTAUTH_SECRET) answer as
 * "signed out" instead of throwing on every page load; sign-in endpoints return 503.
 */
function unconfigured(req: Request) {
  const path = new URL(req.url).pathname;
  if (path.endsWith("/session")) return NextResponse.json({});
  if (path.endsWith("/providers")) return NextResponse.json({});
  if (path.endsWith("/csrf")) return NextResponse.json({ csrfToken: "" });
  return NextResponse.json({ error: "Sign-in is not configured on this server." }, { status: 503 });
}

const handler = configured ? NextAuth(authOptions) : unconfigured;
export { handler as GET, handler as POST };
