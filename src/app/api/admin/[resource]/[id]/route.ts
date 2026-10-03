import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { apiHandler, ApiError } from "@/lib/security";
import { requireRole } from "@/lib/auth";
import { RESOURCES } from "@/lib/admin-resources";
import { audit } from "@/lib/audit";

type Ctx = { params: Promise<{ resource: string; id: string }> };

async function load(ctx: Ctx) {
  const { resource, id } = await ctx.params;
  const def = RESOURCES[resource];
  if (!def) throw new ApiError(404, "Unknown resource.", "NOT_FOUND");
  return { def, resource, id, where: { [def.idField ?? "id"]: id } };
}

export const GET = apiHandler(async (_req: NextRequest, ctx: Ctx) => {
  const { def, where } = await load(ctx);
  await requireRole(def.role);
  const item = await def.delegate().findUnique({ where });
  if (!item) throw new ApiError(404, "Not found.", "NOT_FOUND");
  return NextResponse.json({ item });
});

export const PATCH = apiHandler(async (req: NextRequest, ctx: Ctx) => {
  const { def, resource, id, where } = await load(ctx);
  const user = await requireRole(def.role);
  const existing = await def.delegate().findUnique({ where });
  if (!existing) throw new ApiError(404, "Not found.", "NOT_FOUND");
  const body = (await req.json()) as Record<string, unknown>;
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new ApiError(400, "Invalid body.", "VALIDATION");
  const parsed = (def.schema as unknown as { partial: () => { parse: (x: unknown) => Record<string, unknown> } }).partial().parse(body);
  // .partial() keeps .default() values for missing keys — keep only the fields the client actually sent.
  let data = Object.fromEntries(Object.entries(parsed).filter(([k]) => k in body));
  if (Object.keys(data).length === 0) throw new ApiError(400, "Nothing to update.", "VALIDATION");
  if (def.prepare) data = def.prepare({ ...data, status: data.status ?? existing.status }, existing);
  try {
    const row = await def.delegate().update({ where, data });
    await audit(user.id, `${resource}.update`, resource, id, { fields: Object.keys(data) });
    [...def.revalidate(existing), ...def.revalidate(row)].forEach((p) => revalidatePath(p));
    return NextResponse.json({ item: row });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") throw new ApiError(409, "An item with this slug/key already exists.", "DUPLICATE");
    throw e;
  }
});

export const DELETE = apiHandler(async (_req: NextRequest, ctx: Ctx) => {
  const { def, resource, id, where } = await load(ctx);
  const user = await requireRole(def.role === "EDITOR" ? "ADMIN" : def.role);
  const existing = await def.delegate().findUnique({ where });
  if (!existing) throw new ApiError(404, "Not found.", "NOT_FOUND");
  await def.delegate().delete({ where });
  await audit(user.id, `${resource}.delete`, resource, id, { slug: existing.slug ?? existing.path ?? null });
  def.revalidate(existing).forEach((p) => revalidatePath(p));
  return NextResponse.json({ ok: true });
});
