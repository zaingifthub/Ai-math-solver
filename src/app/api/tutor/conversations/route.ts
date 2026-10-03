import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/security";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const GET = apiHandler(async () => {
  const user = await requireUser();
  const conversations = await prisma.tutorConversation.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" }, take: 50, select: { id: true, title: true, updatedAt: true } });
  return NextResponse.json({ conversations });
});
