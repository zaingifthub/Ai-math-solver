import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiHandler, ApiError } from "@/lib/security";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  role: z.enum(["USER", "EDITOR", "ADMIN"]).optional(),
  plan: z.enum(["FREE", "PREMIUM", "EDUCATION"]).optional(),
  status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
  credits: z.coerce.number().int().min(0).max(1_000_000).optional(),
});

export const PATCH = apiHandler(async (req: NextRequest, { params }: Ctx) => {
  const admin = await requireRole("ADMIN");
  const { id } = await params;
  const data = schema.parse(await req.json());
  if (id === admin.id && (data.role && data.role !== "ADMIN" || data.status === "SUSPENDED")) throw new ApiError(400, "You cannot demote or suspend your own account.", "SELF_LOCKOUT");
  const before = await prisma.user.findUnique({ where: { id }, select: { role: true, plan: true, status: true, credits: true } });
  if (!before) throw new ApiError(404, "User not found.", "NOT_FOUND");
  const user = await prisma.user.update({ where: { id }, data, select: { id: true, role: true, plan: true, status: true, credits: true } });
  if (data.status === "SUSPENDED") await prisma.session.deleteMany({ where: { userId: id } });
  await audit(admin.id, "admin.user_update", "User", id, { before, after: data });
  return NextResponse.json({ user });
});

export const DELETE = apiHandler(async (_req: NextRequest, { params }: Ctx) => {
  const admin = await requireRole("ADMIN");
  const { id } = await params;
  if (id === admin.id) throw new ApiError(400, "You cannot delete your own account here.", "SELF_LOCKOUT");
  await prisma.user.delete({ where: { id } });
  await audit(admin.id, "admin.user_delete", "User", id);
  return NextResponse.json({ ok: true });
});
