import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("server-only", () => ({}));
const { toGeminiSchema, geminiText, geminiUsage } = await import("../src/lib/ai/gemini");

describe("Gemini helpers", () => {
  it("converts Zod schemas to Gemini response schemas", () => {
    const schema = z.object({
      ok: z.boolean(),
      items: z.array(z.object({ latex: z.string().describe("LaTeX"), confidence: z.number() })),
    });
    expect(toGeminiSchema(schema)).toEqual({
      type: "OBJECT",
      properties: {
        ok: { type: "BOOLEAN" },
        items: {
          type: "ARRAY",
          items: { type: "OBJECT", properties: { latex: { type: "STRING", description: "LaTeX" }, confidence: { type: "NUMBER" } }, propertyOrdering: ["latex", "confidence"], required: ["latex", "confidence"] },
        },
      },
      propertyOrdering: ["ok", "items"],
      required: ["ok", "items"],
    });
  });

  it("ignores thought parts and counts thinking tokens as output", () => {
    const r = {
      candidates: [{ content: { parts: [{ text: "secret", thought: true }, { text: "{\"a\":" }, { text: "1}" }] } }],
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, thoughtsTokenCount: 7 },
      modelVersion: "gemini-x",
    };
    expect(geminiText(r)).toBe("{\"a\":1}");
    expect(geminiUsage(r)).toEqual({ input: 10, output: 12, model: "gemini-x" });
  });
});
