import { NextResponse, type NextRequest } from "next/server";
import { apiHandler, ApiError } from "@/lib/security";
import { getActor } from "@/lib/usage";
import { prisma } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

/** A solved problem is visible to its owner (user or guest session). */
export const GET = apiHandler(async (_req: NextRequest, { params }: Ctx) => {
  const { id } = await params;
  const actor = await getActor();
  const p = await prisma.problem.findUnique({ where: { id } });
  if (!p || (p.userId ? p.userId !== actor.userId : p.guestId !== actor.guestId)) throw new ApiError(404, "Problem not found.", "NOT_FOUND");
  return NextResponse.json({ problem: { ...(p.result as object), id: p.id } });
});

export const DELETE = apiHandler(async (_req: NextRequest, { params }: Ctx) => {
  const { id } = await params;
  const actor = await getActor();
  if (!actor.userId) throw new ApiError(401, "Please sign in.", "UNAUTHORIZED");
  await prisma.problem.deleteMany({ where: { id, userId: actor.userId } });
  return NextResponse.json({ ok: true });
});
