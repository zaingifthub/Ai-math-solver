import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { apiHandler, ApiError } from "@/lib/security";
import { requireRole } from "@/lib/auth";
import { RESOURCES } from "@/lib/admin-resources";
import { audit } from "@/lib/audit";

type Ctx = { params: Promise<{ resource: string }> };

function resolve(name: string) {
  const r = RESOURCES[name];
  if (!r) throw new ApiError(404, "Unknown resource.", "NOT_FOUND");
  return r;
}

export const GET = apiHandler(async (req: NextRequest, { params }: Ctx) => {
  const def = resolve((await params).resource);
  await requireRole(def.role);
  const url = new URL(req.url);
  const page = z.coerce.number().int().min(1).max(10_000).parse(url.searchParams.get("page") ?? "1");
  const perPage = z.coerce.number().int().min(1).max(100).parse(url.searchParams.get("perPage") ?? "25");
  const q = (url.searchParams.get("q") ?? "").slice(0, 100);
  const where = q ? { OR: def.search.map((f) => ({ [f]: { contains: q, mode: "insensitive" } })) } : {};
  const [items, total] = await Promise.all([
    def.delegate().findMany({ where, orderBy: def.orderBy, skip: (page - 1) * perPage, take: perPage, ...(def.include ? { include: def.include } : {}) }),
    def.delegate().count({ where }),
  ]);
  return NextResponse.json({ items, total, page, perPage });
});

export const POST = apiHandler(async (req: NextRequest, { params }: Ctx) => {
  const name = (await params).resource;
  const def = resolve(name);
  const user = await requireRole(def.role);
  let data = def.schema.parse(await req.json()) as Record<string, unknown>;
  if (def.prepare) data = def.prepare(data, null);
  if (name === "posts") data.authorId = user.id;
  try {
    const row = await def.delegate().create({ data });
    await audit(user.id, `${name}.create`, name, String(row[def.idField ?? "id"]), { slug: row.slug ?? row.path ?? row.key ?? null });
    def.revalidate(row).forEach((p) => revalidatePath(p));
    return NextResponse.json({ item: row }, { status: 201 });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") throw new ApiError(409, "An item with this slug/key already exists.", "DUPLICATE");
    throw e;
  }
});
