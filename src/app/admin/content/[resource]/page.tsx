import { notFound, redirect } from "next/navigation";
import { ResourceManager } from "@/components/admin/resource-manager";
import { RESOURCES } from "@/lib/admin-resources";
import { getCurrentUser, hasRole } from "@/lib/auth";

export default async function AdminResourcePage({ params }: { params: Promise<{ resource: string }> }) {
  const { resource } = await params;
  const def = RESOURCES[resource];
  if (!def) notFound();
  const user = await getCurrentUser();
  if (!hasRole(user?.role, def.role)) redirect("/admin");
  return <ResourceManager resource={resource} />;
}
