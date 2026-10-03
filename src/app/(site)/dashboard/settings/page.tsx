import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SettingsForms } from "@/components/dashboard/settings-forms";

export default async function SettingsPage() {
  const u = (await getCurrentUser())!;
  const user = await prisma.user.findUniqueOrThrow({ where: { id: u.id }, select: { name: true, email: true, educationLevel: true, passwordHash: true } });
  return (
    <div>
      <h1 className="mb-6 text-3xl font-semibold tracking-tight">Settings</h1>
      <SettingsForms user={{ name: user.name, email: user.email, educationLevel: user.educationLevel, hasPassword: Boolean(user.passwordHash) }} />
    </div>
  );
}
