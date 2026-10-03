import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/security";
import { requireRole } from "@/lib/auth";
import { getAdminStats } from "@/lib/admin-stats";

export const GET = apiHandler(async () => {
  await requireRole("EDITOR");
  return NextResponse.json(await getAdminStats());
});
