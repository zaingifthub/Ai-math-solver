import { NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler, ApiError } from "@/lib/security";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { verifyPassword } from "@/lib/password";

export const GET = apiHandler(async () => {
  const u = await requireUser();
  const user = await prisma.user.findUnique({ where: { id: u.id }, select: { id: true, name: true, email: true, image: true, plan: true, role: true, credits: true, educationLevel: true, createdAt: true, passwordHash: true } });
  if (!user) throw new ApiError(404, "User not found.");
  const { passwordHash, ...rest } = user;
  return NextResponse.json({ user: { ...rest, hasPassword: Boolean(passwordHash) } });
});

const patchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  educationLevel: z.enum(["BEGINNER", "MIDDLE_SCHOOL", "HIGH_SCHOOL", "COLLEGE"]).optional(),
});

export const PATCH = apiHandler(async (req) => {
  const u = await requireUser();
  const data = patchSchema.parse(await req.json());
  const user = await prisma.user.update({ where: { id: u.id }, data, select: { name: true, educationLevel: true } });
  return NextResponse.json({ user });
});

const deleteSchema = z.object({ confirm: z.literal("DELETE"), password: z.string().max(128).optional() });

/** GDPR-style account deletion: removes the user and all owned data (cascade). */
export const DELETE = apiHandler(async (req) => {
  const u = await requireUser();
  const body = deleteSchema.parse(await req.json());
  const user = await prisma.user.findUnique({ where: { id: u.id }, select: { passwordHash: true } });
  if (user?.passwordHash && !(body.password && (await verifyPassword(body.password, user.passwordHash)))) throw new ApiError(403, "Incorrect password.", "BAD_PASSWORD");
  await audit(u.id, "user.delete", "User", u.id);
  await prisma.user.delete({ where: { id: u.id } });
  return NextResponse.json({ ok: true });
});
