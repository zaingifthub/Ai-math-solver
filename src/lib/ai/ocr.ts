import "server-only";
import { z } from "zod";
import { generateStructured } from "./structured";

const OcrSchema = z.object({
  contains_math: z.boolean(),
  problems: z
    .array(
      z.object({
        latex: z.string().describe("The problem exactly as written, in LaTeX"),
        engine_input: z.string().describe("The same problem in plain solver syntax, e.g. 'solve 2x^2 - 3x + 1 = 0' or 'integrate x^2 dx from 0 to 1'"),
        confidence: z.number().describe("0 to 1: how confident you are every symbol was read correctly"),
      }),
    )
    .describe("Each distinct problem visible in the image, in reading order (max 5)"),
  issues: z.string().describe("Anything ambiguous: blurry symbols, cut-off text, handwriting doubts. Empty string if none."),
});

export type OcrResult = z.infer<typeof OcrSchema> & { usage: { input: number; output: number; model: string } };

const SYSTEM = `You are a precise math OCR system. Transcribe math problems from photos and screenshots (printed or handwritten).
- Transcribe exactly; never solve, simplify or "fix" the problem.
- Distinguish carefully: x vs × vs χ, 1 vs l vs |, 0 vs O, 5 vs S, 2 vs z, minus vs dash, exponents vs subscripts.
- Instructions like "Solve", "Simplify", "Find the derivative" belong in engine_input.
- Lower the confidence for any symbol you had to guess.`;

export async function extractMathFromImage(base64: string, mediaType: "image/png" | "image/jpeg" | "image/webp" | "image/gif"): Promise<OcrResult | null> {
  const response = await generateStructured({
    system: SYSTEM,
    text: "Transcribe the math problem(s) in this image.",
    image: { base64, mediaType },
    schema: OcrSchema,
    maxTokens: 3000,
  });
  if (!response) return null;
  const out = response.data;
  return {
    ...out,
    problems: out.problems.slice(0, 5).map((p) => ({ ...p, confidence: Math.max(0, Math.min(1, p.confidence)) })),
    usage: response.usage,
  };
}
