import "server-only";
import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import type { Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "./db";
import { env, adminEmails, features } from "./env";
import { verifyPassword, dummyVerify } from "./password";
import { rateLimit, LIMIT_PRESETS } from "./rate-limit";
import { ApiError, ipFromHeaders } from "./security";

const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;
const TOKEN_REFRESH_MS = 5 * 60 * 1000;

const credentialsSchema = z.object({
  email: z.string().email().max(254).transform((e) => e.toLowerCase().trim()),
  password: z.string().min(1).max(128),
});

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  secret: env.NEXTAUTH_SECRET,
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60, updateAge: 24 * 60 * 60 },
  pages: { signIn: "/login", error: "/login" },
  providers: [
    ...(features.google
      ? [
          GoogleProvider({
            clientId: env.GOOGLE_CLIENT_ID!,
            clientSecret: env.GOOGLE_CLIENT_SECRET!,
            // Safe: Google verifies email ownership.
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
    CredentialsProvider({
      name: "Email",
      credentials: { email: { label: "Email", type: "email" }, password: { label: "Password", type: "password" } },
      async authorize(raw, req) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;
        const hdrs = (req?.headers ?? {}) as Record<string, string | string[] | undefined>;
        const ip = ipFromHeaders((n) => { const v = hdrs[n]; return Array.isArray(v) ? v.join(",") : v; });
        const rl = await rateLimit(`login:${ip}`, LIMIT_PRESETS.auth.limit, LIMIT_PRESETS.auth.windowMs);
        if (!rl.ok) throw new Error("TooManyAttempts");
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.passwordHash) {
          // Constant-ish timing to limit account enumeration
          await dummyVerify(password);
          return null;
        }
        if (user.status === "SUSPENDED") throw new Error("AccountSuspended");
        if (user.lockedUntil && user.lockedUntil > new Date()) throw new Error("AccountLocked");
        const ok = await verifyPassword(password, user.passwordHash);
        if (!ok) {
          const failed = user.failedLogins + 1;
          await prisma.user.update({
            where: { id: user.id },
            data: { failedLogins: failed >= MAX_FAILED_LOGINS ? 0 : failed, lockedUntil: failed >= MAX_FAILED_LOGINS ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null },
          });
          return null;
        }
        if (user.failedLogins || user.lockedUntil) await prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null } });
        return { id: user.id, email: user.email, name: user.name, image: user.image };
      },
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      if (!user?.id) return true;
      const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { status: true } }).catch(() => null);
      return dbUser?.status !== "SUSPENDED";
    },
    async jwt({ token, user }) {
      const now = Date.now();
      if (user?.id) token.id = user.id;
      if (token.id && (user || !token.refreshedAt || now - token.refreshedAt > TOKEN_REFRESH_MS)) {
        const db = await prisma.user.findUnique({ where: { id: token.id }, select: { role: true, plan: true, status: true, educationLevel: true, name: true, image: true } }).catch(() => null);
        if (db) {
          token.role = db.role;
          token.plan = db.plan;
          token.level = db.educationLevel;
          token.disabled = db.status === "SUSPENDED";
          token.name = db.name;
          token.picture = db.image;
        } else if (!user) {
          token.disabled = true;
        }
        token.refreshedAt = now;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.disabled || !token.id) return { ...session, user: undefined as never };
      session.user = {
        ...session.user,
        id: token.id,
        role: token.role ?? "USER",
        plan: token.plan ?? "FREE",
        level: token.level ?? "HIGH_SCHOOL",
      };
      return session;
    },
  },
  events: {
    async linkAccount({ user, account }) {
      if (account.provider !== "google" || !user.id) return;
      const db = await prisma.user.findUnique({ where: { id: user.id }, select: { emailVerified: true, passwordHash: true } });
      if (!db) return;
      // Someone may have registered this email with a password before its owner signed in with Google
      // (account pre-hijacking). Google proves ownership, so drop any password that was never verified.
      await prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: db.emailVerified ?? new Date(), ...(db.passwordHash && !db.emailVerified ? { passwordHash: null, failedLogins: 0, lockedUntil: null } : {}) },
      });
    },
    async signIn({ user }) {
      if (!user?.id) return;
      const data: { lastLoginAt: Date; role?: Role } = { lastLoginAt: new Date() };
      if (user.email && adminEmails.includes(user.email.toLowerCase())) data.role = "ADMIN";
      await prisma.user.update({ where: { id: user.id }, data }).catch(() => undefined);
    },
  },
};

export async function getSession() {
  try {
    return await getServerSession(authOptions);
  } catch {
    return null;
  }
}

export async function getCurrentUser() {
  const s = await getSession();
  return s?.user?.id ? s.user : null;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new ApiError(401, "Please sign in to continue.", "UNAUTHORIZED");
  return user;
}

const ROLE_RANK: Record<Role, number> = { USER: 0, EDITOR: 1, ADMIN: 2 };

export function hasRole(role: Role | undefined, required: Role) {
  return ROLE_RANK[role ?? "USER"] >= ROLE_RANK[required];
}

export async function requireRole(required: Role) {
  const user = await requireUser();
  if (!hasRole(user.role, required)) throw new ApiError(403, "You do not have permission to do that.", "FORBIDDEN");
  return user;
}
