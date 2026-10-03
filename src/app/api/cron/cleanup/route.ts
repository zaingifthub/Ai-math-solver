import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { cleanupUploads } from "@/lib/uploads";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";

export const runtime = "nodejs";

function authorized(req: Request) {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!env.CRON_SECRET || !token) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(env.CRON_SECRET);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Housekeeping: expired uploads, stale rate-limit buckets and old guest data. Call hourly from cron. */
export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const uploads = await cleanupUploads();
  let buckets = 0;
  let guestProblems = 0;
  if (process.env.DATABASE_URL) {
    buckets = (await prisma.rateLimitBucket.deleteMany({ where: { resetAt: { lt: new Date() } } })).count;
    guestProblems = (await prisma.problem.deleteMany({ where: { userId: null, createdAt: { lt: new Date(Date.now() - 7 * 86_400_000) } } })).count;
    await prisma.usageEvent.deleteMany({ where: { userId: null, createdAt: { lt: new Date(Date.now() - 90 * 86_400_000) } } });
  }
  return NextResponse.json({ ok: true, uploads, buckets, guestProblems });
}
