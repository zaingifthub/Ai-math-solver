import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { getClient, AI_MODEL, FALLBACK_BETA, LEVEL_GUIDE, MATH_FORMAT_RULES, aiProvider } from "./client";
import { geminiStream, geminiUsage, GEMINI_BLOCKED, GEMINI_MODEL, type GeminiContent, type GeminiPart } from "./gemini";
import { solve } from "../math/engine";

export type TutorMode = "chat" | "explain-step" | "simplify" | "hint" | "another-method" | "examples" | "practice" | "check-work" | "teach";

const MODE_INSTRUCTIONS: Record<TutorMode, string> = {
  chat: "Answer the student's question as a patient tutor.",
  "explain-step": "Explain the specific step the student asks about: what was done, and why it is allowed.",
  simplify: "Re-explain the idea in the simplest possible words, with an everyday analogy.",
  hint: "Give ONE small hint that moves the student forward. Do NOT reveal the final answer.",
  "another-method": "Show a different method than the one already used, step by step.",
  examples: "Create 2 worked examples of the same type, increasing in difficulty.",
  practice: "Create 3 practice questions of the same type with answers hidden in a final 'Answers' section.",
  "check-work": "The student shares their work. Find the first mistake (if any), explain it kindly, and show the correction.",
  teach: "Teach the underlying concept from first principles with a short lesson, then a quick check question.",
};

const SolveInput = z.object({ problem: z.string().min(1).max(500) });

const solveTool: Anthropic.Beta.BetaTool = {
  name: "solve_math",
  description:
    "Solve or evaluate a math problem with the platform's verified deterministic math engine (exact symbolic algebra and calculus with numerical verification). Use it to compute or check every numeric or symbolic result before stating it. Input examples: '2x+5=17', 'derivative of x^2 sin(x)', 'integrate x^2 dx from 0 to 1', 'factor x^2-5x+6', 'x+y=10; x-y=2', 'mean of 1,2,3'.",
  input_schema: {
    type: "object",
    properties: { problem: { type: "string", description: "The math problem in plain solver syntax" } },
    required: ["problem"],
    additionalProperties: false,
  },
  strict: true,
  eager_input_streaming: true,
};

export interface TutorMessage {
  role: "user" | "assistant";
  content: string;
}

export type TutorEvent = { type: "text"; text: string } | { type: "tool"; problem: string; answer?: string; error?: string } | { type: "done"; usage: { input: number; output: number; model: string } };

function systemPrompt(level: string, mode: TutorMode, context?: string) {
  return `You are the AI Math Tutor of "AI Math Solver". You help students genuinely understand math, tailored to ${LEVEL_GUIDE[level] ?? LEVEL_GUIDE.HIGH_SCHOOL}.

Accuracy policy: never rely on mental arithmetic for anything non-trivial. Call the solve_math tool to compute or verify results (equations, derivatives, integrals, limits, simplifications, statistics) and base your answer on its verified output. If the tool reports an error, say what you can and ask a clarifying question rather than guessing.

Teaching style: Socratic when helpful, encouraging, precise. Keep answers focused; prefer short numbered steps. Only discuss mathematics and studying; politely steer other topics back to math.

${MATH_FORMAT_RULES}

Current mode: ${MODE_INSTRUCTIONS[mode]}${context ? `\n\nThe student is looking at this solved problem (verified by the engine):\n<context>\n${context.slice(0, 6000)}\n</context>` : ""}`;
}

const REFUSAL_TEXT = "\n\nI can't help with that request. Let's get back to math — what would you like to work on?";

/** Runs the math engine for a solve_math tool call. */
async function runSolveTool(input: unknown): Promise<{ event?: TutorEvent; content: string; isError: boolean }> {
  const parsed = SolveInput.safeParse(input);
  if (!parsed.success) return { content: "INVALID_INPUT: provide {\"problem\": string}", isError: true };
  try {
    const r = await solve(parsed.data.problem, { includeSimilar: false });
    return {
      event: { type: "tool", problem: parsed.data.problem, answer: r.answer.text },
      content: JSON.stringify({
        interpreted: r.interpreted,
        answer: r.answer.text,
        answer_latex: r.answer.latex,
        verification: r.verification.status,
        steps: r.steps.slice(0, 12).map((s) => `${s.title}: ${s.latex ?? s.text ?? ""}`),
      }),
      isError: false,
    };
  } catch (e) {
    return { event: { type: "tool", problem: parsed.data.problem, error: (e as Error).message }, content: (e as Error).message, isError: true };
  }
}

type TutorOptions = { level: string; mode: TutorMode; context?: string; signal?: AbortSignal };

/** Streams a tutor reply, running the math engine for any tool calls (agentic loop, max 5 rounds). */
export async function* tutorStream(history: TutorMessage[], opts: TutorOptions): AsyncGenerator<TutorEvent> {
  if (aiProvider() === "gemini") {
    yield* geminiTutorStream(history, opts);
    return;
  }
  const client = getClient();
  const messages: Anthropic.Beta.BetaMessageParam[] = history.map((m) => ({ role: m.role, content: m.content }));
  let inputTokens = 0;
  let outputTokens = 0;
  let model = AI_MODEL;
  const system = systemPrompt(opts.level, opts.mode, opts.context);

  for (let round = 0; round < 5; round++) {
    const stream = client.beta.messages.stream(
      {
        model: AI_MODEL,
        max_tokens: 16000,
        betas: [FALLBACK_BETA],
        fallbacks: "default",
        output_config: { effort: "medium" },
        system,
        tools: [solveTool],
        messages,
      },
      { signal: opts.signal },
    );
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") yield { type: "text", text: event.delta.text };
    }
    const final = await stream.finalMessage();
    inputTokens += final.usage.input_tokens;
    outputTokens += final.usage.output_tokens;
    model = final.model;
    if (final.stop_reason === "refusal") {
      yield { type: "text", text: REFUSAL_TEXT };
      break;
    }
    if (final.stop_reason === "max_tokens") break;
    if (final.stop_reason !== "tool_use") break;

    // Append-only history: keep the assistant turn exactly as returned.
    messages.push({ role: "assistant", content: final.content });
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const block of final.content) {
      if (block.type !== "tool_use") continue;
      const r = await runSolveTool(block.input);
      if (r.event) yield r.event;
      results.push({ type: "tool_result", tool_use_id: block.id, content: r.content, ...(r.isError ? { is_error: true } : {}) });
    }
    messages.push({ role: "user", content: results });
  }
  yield { type: "done", usage: { input: inputTokens, output: outputTokens, model } };
}

const geminiSolveTool = {
  functionDeclarations: [
    {
      name: solveTool.name,
      description: solveTool.description,
      parameters: { type: "OBJECT", properties: { problem: { type: "STRING", description: "The math problem in plain solver syntax" } }, required: ["problem"] },
    },
  ],
};

async function* geminiTutorStream(history: TutorMessage[], opts: TutorOptions): AsyncGenerator<TutorEvent> {
  const contents: GeminiContent[] = history.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
  let inputTokens = 0;
  let outputTokens = 0;
  let model = GEMINI_MODEL;
  const system = systemPrompt(opts.level, opts.mode, opts.context);

  for (let round = 0; round < 5; round++) {
    // Keep every part the model returns (including thought signatures) for the next round.
    const modelParts: GeminiPart[] = [];
    let finish: string | undefined;
    let blocked = false;
    let last: Parameters<typeof geminiUsage>[0];
    for await (const chunk of geminiStream(
      { systemInstruction: { parts: [{ text: system }] }, contents, tools: [geminiSolveTool], generationConfig: { maxOutputTokens: 16000 } },
      opts.signal,
    )) {
      if (chunk.promptFeedback?.blockReason) blocked = true;
      const candidate = chunk.candidates?.[0];
      for (const part of candidate?.content?.parts ?? []) {
        modelParts.push(part);
        if ("text" in part && part.text && !part.thought) yield { type: "text", text: part.text };
      }
      if (candidate?.finishReason) finish = candidate.finishReason;
      if (chunk.usageMetadata) last = chunk;
    }
    const usage = geminiUsage(last);
    inputTokens += usage.input;
    outputTokens += usage.output;
    model = usage.model;
    if (blocked || (finish && GEMINI_BLOCKED.has(finish))) {
      yield { type: "text", text: REFUSAL_TEXT };
      break;
    }
    const calls = modelParts.filter((p): p is Extract<GeminiPart, { functionCall: unknown }> => "functionCall" in p);
    if (calls.length === 0 || finish === "MAX_TOKENS") break;

    contents.push({ role: "model", parts: modelParts });
    const responses: GeminiPart[] = [];
    for (const { functionCall } of calls) {
      const r = functionCall.name === solveTool.name ? await runSolveTool(functionCall.args) : { content: `Unknown tool ${functionCall.name}`, isError: true };
      if ("event" in r && r.event) yield r.event;
      responses.push({
        functionResponse: {
          name: functionCall.name,
          ...(functionCall.id ? { id: functionCall.id } : {}),
          response: r.isError ? { error: r.content } : { result: r.content },
        },
      });
    }
    contents.push({ role: "user", parts: responses });
  }
  yield { type: "done", usage: { input: inputTokens, output: outputTokens, model } };
}
