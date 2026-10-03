import { NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/lib/security";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const GET = apiHandler(async (req) => {
  await requireRole("ADMIN");
  const page = z.coerce.number().int().min(1).parse(new URL(req.url).searchParams.get("page") ?? "1");
  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, skip: (page - 1) * 50, take: 50, include: { actor: { select: { email: true, name: true } } } }),
    prisma.auditLog.count(),
  ]);
  return NextResponse.json({ items, total, page, perPage: 50 });
});
