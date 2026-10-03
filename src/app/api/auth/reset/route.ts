import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiHandler, ApiError, getClientIp } from "@/lib/security";
import { rateLimit } from "@/lib/rate-limit";
import { hashPassword, passwordSchema } from "@/lib/password";
import { audit } from "@/lib/audit";

const schema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  token: z.string().regex(/^[a-f0-9]{64}$/, "Invalid or expired reset link."),
  password: passwordSchema,
});

export const POST = apiHandler(async (req) => {
  const rl = await rateLimit(`reset:${getClientIp(req)}`, 10, 60 * 60_000);
  if (!rl.ok) throw new ApiError(429, "Too many attempts. Please try again later.", "RATE_LIMITED");
  const { email, token, password } = schema.parse(await req.json());
  const identifier = `reset:${email}`;
  const stored = await prisma.verificationToken.findFirst({ where: { identifier } });
  const hash = createHash("sha256").update(token).digest("hex");
  const valid = stored && stored.expires > new Date() && timingSafeEqual(Buffer.from(stored.token), Buffer.from(hash));
  if (!valid) throw new ApiError(400, "This reset link is invalid or has expired. Please request a new one.", "BAD_TOKEN");
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) throw new ApiError(400, "This reset link is invalid or has expired.", "BAD_TOKEN");
  await prisma.$transaction([
    // Clicking the emailed link proves ownership of the address
    prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(password), emailVerified: new Date(), failedLogins: 0, lockedUntil: null } }),
    prisma.verificationToken.deleteMany({ where: { identifier } }),
    prisma.session.deleteMany({ where: { userId: user.id } }),
  ]);
  await audit(user.id, "user.password_reset", "User", user.id);
  return NextResponse.json({ ok: true });
});
