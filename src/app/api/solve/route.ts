import { NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler, ApiError, getClientIp } from "@/lib/security";
import { rateLimit, LIMIT_PRESETS } from "@/lib/rate-limit";
import { getActor, enforceQuota, recordUsage, guestKey } from "@/lib/usage";
import { runSolve } from "@/lib/solve-service";
import { MAX_INPUT_LENGTH } from "@/lib/math/engine";

export const runtime = "nodejs";
export const maxDuration = 60;

const schema = z.object({
  input: z.string().trim().min(1, "Please enter a problem.").max(MAX_INPUT_LENGTH, `Problems are limited to ${MAX_INPUT_LENGTH} characters.`),
  explain: z.boolean().optional().default(false),
  level: z.enum(["BEGINNER", "MIDDLE_SCHOOL", "HIGH_SCHOOL", "COLLEGE"]).optional(),
  source: z.enum(["TEXT", "IMAGE", "CALCULATOR", "PRACTICE"]).optional().default("TEXT"),
});

export const POST = apiHandler(async (req) => {
  const body = schema.parse(await req.json());
  const actor = await getActor();
  const rl = await rateLimit(`solve:${guestKey(actor, getClientIp(req))}`, LIMIT_PRESETS.solve.limit, LIMIT_PRESETS.solve.windowMs);
  if (!rl.ok) throw new ApiError(429, "You're solving very quickly — please wait a moment.", "RATE_LIMITED");
  await enforceQuota(actor, "SOLVE");
  const result = await runSolve(body.input, actor, { explain: body.explain, level: body.level ?? actor.level, source: body.source });
  await recordUsage(actor, "SOLVE");
  return NextResponse.json({ result }, { headers: { "Cache-Control": "no-store" } });
});
