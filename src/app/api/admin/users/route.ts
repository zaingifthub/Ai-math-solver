import { NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/lib/security";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const GET = apiHandler(async (req) => {
  await requireRole("ADMIN");
  const url = new URL(req.url);
  const page = z.coerce.number().int().min(1).parse(url.searchParams.get("page") ?? "1");
  const q = (url.searchParams.get("q") ?? "").slice(0, 100);
  const plan = url.searchParams.get("plan");
  const where = {
    ...(q ? { OR: [{ email: { contains: q, mode: "insensitive" as const } }, { name: { contains: q, mode: "insensitive" as const } }] } : {}),
    ...(plan && ["FREE", "PREMIUM", "EDUCATION"].includes(plan) ? { plan: plan as "FREE" } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.user.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * 25, take: 25, select: { id: true, name: true, email: true, role: true, plan: true, status: true, credits: true, createdAt: true, lastLoginAt: true, _count: { select: { problems: true } } } }),
    prisma.user.count({ where }),
  ]);
  return NextResponse.json({ items, total, page, perPage: 25 });
});
