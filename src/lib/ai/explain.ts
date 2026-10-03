import "server-only";
import { z } from "zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { SolveResult, AIEnhancement } from "../math/types";
import { getClient, AI_MODEL, FALLBACK_BETA, LEVEL_GUIDE, MATH_FORMAT_RULES } from "./client";

const EnhancementSchema = z.object({
  explanation: z.string().describe("Student-friendly walkthrough of WHY each step works, in Markdown with LaTeX."),
  alternative: z.string().describe("A different valid method to reach the same answer, in Markdown with LaTeX. Empty string if none is sensible."),
  tips: z.array(z.string()).describe("2-4 short study tips relevant to this problem type."),
  common_mistakes: z.array(z.string()).describe("2-4 common mistakes students make on this type of problem."),
  restated_answer: z.string().describe("The final answer exactly as given by the verified solution, in plain text."),
});

const SYSTEM = `You are an expert, warm and precise math teacher working inside the "AI Math Solver" platform.
You receive a problem together with a solution produced and VERIFIED by a deterministic math engine (exact symbolic computation plus independent numerical checks).

Hard rules:
- The engine's final answer is authoritative. Never change it, never contradict it, never introduce a different result.
- Do not invent new numbers for intermediate steps that conflict with the engine steps; explain the engine's steps.
- If you notice something that looks off, explain the engine's answer anyway; do not "correct" it.
- Be accurate and concise. No filler, no greetings.

${MATH_FORMAT_RULES}`;

export async function enhanceSolution(result: SolveResult, level: string): Promise<{ enhancement: AIEnhancement; usage: { input: number; output: number; model: string } } | null> {
  const client = getClient();
  const payload = {
    problem: result.input,
    interpreted_latex: result.interpreted,
    topic: result.topic,
    final_answer: result.answer.text,
    final_answer_latex: result.answer.latex,
    steps: result.steps.map((s) => ({ title: s.title, latex: s.latex, note: s.text })),
    formulas: result.formulas,
    verification: result.verification,
  };
  const response = await client.beta.messages.parse({
    model: AI_MODEL,
    max_tokens: 6000,
    betas: [FALLBACK_BETA],
    fallbacks: "default",
    output_config: { effort: "low", format: betaZodOutputFormat(EnhancementSchema) },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `Explain this verified solution for ${LEVEL_GUIDE[level] ?? LEVEL_GUIDE.HIGH_SCHOOL}.\n\n<solution>\n${JSON.stringify(payload, null, 1)}\n</solution>`,
      },
    ],
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) return null;
  const out = response.parsed_output;
  // Guard: if the model restated a numerically different answer, discard the AI layer.
  const engineNum = Number(result.answer.text.replace(/^[a-z]\s*=\s*/i, ""));
  const aiNum = Number(out.restated_answer.replace(/^[a-z]\s*=\s*/i, ""));
  if (Number.isFinite(engineNum) && Number.isFinite(aiNum) && Math.abs(engineNum - aiNum) > 1e-6 * Math.max(1, Math.abs(engineNum))) return null;
  return {
    enhancement: {
      explanation: out.explanation,
      alternative: out.alternative || undefined,
      tips: out.tips.slice(0, 4),
      commonMistakes: out.common_mistakes.slice(0, 4),
      model: response.model,
    },
    usage: { input: response.usage.input_tokens, output: response.usage.output_tokens, model: response.model },
  };
}
