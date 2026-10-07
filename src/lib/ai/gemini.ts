import "server-only";
import { z } from "zod";
import { env } from "../env";

/** Minimal Google Gemini REST client (generateContent + SSE streaming). */

export const GEMINI_MODEL = env.GEMINI_MODEL || "gemini-flash-latest";
const BASE_URL = (env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com").replace(/\/+$/, "");

export class GeminiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "GeminiError";
  }
}

export type GeminiPart =
  | { text: string; thought?: boolean; thoughtSignature?: string }
  | { inlineData: { mimeType: string; data: string } }
  | { functionCall: { name: string; args?: Record<string, unknown>; id?: string }; thoughtSignature?: string }
  | { functionResponse: { name: string; response: Record<string, unknown>; id?: string } };

export interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

export interface GeminiResponse {
  candidates?: { content?: { parts?: GeminiPart[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
  modelVersion?: string;
}

/** Finish reasons that mean the model declined the request. */
export const GEMINI_BLOCKED = new Set(["SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII", "RECITATION", "IMAGE_SAFETY"]);

export function geminiUsage(r: GeminiResponse | undefined) {
  const u = r?.usageMetadata;
  return {
    input: u?.promptTokenCount ?? 0,
    output: (u?.candidatesTokenCount ?? 0) + (u?.thoughtsTokenCount ?? 0),
    model: r?.modelVersion || GEMINI_MODEL,
  };
}

function endpoint(method: "generateContent" | "streamGenerateContent") {
  return `${BASE_URL}/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:${method}${method === "streamGenerateContent" ? "?alt=sse" : ""}`;
}

async function post(method: "generateContent" | "streamGenerateContent", body: unknown, signal?: AbortSignal): Promise<Response> {
  if (!env.GEMINI_API_KEY) throw new Error("AI is not configured (GEMINI_API_KEY missing).");
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    let res: Response;
    try {
      res = await fetch(endpoint(method), {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
        body: JSON.stringify(body),
        signal: signal ?? AbortSignal.timeout(120_000),
      });
    } catch (e) {
      if (signal?.aborted) throw e;
      lastError = new GeminiError(0, `Could not reach Gemini: ${(e as Error).message}`);
      await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
      continue;
    }
    if (res.ok) return res;
    const detail = await res.text().catch(() => "");
    let message = detail.slice(0, 500);
    try {
      message = (JSON.parse(detail) as { error?: { message?: string } }).error?.message ?? message;
    } catch {}
    lastError = new GeminiError(res.status, message || `HTTP ${res.status}`);
    // Retry only transient failures.
    if (res.status !== 429 && res.status < 500) break;
    await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
  }
  throw lastError;
}

export async function geminiGenerate(body: Record<string, unknown>, signal?: AbortSignal): Promise<GeminiResponse> {
  const res = await post("generateContent", body, signal);
  return (await res.json()) as GeminiResponse;
}

/** Streams generateContent chunks (server-sent events). */
export async function* geminiStream(body: Record<string, unknown>, signal?: AbortSignal): AsyncGenerator<GeminiResponse> {
  const res = await post("streamGenerateContent", body, signal);
  if (!res.body) return;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.search(/\r?\n\r?\n/)) !== -1) {
      const event = buffer.slice(0, idx);
      buffer = buffer.slice(idx).replace(/^\r?\n\r?\n/, "");
      const data = event
        .split(/\r?\n/)
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trimStart())
        .join("\n");
      if (data) yield JSON.parse(data) as GeminiResponse;
    }
  }
  const tail = buffer.trim();
  if (tail.startsWith("data:")) yield JSON.parse(tail.slice(5).trimStart()) as GeminiResponse;
}

type JsonSchema = { type?: string | string[]; properties?: Record<string, JsonSchema>; items?: JsonSchema; required?: string[]; description?: string; enum?: unknown[] };

/** Converts a Zod schema into Gemini's OpenAPI-style response schema (supported by every Gemini model). */
export function toGeminiSchema(schema: z.ZodType): Record<string, unknown> {
  const convert = (s: JsonSchema): Record<string, unknown> => {
    const type = Array.isArray(s.type) ? s.type.find((t) => t !== "null") : s.type;
    const out: Record<string, unknown> = { type: (type ?? "string").toUpperCase() };
    if (s.description) out.description = s.description;
    if (s.enum) out.enum = s.enum.map(String);
    if (s.properties) {
      out.properties = Object.fromEntries(Object.entries(s.properties).map(([k, v]) => [k, convert(v)]));
      out.propertyOrdering = Object.keys(s.properties);
    }
    if (s.required?.length) out.required = s.required;
    if (s.items) out.items = convert(s.items);
    return out;
  };
  return convert(z.toJSONSchema(schema) as JsonSchema);
}

/** Text of a response, excluding thought summaries. */
export function geminiText(r: GeminiResponse): string {
  return (r.candidates?.[0]?.content?.parts ?? [])
    .map((p) => ("text" in p && !p.thought ? p.text : ""))
    .join("");
}
