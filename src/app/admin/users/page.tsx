import { redirect } from "next/navigation";
import { UsersTable } from "@/components/admin/users-table";
import { getCurrentUser, hasRole } from "@/lib/auth";

export default async function AdminUsersPage() {
  const user = await getCurrentUser();
  if (!hasRole(user?.role, "ADMIN")) redirect("/admin");
  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Users</h1>
      <UsersTable />
    </div>
  );
}
