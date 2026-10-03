import "server-only";
import { prisma } from "./db";

/**
 * Fixed-window rate limiter. Uses process memory by default (single VPS
 * instance) or the database when RATE_LIMIT_STORE=database (multi-instance /
 * serverless deployments such as Vercel).
 */
interface Bucket {
  count: number;
  resetAt: number;
}

const globalStore = globalThis as unknown as { __rl?: Map<string, Bucket> };
const memory = (globalStore.__rl ??= new Map<string, Bucket>());

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
}

function memoryLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  let b = memory.get(key);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + windowMs };
    memory.set(key, b);
  }
  b.count++;
  if (memory.size > 50_000) {
    for (const [k, v] of memory) if (v.resetAt <= now) memory.delete(k);
  }
  return { ok: b.count <= limit, remaining: Math.max(0, limit - b.count), resetAt: b.resetAt, limit };
}

async function dbLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowMs);
  const rows = await prisma.$queryRaw<{ count: number; resetAt: Date }[]>`
    INSERT INTO "RateLimitBucket" ("key", "count", "resetAt") VALUES (${key}, 1, ${resetAt})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimitBucket"."resetAt" <= ${now} THEN 1 ELSE "RateLimitBucket"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimitBucket"."resetAt" <= ${now} THEN ${resetAt} ELSE "RateLimitBucket"."resetAt" END
    RETURNING "count", "resetAt"`;
  const row = rows[0];
  return { ok: row.count <= limit, remaining: Math.max(0, limit - row.count), resetAt: row.resetAt.getTime(), limit };
}

export async function rateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  if (process.env.RATE_LIMIT_STORE === "database" && process.env.DATABASE_URL) {
    try {
      return await dbLimit(key, limit, windowMs);
    } catch {
      /* fall back to memory */
    }
  }
  return memoryLimit(key, limit, windowMs);
}

export const LIMIT_PRESETS = {
  solve: { limit: 30, windowMs: 60_000 },
  ai: { limit: 12, windowMs: 60_000 },
  upload: { limit: 8, windowMs: 60_000 },
  auth: { limit: 10, windowMs: 15 * 60_000 },
  register: { limit: 5, windowMs: 60 * 60_000 },
  general: { limit: 120, windowMs: 60_000 },
} as const;
