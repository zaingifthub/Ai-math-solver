import type { DefaultSession } from "next-auth";
import type { Role, Plan, EducationLevel } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: Role;
      plan: Plan;
      level: EducationLevel;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: Role;
    plan?: Plan;
    level?: EducationLevel;
    refreshedAt?: number;
    disabled?: boolean;
  }
}
