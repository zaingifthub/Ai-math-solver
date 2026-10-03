import { z } from "zod";
import { apiHandler, ApiError, getClientIp } from "@/lib/security";
import { rateLimit, LIMIT_PRESETS } from "@/lib/rate-limit";
import { getActor, enforceQuota, recordUsage, guestKey } from "@/lib/usage";
import { aiEnabled, describeAIError } from "@/lib/ai/client";
import { tutorStream, type TutorMessage } from "@/lib/ai/tutor";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
// 60 s fits every Vercel plan; tutor replies stream, so long answers are delivered progressively.
export const maxDuration = 60;

const schema = z.object({
  conversationId: z.string().min(1).max(40).optional(),
  message: z.string().trim().min(1).max(4000),
  mode: z.enum(["chat", "explain-step", "simplify", "hint", "another-method", "examples", "practice", "check-work", "teach"]).default("chat"),
  level: z.enum(["BEGINNER", "MIDDLE_SCHOOL", "HIGH_SCHOOL", "COLLEGE"]).optional(),
  context: z.string().max(8000).optional(),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(8000) })).max(30).optional(),
});

export const POST = apiHandler(async (req) => {
  if (!aiEnabled()) throw new ApiError(503, "The AI tutor is not available right now.", "AI_DISABLED");
  const body = schema.parse(await req.json());
  const actor = await getActor();
  const rl = await rateLimit(`ai:${guestKey(actor, getClientIp(req))}`, LIMIT_PRESETS.ai.limit, LIMIT_PRESETS.ai.windowMs);
  if (!rl.ok) throw new ApiError(429, "Please slow down a little — try again in a moment.", "RATE_LIMITED");
  await enforceQuota(actor, "TUTOR");
  const level = body.level ?? actor.level;

  // Signed-in users get persistent conversations; guests send their (short) history.
  let conversationId = body.conversationId ?? null;
  let createdConversation = false;
  let history: TutorMessage[] = [];
  if (actor.userId && process.env.DATABASE_URL) {
    if (conversationId) {
      const conv = await prisma.tutorConversation.findFirst({ where: { id: conversationId, userId: actor.userId }, include: { messages: { orderBy: { createdAt: "asc" }, take: 40 } } });
      if (!conv) throw new ApiError(404, "Conversation not found.", "NOT_FOUND");
      history = conv.messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
    } else {
      const conv = await prisma.tutorConversation.create({ data: { userId: actor.userId, title: body.message.slice(0, 80), level: level as "HIGH_SCHOOL" } });
      conversationId = conv.id;
      createdConversation = true;
    }
    await prisma.tutorMessage.create({ data: { conversationId: conversationId!, role: "user", content: body.message } });
  } else {
    history = (body.history ?? []).slice(-12);
  }
  history.push({ role: "user", content: body.message });

  const encoder = new TextEncoder();
  const abort = new AbortController();
  req.signal.addEventListener("abort", () => abort.abort());
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      send("meta", { conversationId });
      let full = "";
      try {
        for await (const ev of tutorStream(history, { level, mode: body.mode, context: body.context, signal: abort.signal })) {
          if (ev.type === "text") {
            full += ev.text;
            send("text", { text: ev.text });
          } else if (ev.type === "tool") send("tool", ev);
          else if (ev.type === "done") await recordUsage(actor, "TUTOR", { model: ev.usage.model, inputTokens: ev.usage.input, outputTokens: ev.usage.output });
        }
        if (conversationId && full.trim()) {
          await prisma.tutorMessage.create({ data: { conversationId, role: "assistant", content: full } });
          await prisma.tutorConversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
        }
        send("done", {});
      } catch (e) {
        if (!abort.signal.aborted) {
          await recordUsage(actor, "TUTOR", { success: false });
          send("error", { error: describeAIError(e) });
        }
        // Don't leave behind a conversation that has no tutor reply
        if (createdConversation && conversationId && !full.trim()) {
          await prisma.tutorConversation.delete({ where: { id: conversationId } }).catch(() => undefined);
        }
      } finally {
        controller.close();
      }
    },
    cancel() {
      abort.abort();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no" } });
});
