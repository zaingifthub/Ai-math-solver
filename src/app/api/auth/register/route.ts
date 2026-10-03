import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiHandler, ApiError, getClientIp } from "@/lib/security";
import { hashPassword, passwordSchema } from "@/lib/password";
import { rateLimit, LIMIT_PRESETS } from "@/lib/rate-limit";
import { adminEmails } from "@/lib/env";
import { audit } from "@/lib/audit";

const schema = z.object({
  name: z.string().trim().min(1, "Please enter your name.").max(80),
  email: z.string().trim().toLowerCase().email("Please enter a valid email.").max(254),
  password: passwordSchema,
  level: z.enum(["BEGINNER", "MIDDLE_SCHOOL", "HIGH_SCHOOL", "COLLEGE"]).optional(),
});

export const POST = apiHandler(async (req) => {
  const rl = await rateLimit(`register:${getClientIp(req)}`, LIMIT_PRESETS.register.limit, LIMIT_PRESETS.register.windowMs);
  if (!rl.ok) throw new ApiError(429, "Too many sign-up attempts. Please try again later.", "RATE_LIMITED");
  const body = schema.parse(await req.json());
  const existing = await prisma.user.findUnique({ where: { email: body.email }, select: { id: true } });
  if (existing) throw new ApiError(409, "An account with this email already exists. Try signing in.", "EMAIL_TAKEN");
  const user = await prisma.user.create({
    data: {
      name: body.name,
      email: body.email,
      passwordHash: await hashPassword(body.password),
      educationLevel: body.level ?? "HIGH_SCHOOL",
      role: adminEmails.includes(body.email) ? "ADMIN" : "USER",
    },
    select: { id: true },
  });
  await audit(user.id, "user.register", "User", user.id);
  return NextResponse.json({ ok: true }, { status: 201 });
});
