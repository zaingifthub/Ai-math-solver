import { NextResponse, type NextRequest } from "next/server";
import { apiHandler, ApiError } from "@/lib/security";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export const GET = apiHandler(async (_req: NextRequest, { params }: Ctx) => {
  const user = await requireUser();
  const { id } = await params;
  const conv = await prisma.tutorConversation.findFirst({ where: { id, userId: user.id }, include: { messages: { orderBy: { createdAt: "asc" } } } });
  if (!conv) throw new ApiError(404, "Conversation not found.", "NOT_FOUND");
  return NextResponse.json({ conversation: { id: conv.id, title: conv.title, messages: conv.messages.map((m) => ({ role: m.role, content: m.content })) } });
});

export const DELETE = apiHandler(async (_req: NextRequest, { params }: Ctx) => {
  const user = await requireUser();
  const { id } = await params;
  await prisma.tutorConversation.deleteMany({ where: { id, userId: user.id } });
  return NextResponse.json({ ok: true });
});
