import "server-only";
import type { UsageKind } from "@prisma/client";
import { prisma } from "./db";
import { getCurrentUser } from "./auth";
import { headers } from "next/headers";
import { getGuestId, hashValue, ipFromHeaders, ApiError } from "./security";
import { LIMITS, type PlanId } from "./plans";

export interface Actor {
  userId: string | null;
  guestId: string;
  ipHash: string | null;
  plan: PlanId | "GUEST";
  role: string;
  level: string;
}

export async function getActor(): Promise<Actor> {
  const user = await getCurrentUser();
  const guestId = await getGuestId();
  let ipHash: string | null = null;
  try {
    const h = await headers();
    const ip = ipFromHeaders((n) => h.get(n));
    ipHash = ip === "0.0.0.0" ? null : hashValue(`ip:${ip}`);
  } catch {
    /* outside a request scope */
  }
  return {
    userId: user?.id ?? null,
    guestId,
    ipHash,
    plan: user ? user.plan : "GUEST",
    role: user?.role ?? "GUEST",
    level: user?.level ?? "HIGH_SCHOOL",
  };
}

const LIMIT_FIELD: Record<UsageKind, keyof (typeof LIMITS)["FREE"]> = {
  SOLVE: "solvesPerDay",
  AI_EXPLAIN: "aiExplanationsPerDay",
  TUTOR: "tutorMessagesPerDay",
  OCR: "imageScansPerDay",
  PRACTICE: "solvesPerDay",
};

const GUESTS_PER_IP = 5;

function startOfDayUTC() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export interface QuotaStatus {
  allowed: boolean;
  used: number;
  limit: number;
  usedCredit?: boolean;
}

/** Check (and optionally consume credits for) the daily quota of a usage kind. */
export async function checkQuota(actor: Actor, kind: UsageKind): Promise<QuotaStatus> {
  const limit = Number(LIMITS[actor.plan][LIMIT_FIELD[kind]]);
  if (!process.env.DATABASE_URL) return { allowed: limit > 0, used: 0, limit };
  try {
    const since = startOfDayUTC();
    const where = actor.userId ? { userId: actor.userId } : { guestId: actor.guestId };
    const used = await prisma.usageEvent.count({ where: { ...where, kind, createdAt: { gte: since }, success: true } });
    if (!actor.userId && actor.ipHash && used < limit) {
      // Clearing cookies must not reset the guest limit. Allow a few guests per network (schools, offices).
      const perIp = await prisma.usageEvent.count({ where: { ipHash: actor.ipHash, userId: null, kind, createdAt: { gte: since }, success: true } });
      if (perIp >= limit * GUESTS_PER_IP) return { allowed: false, used: Math.max(used, limit), limit };
    }
    if (used < limit) return { allowed: true, used, limit };
    if (actor.userId) {
      // Spend a purchased credit when over the plan limit
      const res = await prisma.user.updateMany({ where: { id: actor.userId, credits: { gt: 0 } }, data: { credits: { decrement: 1 } } });
      if (res.count > 0) return { allowed: true, used, limit, usedCredit: true };
    }
    return { allowed: false, used, limit };
  } catch {
    return { allowed: true, used: 0, limit };
  }
}

export async function enforceQuota(actor: Actor, kind: UsageKind) {
  const q = await checkQuota(actor, kind);
  if (!q.allowed) {
    const msg =
      q.limit === 0
        ? actor.userId
          ? "This feature is not included in your plan."
          : "Create a free account to use this feature."
        : actor.userId
          ? `You've reached today's limit (${q.limit}). Upgrade to Premium for unlimited access.`
          : `Guest limit reached (${q.limit} per day). Sign up free for higher limits.`;
    throw new ApiError(402, msg, "QUOTA_EXCEEDED", { limit: q.limit, used: q.used, upgrade: true });
  }
  return q;
}

/** Approximate USD cost in micro-dollars for analytics (Claude Opus 5.5 list prices: $4 / $20 per MTok). */
export function estimateCostMicros(inputTokens: number, outputTokens: number) {
  return Math.round(inputTokens * 4 + outputTokens * 20);
}

export async function recordUsage(actor: Actor, kind: UsageKind, extra: { model?: string; inputTokens?: number; outputTokens?: number; success?: boolean } = {}) {
  if (!process.env.DATABASE_URL) return;
  try {
    await prisma.usageEvent.create({
      data: {
        userId: actor.userId,
        guestId: actor.userId ? null : actor.guestId,
        ipHash: actor.userId ? null : actor.ipHash,
        kind,
        model: extra.model,
        inputTokens: extra.inputTokens ?? 0,
        outputTokens: extra.outputTokens ?? 0,
        costMicros: estimateCostMicros(extra.inputTokens ?? 0, extra.outputTokens ?? 0),
        success: extra.success ?? true,
      },
    });
  } catch (e) {
    console.error("[usage] failed to record", e);
  }
}

export function guestKey(actor: Actor, ip: string) {
  return actor.userId ? `u:${actor.userId}` : `g:${hashValue(ip)}`;
}
