import "server-only";
import type { z } from "zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { getClient, AI_MODEL, FALLBACK_BETA, aiProvider } from "./client";
import { geminiGenerate, geminiText, geminiUsage, toGeminiSchema, GEMINI_BLOCKED, type GeminiPart } from "./gemini";

export type AIUsage = { input: number; output: number; model: string };

export interface StructuredRequest<T extends z.ZodType> {
  system: string;
  text: string;
  image?: { base64: string; mediaType: "image/png" | "image/jpeg" | "image/webp" | "image/gif" };
  schema: T;
  maxTokens: number;
}

/** Runs one structured-output request on the configured provider. Returns null when the model declines. */
export async function generateStructured<T extends z.ZodType>(req: StructuredRequest<T>): Promise<{ data: z.infer<T>; usage: AIUsage } | null> {
  return aiProvider() === "gemini" ? viaGemini(req) : viaAnthropic(req);
}

async function viaAnthropic<T extends z.ZodType>(req: StructuredRequest<T>) {
  const client = getClient();
  const response = await client.beta.messages.parse({
    model: AI_MODEL,
    max_tokens: req.maxTokens,
    betas: [FALLBACK_BETA],
    fallbacks: "default",
    output_config: { effort: "low", format: betaZodOutputFormat(req.schema) },
    system: req.system,
    messages: [
      {
        role: "user",
        content: req.image
          ? [
              { type: "image", source: { type: "base64", media_type: req.image.mediaType, data: req.image.base64 } },
              { type: "text", text: req.text },
            ]
          : req.text,
      },
    ],
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) return null;
  return {
    data: response.parsed_output as z.infer<T>,
    usage: { input: response.usage.input_tokens, output: response.usage.output_tokens, model: response.model },
  };
}

async function viaGemini<T extends z.ZodType>(req: StructuredRequest<T>) {
  const parts: GeminiPart[] = [];
  if (req.image) parts.push({ inlineData: { mimeType: req.image.mediaType, data: req.image.base64 } });
  parts.push({ text: req.text });
  const response = await geminiGenerate({
    systemInstruction: { parts: [{ text: req.system }] },
    contents: [{ role: "user", parts }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: toGeminiSchema(req.schema),
      // Thinking models spend part of this budget on reasoning.
      maxOutputTokens: req.maxTokens * 2,
    },
  });
  const finish = response.candidates?.[0]?.finishReason;
  if (response.promptFeedback?.blockReason || (finish && GEMINI_BLOCKED.has(finish))) return null;
  let json: unknown;
  try {
    json = JSON.parse(geminiText(response));
  } catch {
    return null;
  }
  const parsed = req.schema.safeParse(json);
  if (!parsed.success) return null;
  return { data: parsed.data as z.infer<T>, usage: geminiUsage(response) };
}
