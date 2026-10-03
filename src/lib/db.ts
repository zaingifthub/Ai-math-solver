import "server-only";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/** Run a DB query but fall back gracefully when the database is unavailable (e.g. during static builds). */
export async function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  if (!process.env.DATABASE_URL) return fallback;
  try {
    return await fn();
  } catch (e) {
    if (process.env.NODE_ENV !== "production") console.warn("[db] query failed, using fallback:", (e as Error).message);
    return fallback;
  }
}
