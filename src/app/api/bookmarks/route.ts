import { NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler, ApiError } from "@/lib/security";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const GET = apiHandler(async () => {
  const user = await requireUser();
  const items = await prisma.bookmark.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 200, include: { problem: { select: { id: true, input: true, answer: true, category: true, topic: true, createdAt: true } } } });
  return NextResponse.json({ items });
});

const schema = z.object({ problemId: z.string().min(1).max(40), note: z.string().max(1000).optional() });

export const POST = apiHandler(async (req) => {
  const user = await requireUser();
  const body = schema.parse(await req.json());
  const problem = await prisma.problem.findFirst({ where: { id: body.problemId, userId: user.id }, select: { id: true } });
  if (!problem) throw new ApiError(404, "Problem not found in your history.", "NOT_FOUND");
  const bookmark = await prisma.bookmark.upsert({
    where: { userId_problemId: { userId: user.id, problemId: body.problemId } },
    create: { userId: user.id, problemId: body.problemId, note: body.note },
    update: { note: body.note },
  });
  return NextResponse.json({ bookmark }, { status: 201 });
});
