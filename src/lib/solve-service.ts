import "server-only";
import type { Prisma, ProblemSource } from "@prisma/client";
import { solve, WordProblemError } from "./math/engine";
import { MathInputError, type SolveResult } from "./math/types";
import { LRU } from "./cache";
import { prisma } from "./db";
import { aiEnabled, describeAIError } from "./ai/client";
import { translateWordProblem } from "./ai/word-problem";
import { enhanceSolution } from "./ai/explain";
import { recordUsage, checkQuota, type Actor } from "./usage";
import { ApiError } from "./security";

const globalCache = globalThis as unknown as { __solveCache?: LRU<SolveResult> };
const cache = (globalCache.__solveCache ??= new LRU<SolveResult>(1000, 30 * 60_000));

export interface SolveRequestOptions {
  explain: boolean;
  level: string;
  source: ProblemSource;
}

export async function runSolve(input: string, actor: Actor, opts: SolveRequestOptions): Promise<SolveResult & { aiError?: string }> {
  const key = input.trim().replace(/\s+/g, " ");
  let result = cache.get(key);
  if (!result) {
    try {
      result = await solve(key, {
        translateWordProblem: aiEnabled()
          ? async (text) => {
              const q = await checkQuota(actor, "AI_EXPLAIN");
              if (!q.allowed) throw new ApiError(402, "Word problems use AI. You've reached today's AI limit — upgrade for more.", "QUOTA_EXCEEDED", { upgrade: true });
              try {
                const t = await translateWordProblem(text);
                if (t) await recordUsage(actor, "AI_EXPLAIN", { model: t.usage.model, inputTokens: t.usage.input, outputTokens: t.usage.output });
                return t;
              } catch (e) {
                throw new MathInputError(describeAIError(e));
              }
            }
          : undefined,
      });
    } catch (e) {
      if (e instanceof WordProblemError) throw new ApiError(422, "This looks like a word problem. AI word-problem support is not enabled — please write it as an equation (e.g. 2x + 5 = 17).", "WORD_PROBLEM");
      if (e instanceof MathInputError) throw new ApiError(422, e.message, "UNSOLVABLE");
      throw e;
    }
    if (result.category !== "word-problem") cache.set(key, result);
  }
  const out: SolveResult & { aiError?: string } = structuredClone(result);

  if (opts.explain && aiEnabled()) {
    const q = await checkQuota(actor, "AI_EXPLAIN");
    if (q.allowed) {
      try {
        const ai = await enhanceSolution(out, opts.level);
        if (ai) {
          out.ai = ai.enhancement;
          await recordUsage(actor, "AI_EXPLAIN", { model: ai.usage.model, inputTokens: ai.usage.input, outputTokens: ai.usage.output });
        }
      } catch (e) {
        out.aiError = describeAIError(e);
        await recordUsage(actor, "AI_EXPLAIN", { success: false });
      }
    } else {
      out.aiError = actor.userId ? "Daily AI explanation limit reached. Upgrade to Premium for unlimited explanations." : "Sign up free to unlock more AI explanations.";
    }
  }

  if (process.env.DATABASE_URL) {
    try {
      const saved = await prisma.problem.create({
        data: {
          userId: actor.userId,
          guestId: actor.userId ? null : actor.guestId,
          input: out.input.slice(0, 2000),
          normalized: out.interpreted.slice(0, 4000),
          category: out.category,
          topic: out.topic,
          answer: out.answer.text.slice(0, 2000),
          result: out as unknown as Prisma.InputJsonValue,
          verified: out.verification.status === "verified",
          source: opts.source,
        },
        select: { id: true },
      });
      out.id = saved.id;
    } catch (e) {
      console.error("[solve] failed to persist problem", e);
    }
  }
  return out;
}
