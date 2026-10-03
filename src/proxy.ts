import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const ROLE_RANK: Record<string, number> = { USER: 0, EDITOR: 1, ADMIN: 2 };

/**
 * Edge-of-app protection: signed-in users only for /dashboard, editors/admins for /admin.
 * API routes perform their own (authoritative) checks.
 */
export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  let token: Awaited<ReturnType<typeof getToken>> = null;
  try {
    token = process.env.NEXTAUTH_SECRET ? await getToken({ req, secret: process.env.NEXTAUTH_SECRET }) : null;
  } catch {
    token = null;
  }
  const signedIn = Boolean(token?.id) && !token?.disabled;

  if ((pathname.startsWith("/dashboard") || pathname.startsWith("/admin")) && !signedIn) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?callbackUrl=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  if (pathname.startsWith("/admin") && (ROLE_RANK[String(token?.role ?? "USER")] ?? 0) < ROLE_RANK.EDITOR) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }
  if ((pathname === "/login" || pathname === "/register" || pathname === "/forgot-password") && signedIn) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/login", "/register", "/forgot-password"],
};
