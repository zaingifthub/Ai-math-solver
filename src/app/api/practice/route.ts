import { NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler, ApiError, getClientIp } from "@/lib/security";
import { generateProblem, problemFromId, PRACTICE_TOPICS, type PracticeTopic } from "@/lib/math/generator";
import { checkAnswer } from "@/lib/math/answer-check";
import { getActor, guestKey } from "@/lib/usage";
import { rateLimit, LIMIT_PRESETS } from "@/lib/rate-limit";
import { prisma } from "@/lib/db";

const topicIds = PRACTICE_TOPICS.map((t) => t.id) as [PracticeTopic, ...PracticeTopic[]];

export const GET = apiHandler(async (req) => {
  const url = new URL(req.url);
  const topic = z.enum(topicIds).parse(url.searchParams.get("topic") ?? "linear-equations");
  const difficulty = z.coerce.number().int().min(1).max(3).parse(url.searchParams.get("difficulty") ?? "1") as 1 | 2 | 3;
  const count = z.coerce.number().int().min(1).max(20).parse(url.searchParams.get("count") ?? "1");
  const problems = Array.from({ length: count }, () => {
    const p = generateProblem(topic, difficulty);
    // The answer is never sent to the client before it is checked.
    return { id: p.id, topic: p.topic, difficulty: p.difficulty, instruction: p.instruction, prompt: p.prompt, hint: p.hint, answerKind: p.answer.kind };
  });
  return NextResponse.json({ problems }, { headers: { "Cache-Control": "no-store" } });
});

const checkSchema = z.object({ id: z.string().max(100), answer: z.string().max(500), timeMs: z.number().int().min(0).max(3_600_000).optional() });

export const POST = apiHandler(async (req) => {
  const body = checkSchema.parse(await req.json());
  const actor = await getActor();
  const rl = await rateLimit(`practice:${guestKey(actor, getClientIp(req))}`, LIMIT_PRESETS.general.limit, LIMIT_PRESETS.general.windowMs);
  if (!rl.ok) throw new ApiError(429, "Too many attempts, slow down a little.", "RATE_LIMITED");
  const problem = problemFromId(body.id);
  if (!problem) throw new ApiError(400, "Unknown problem.", "BAD_PROBLEM");
  const result = checkAnswer(body.answer, problem.answer);

  if (actor.userId && process.env.DATABASE_URL) {
    await prisma
      .$transaction(async (tx) => {
        await tx.practiceAttempt.create({
          data: { userId: actor.userId!, topic: problem.topic, difficulty: problem.difficulty, question: problem.prompt, userAnswer: body.answer, correctAnswer: problem.answer.display, isCorrect: result.correct, timeMs: body.timeMs },
        });
        const prev = await tx.topicProgress.findUnique({ where: { userId_topic: { userId: actor.userId!, topic: problem.topic } } });
        const attempts = (prev?.attempts ?? 0) + 1;
        const correct = (prev?.correct ?? 0) + (result.correct ? 1 : 0);
        // Exponential moving average weighted by difficulty → mastery in [0, 1]
        const weight = 0.15 + 0.05 * problem.difficulty;
        const mastery = (prev?.mastery ?? 0) * (1 - weight) + (result.correct ? 1 : 0) * weight;
        await tx.topicProgress.upsert({
          where: { userId_topic: { userId: actor.userId!, topic: problem.topic } },
          create: { userId: actor.userId!, topic: problem.topic, attempts, correct, streak: result.correct ? 1 : 0, mastery, lastPracticeAt: new Date() },
          update: { attempts, correct, streak: result.correct ? (prev?.streak ?? 0) + 1 : 0, mastery, lastPracticeAt: new Date() },
        });
      })
      .catch((e) => console.error("[practice] failed to record attempt", e));
  }
  return NextResponse.json({ correct: result.correct, feedback: result.feedback, answer: problem.answer.display, solveInput: problem.solveInput });
});
