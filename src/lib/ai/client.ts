import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { env } from "../env";

export const AI_MODEL = env.AI_MODEL || "claude-opus-5-5";

/**
 * Server-side refusal fallback: if a safety classifier declines a request,
 * the API re-runs it on Anthropic's recommended fallback model in the same call.
 */
export const FALLBACK_BETA = "server-side-fallback-2026-07-01";

const globalForAI = globalThis as unknown as { __anthropic?: Anthropic };

export function aiEnabled() {
  return Boolean(env.ANTHROPIC_API_KEY);
}

export function getClient(): Anthropic {
  if (!env.ANTHROPIC_API_KEY) throw new Error("AI is not configured (ANTHROPIC_API_KEY missing).");
  globalForAI.__anthropic ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 2, timeout: 120_000 });
  return globalForAI.__anthropic;
}

export const LEVEL_GUIDE: Record<string, string> = {
  BEGINNER: "a beginner who needs very simple language, short sentences and concrete everyday analogies",
  MIDDLE_SCHOOL: "a middle-school student (ages 11–14); avoid jargon and explain each operation",
  HIGH_SCHOOL: "a high-school student; use standard terminology and explain the reasoning behind each rule",
  COLLEGE: "a college student; be concise and rigorous, and mention relevant theorems",
};

export function describeAIError(e: unknown): string {
  if (e instanceof Anthropic.RateLimitError) return "The AI service is busy right now. Please try again in a moment.";
  if (e instanceof Anthropic.AuthenticationError) return "AI service authentication failed. Please contact support.";
  if (e instanceof Anthropic.BadRequestError) return "The AI could not process this request.";
  if (e instanceof Anthropic.APIConnectionError) return "Could not reach the AI service. Please try again.";
  if (e instanceof Anthropic.APIError) return "The AI service returned an error. Please try again.";
  return "AI processing failed.";
}

export const MATH_FORMAT_RULES = `Formatting rules:
- Write math in LaTeX: inline as $...$ and display as $$...$$. Never use \\( \\) or \\[ \\].
- Use Markdown for structure (short paragraphs, numbered steps, **bold** for key ideas).
- Use \\ln for natural log and \\log for base-10 log.`;
