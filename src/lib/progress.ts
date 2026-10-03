import "server-only";
import { prisma } from "./db";
import { PRACTICE_TOPICS } from "./math/generator";

export async function getProgress(userId: string) {
  const since = new Date(Date.now() - 30 * 86_400_000);
  const [topics, attempts, solves, recent] = await Promise.all([
    prisma.topicProgress.findMany({ where: { userId }, orderBy: { lastPracticeAt: "desc" } }),
    prisma.practiceAttempt.findMany({ where: { userId, createdAt: { gte: since } }, select: { createdAt: true, isCorrect: true } }),
    prisma.problem.groupBy({ by: ["category"], where: { userId }, _count: { _all: true } }),
    prisma.problem.count({ where: { userId, createdAt: { gte: since } } }),
  ]);
  const label = (id: string) => PRACTICE_TOPICS.find((t) => t.id === id)?.label ?? id;
  const totalAttempts = topics.reduce((s, t) => s + t.attempts, 0);
  const totalCorrect = topics.reduce((s, t) => s + t.correct, 0);
  const days = new Map<string, { attempts: number; correct: number }>();
  for (const a of attempts) {
    const d = a.createdAt.toISOString().slice(0, 10);
    const e = days.get(d) ?? { attempts: 0, correct: 0 };
    e.attempts++;
    if (a.isCorrect) e.correct++;
    days.set(d, e);
  }
  // Practice streak: consecutive days with at least one attempt, ending today or yesterday
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
    if (days.has(d)) streak++;
    else if (i > 0) break;
  }
  const weak = topics
    .filter((t) => t.attempts >= 3)
    .map((t) => ({ topic: t.topic, label: label(t.topic), accuracy: t.correct / t.attempts, mastery: t.mastery }))
    .sort((a, b) => a.mastery - b.mastery)
    .slice(0, 3)
    .filter((t) => t.mastery < 0.7);
  return {
    summary: { attempts: totalAttempts, correct: totalCorrect, accuracy: totalAttempts ? totalCorrect / totalAttempts : 0, streak, solvesLast30: recent },
    topics: topics.map((t) => ({ topic: t.topic, label: label(t.topic), attempts: t.attempts, correct: t.correct, accuracy: t.attempts ? t.correct / t.attempts : 0, mastery: t.mastery, streak: t.streak, lastPracticeAt: t.lastPracticeAt })),
    weak,
    daily: [...days.entries()].sort().map(([date, v]) => ({ date, ...v })),
    categories: solves.map((s) => ({ category: s.category, count: s._count._all })).sort((a, b) => b.count - a.count),
  };
}
