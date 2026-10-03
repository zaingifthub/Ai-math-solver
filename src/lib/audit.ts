import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { requestMeta } from "./security";

export async function audit(actorId: string | null | undefined, action: string, entityType: string, entityId?: string | null, metadata?: Prisma.InputJsonValue) {
  try {
    const meta = await requestMeta().catch(() => ({ ip: undefined, userAgent: undefined }));
    await prisma.auditLog.create({
      data: { actorId: actorId ?? null, action, entityType, entityId: entityId ?? null, metadata, ip: meta.ip, userAgent: meta.userAgent },
    });
  } catch (e) {
    console.error("[audit] failed to write audit log", e);
  }
}
