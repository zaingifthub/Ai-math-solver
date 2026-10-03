import "server-only";
import bcrypt from "bcryptjs";
import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(128, "Password is too long.")
  .refine((p) => /[a-zA-Z]/.test(p) && /\d/.test(p), "Password must contain letters and numbers.");

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

let dummyHash: string | null = null;
/** Run a bcrypt comparison against a dummy hash so unknown emails take similar time (limits account enumeration). */
export async function dummyVerify(password: string) {
  dummyHash ??= await bcrypt.hash("dummy-password-for-timing", 12);
  await bcrypt.compare(password, dummyHash);
}
