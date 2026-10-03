import { NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/lib/security";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { LIMITS } from "@/lib/plans";

export const GET = apiHandler(async (req) => {
  const user = await requireUser();
  const url = new URL(req.url);
  const page = z.coerce.number().int().min(1).max(1000).parse(url.searchParams.get("page") ?? "1");
  const q = url.searchParams.get("q")?.slice(0, 100) ?? "";
  const category = url.searchParams.get("category")?.slice(0, 40) ?? "";
  const since = new Date(Date.now() - LIMITS[user.plan].historyDays * 86_400_000);
  const where = {
    userId: user.id,
    createdAt: { gte: since },
    ...(q ? { input: { contains: q, mode: "insensitive" as const } } : {}),
    ...(category ? { category } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.problem.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * 20, take: 20, select: { id: true, input: true, answer: true, category: true, topic: true, verified: true, source: true, createdAt: true, bookmarks: { where: { userId: user.id }, select: { id: true } } } }),
    prisma.problem.count({ where }),
  ]);
  return NextResponse.json({ items: items.map(({ bookmarks, ...i }) => ({ ...i, bookmarked: bookmarks.length > 0 })), total, page, pages: Math.ceil(total / 20) });
});

export const DELETE = apiHandler(async () => {
  const user = await requireUser();
  await prisma.problem.deleteMany({ where: { userId: user.id } });
  return NextResponse.json({ ok: true });
});
