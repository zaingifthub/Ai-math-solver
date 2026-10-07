import "server-only";
import { access, mkdir } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { prisma } from "./db";

export interface SystemCheck {
  area: string;
  label: string;
  status: "ok" | "warn" | "error";
  detail: string;
}

/** Production-readiness checks shown in Admin → System (no secrets are ever displayed). */
export async function runSystemChecks(): Promise<SystemCheck[]> {
  const e = process.env;
  const checks: SystemCheck[] = [];
  const add = (area: string, label: string, status: SystemCheck["status"], detail: string) => checks.push({ area, label, status, detail });
  const prod = e.NODE_ENV === "production";
  const site = e.NEXT_PUBLIC_SITE_URL ?? "";

  // Core
  if (!site) add("Core", "Site URL", "error", "NEXT_PUBLIC_SITE_URL is not set — canonical URLs, sitemap and emails will be wrong.");
  else if (prod && !site.startsWith("https://")) add("Core", "Site URL", "warn", `${site} is not HTTPS — HSTS and secure cookies are disabled.`);
  else add("Core", "Site URL", "ok", site);
  if (e.NEXTAUTH_URL && site && new URL(e.NEXTAUTH_URL).origin !== new URL(site).origin) add("Core", "NEXTAUTH_URL", "warn", "NEXTAUTH_URL differs from NEXT_PUBLIC_SITE_URL — OAuth callbacks may fail.");

  // Auth
  const secret = e.NEXTAUTH_SECRET ?? "";
  if (!secret) add("Security", "Session secret", "error", "NEXTAUTH_SECRET is missing — sign-in is disabled.");
  else if (secret.length < 32 || /dev-secret|CHANGE_ME|preview/i.test(secret)) add("Security", "Session secret", "warn", "NEXTAUTH_SECRET looks weak or like a placeholder. Generate one with `openssl rand -base64 32`.");
  else add("Security", "Session secret", "ok", "Set and strong.");
  add("Security", "Cron secret", e.CRON_SECRET && e.CRON_SECRET.length >= 16 && !/CHANGE_ME|dev-/.test(e.CRON_SECRET) ? "ok" : "warn", e.CRON_SECRET ? "Set." : "CRON_SECRET missing — upload cleanup cannot run.");
  const serverless = Boolean(e.VERCEL);
  add("Security", "Rate-limit store", serverless && e.RATE_LIMIT_STORE !== "database" ? "warn" : "ok", serverless && e.RATE_LIMIT_STORE !== "database" ? "Serverless deployment with in-memory rate limits — set RATE_LIMIT_STORE=database." : `${e.RATE_LIMIT_STORE ?? "memory"} store.`);
  add("Auth", "Google sign-in", e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET ? "ok" : "warn", e.GOOGLE_CLIENT_ID ? "Configured." : "Not configured (optional).");
  add("Auth", "Password-reset email", e.SMTP_URL ? "ok" : "warn", e.SMTP_URL ? "SMTP configured." : "SMTP_URL not set — users cannot reset forgotten passwords.");

  // Database
  try {
    await prisma.$queryRaw`SELECT 1`;
    const migrations = await prisma.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*)::bigint AS n FROM "_prisma_migrations" WHERE finished_at IS NOT NULL`;
    add("Database", "Connection", "ok", `Connected · ${Number(migrations[0]?.n ?? 0)} migrations applied.`);
    const [admins, content] = await Promise.all([prisma.user.count({ where: { role: "ADMIN" } }), prisma.blogPost.count()]);
    add("Database", "Admin accounts", admins > 0 ? "ok" : "error", `${admins} admin account(s).`);
    add("Database", "Seed content", content > 0 ? "ok" : "warn", content > 0 ? `${content} blog posts.` : "No CMS content yet — run `npm run db:seed`.");
  } catch (err) {
    add("Database", "Connection", "error", `Cannot reach the database: ${(err as Error).message.split("\n")[0]}`);
  }

  // Integrations
  if (e.ANTHROPIC_API_KEY) add("AI", "AI provider", "ok", `Anthropic Claude, model ${e.AI_MODEL || "claude-opus-5-5"}.`);
  else if (e.GEMINI_API_KEY) add("AI", "AI provider", "ok", `Google Gemini, model ${e.GEMINI_MODEL || "gemini-flash-latest"}.`);
  else add("AI", "AI provider", "warn", "No AI key — set ANTHROPIC_API_KEY or GEMINI_API_KEY to enable AI explanations, tutor, photo scanning and word problems.");
  const stripeReady = e.STRIPE_SECRET_KEY && e.STRIPE_WEBHOOK_SECRET && e.STRIPE_PRICE_PREMIUM_MONTHLY;
  add("Billing", "Stripe", stripeReady ? "ok" : "warn", stripeReady ? `${e.STRIPE_SECRET_KEY!.startsWith("sk_live") ? "Live" : "Test"} mode.` : "Billing not fully configured (secret key, webhook secret and price IDs are required).");
  if (e.STRIPE_SECRET_KEY?.startsWith("sk_test") && prod && site.startsWith("https://")) add("Billing", "Stripe mode", "warn", "Using Stripe TEST keys in production.");

  // Storage
  const dir = serverless ? "/tmp/ams-uploads" : path.resolve(/* turbopackIgnore: true */ e.UPLOAD_DIR ?? "./storage/uploads");
  try {
    await mkdir(dir, { recursive: true });
    await access(dir, constants.W_OK);
    add("Storage", "Upload directory", "ok", serverless ? "Ephemeral /tmp (serverless)." : "Writable.");
  } catch {
    add("Storage", "Upload directory", "error", "Upload directory is not writable — photo scanning will fail.");
  }
  return checks;
}
