import { NextResponse } from "next/server";
import { apiHandler, ApiError, getClientIp } from "@/lib/security";
import { rateLimit, LIMIT_PRESETS } from "@/lib/rate-limit";
import { getActor, enforceQuota, recordUsage, guestKey } from "@/lib/usage";
import { validateImageFile, storeUpload } from "@/lib/uploads";
import { aiEnabled, describeAIError } from "@/lib/ai/client";
import { extractMathFromImage } from "@/lib/ai/ocr";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Below this confidence the client asks the student to confirm/edit the transcription before solving. */
const CONFIDENCE_THRESHOLD = 0.75;

export const POST = apiHandler(async (req) => {
  if (!aiEnabled()) throw new ApiError(503, "Photo scanning is not available right now. Please type your problem instead.", "AI_DISABLED");
  const actor = await getActor();
  const rl = await rateLimit(`upload:${guestKey(actor, getClientIp(req))}`, LIMIT_PRESETS.upload.limit, LIMIT_PRESETS.upload.windowMs);
  if (!rl.ok) throw new ApiError(429, "Too many uploads. Please wait a minute.", "RATE_LIMITED");
  await enforceQuota(actor, "OCR");

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw new ApiError(400, "Attach an image file.", "NO_FILE");
  const { buffer, mime } = await validateImageFile(file);
  const stored = await storeUpload(buffer, mime, actor);

  let result;
  try {
    result = await extractMathFromImage(buffer.toString("base64"), mime);
  } catch (e) {
    await recordUsage(actor, "OCR", { success: false });
    if (stored.id) await prisma.upload.update({ where: { id: stored.id }, data: { status: "FAILED" } }).catch(() => undefined);
    throw new ApiError(502, describeAIError(e), "AI_ERROR");
  }
  if (!result || !result.contains_math || result.problems.length === 0) {
    await recordUsage(actor, "OCR", { success: false });
    throw new ApiError(422, "We couldn't find a math problem in this image. Try a clearer, closer photo.", "NO_MATH");
  }
  await recordUsage(actor, "OCR", { model: result.usage.model, inputTokens: result.usage.input, outputTokens: result.usage.output });
  const confidence = Math.min(...result.problems.map((p) => p.confidence));
  if (stored.id) {
    await prisma.upload
      .update({ where: { id: stored.id }, data: { status: "PROCESSED", ocrText: result.problems.map((p) => p.engine_input).join("\n"), ocrConfidence: confidence } })
      .catch(() => undefined);
  }
  return NextResponse.json({
    uploadId: stored.id,
    problems: result.problems.map((p) => ({ latex: p.latex, input: p.engine_input, confidence: p.confidence })),
    confidence,
    needsReview: confidence < CONFIDENCE_THRESHOLD || Boolean(result.issues),
    issues: result.issues || null,
  });
});
