import "server-only";
import { prisma } from "./db";

export async function getAdminStats() {
  const now = Date.now();
  const d1 = new Date(now - 86_400_000);
  const d30 = new Date(now - 30 * 86_400_000);
  const [users, newUsers30, premium, education, problems24h, problems30, aiAgg, aiByKind, activeSubs, topCategories, dailyRows] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: d30 } } }),
    prisma.user.count({ where: { plan: "PREMIUM" } }),
    prisma.user.count({ where: { plan: "EDUCATION" } }),
    prisma.problem.count({ where: { createdAt: { gte: d1 } } }),
    prisma.problem.count({ where: { createdAt: { gte: d30 } } }),
    prisma.usageEvent.aggregate({ where: { createdAt: { gte: d30 }, kind: { in: ["AI_EXPLAIN", "TUTOR", "OCR"] } }, _sum: { inputTokens: true, outputTokens: true, costMicros: true }, _count: { _all: true } }),
    prisma.usageEvent.groupBy({ by: ["kind"], where: { createdAt: { gte: d30 } }, _count: { _all: true }, _sum: { costMicros: true } }),
    prisma.subscription.count({ where: { status: { in: ["ACTIVE", "TRIALING"] } } }),
    prisma.problem.groupBy({ by: ["category"], where: { createdAt: { gte: d30 } }, _count: { _all: true }, orderBy: { _count: { category: "desc" } }, take: 10 }),
    prisma.$queryRaw<{ day: Date; solves: bigint; signups: bigint }[]>`
      SELECT d::date AS day,
        (SELECT COUNT(*) FROM "Problem" p WHERE p."createdAt"::date = d::date) AS solves,
        (SELECT COUNT(*) FROM "User" u WHERE u."createdAt"::date = d::date) AS signups
      FROM generate_series(CURRENT_DATE - INTERVAL '29 days', CURRENT_DATE, INTERVAL '1 day') d ORDER BY day`,
  ]);
  return {
    users: { total: users, new30: newUsers30, premium, education, conversion: users ? (premium + education) / users : 0 },
    problems: { last24h: problems24h, last30: problems30 },
    ai: { requests30: aiAgg._count._all, inputTokens: aiAgg._sum.inputTokens ?? 0, outputTokens: aiAgg._sum.outputTokens ?? 0, costUsd: (aiAgg._sum.costMicros ?? 0) / 1_000_000 },
    usageByKind: aiByKind.map((k) => ({ kind: k.kind, count: k._count._all, costUsd: (k._sum.costMicros ?? 0) / 1_000_000 })),
    subscriptions: { active: activeSubs },
    topCategories: topCategories.map((c) => ({ category: c.category, count: c._count._all })),
    daily: dailyRows.map((r) => ({ day: r.day.toISOString().slice(0, 10), solves: Number(r.solves), signups: Number(r.signups) })),
  };
}
