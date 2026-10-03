import { NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler, ApiError } from "@/lib/security";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword, passwordSchema } from "@/lib/password";
import { audit } from "@/lib/audit";

const schema = z.object({ current: z.string().max(128).optional(), next: passwordSchema });

export const POST = apiHandler(async (req) => {
  const u = await requireUser();
  const body = schema.parse(await req.json());
  const user = await prisma.user.findUnique({ where: { id: u.id }, select: { passwordHash: true } });
  if (user?.passwordHash && !(body.current && (await verifyPassword(body.current, user.passwordHash)))) throw new ApiError(403, "Your current password is incorrect.", "BAD_PASSWORD");
  await prisma.user.update({ where: { id: u.id }, data: { passwordHash: await hashPassword(body.next) } });
  await audit(u.id, "user.password_change", "User", u.id);
  return NextResponse.json({ ok: true });
});
