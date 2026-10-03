import { NextResponse, type NextRequest } from "next/server";
import { apiHandler } from "@/lib/security";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

/** Delete by bookmark id or by problem id. */
export const DELETE = apiHandler(async (_req: NextRequest, { params }: Ctx) => {
  const user = await requireUser();
  const { id } = await params;
  await prisma.bookmark.deleteMany({ where: { userId: user.id, OR: [{ id }, { problemId: id }] } });
  return NextResponse.json({ ok: true });
});
