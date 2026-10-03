import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/security";
import { requireUser } from "@/lib/auth";
import { getProgress } from "@/lib/progress";

export const GET = apiHandler(async () => {
  const user = await requireUser();
  return NextResponse.json(await getProgress(user.id));
});
