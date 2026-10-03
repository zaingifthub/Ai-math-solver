import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { features } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  let db = "unconfigured";
  if (process.env.DATABASE_URL) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      db = "ok";
    } catch {
      db = "error";
    }
  }
  const ok = db !== "error";
  return NextResponse.json({ status: ok ? "ok" : "degraded", db, auth: features.auth, ai: features.ai, billing: features.stripe, email: Boolean(process.env.SMTP_URL), time: new Date().toISOString() }, { status: ok ? 200 : 503 });
}
