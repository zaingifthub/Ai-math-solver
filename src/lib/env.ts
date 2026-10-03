import "server-only";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().optional(),
  NEXTAUTH_SECRET: z.string().optional(),
  NEXTAUTH_URL: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  ADMIN_EMAILS: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  AI_MODEL: z.string().optional(),
  UPLOAD_DIR: z.string().default("./storage/uploads"),
  UPLOAD_MAX_BYTES: z.coerce.number().int().positive().default(5 * 1024 * 1024),
  UPLOAD_TTL_HOURS: z.coerce.number().positive().default(24),
  CRON_SECRET: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_PREMIUM_MONTHLY: z.string().optional(),
  STRIPE_PRICE_PREMIUM_YEARLY: z.string().optional(),
  STRIPE_PRICE_EDUCATION_MONTHLY: z.string().optional(),
  STRIPE_PRICE_EDUCATION_YEARLY: z.string().optional(),
  RATE_LIMIT_STORE: z.enum(["memory", "database"]).default("memory"),
  SMTP_URL: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
});

export const env = schema.parse(process.env);

export const adminEmails = (env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export const features = {
  ai: Boolean(env.ANTHROPIC_API_KEY),
  google: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
  stripe: Boolean(env.STRIPE_SECRET_KEY),
  database: Boolean(env.DATABASE_URL),
  auth: Boolean(env.NEXTAUTH_SECRET) && Boolean(env.DATABASE_URL),
};
