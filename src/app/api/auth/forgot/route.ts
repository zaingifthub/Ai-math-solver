import { NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiHandler, ApiError, getClientIp } from "@/lib/security";
import { rateLimit } from "@/lib/rate-limit";
import { sendMail, resetEmail } from "@/lib/email";
import { absoluteUrl } from "@/lib/site";

const schema = z.object({ email: z.string().trim().toLowerCase().email().max(254) });
const GENERIC = { ok: true, message: "If an account exists for that email, a reset link is on its way." };

export const POST = apiHandler(async (req) => {
  const { email } = schema.parse(await req.json());
  const [byIp, byEmail] = await Promise.all([rateLimit(`forgot:ip:${getClientIp(req)}`, 5, 60 * 60_000), rateLimit(`forgot:email:${email}`, 3, 60 * 60_000)]);
  if (!byIp.ok) throw new ApiError(429, "Too many requests. Please try again later.", "RATE_LIMITED");
  // Same response whether or not the account exists (no account enumeration)
  if (!byEmail.ok) return NextResponse.json(GENERIC);
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, status: true } });
  if (user && user.status === "ACTIVE") {
    const raw = randomBytes(32).toString("hex");
    const identifier = `reset:${email}`;
    await prisma.verificationToken.deleteMany({ where: { identifier } });
    await prisma.verificationToken.create({ data: { identifier, token: createHash("sha256").update(raw).digest("hex"), expires: new Date(Date.now() + 60 * 60_000) } });
    const link = absoluteUrl(`/reset-password?email=${encodeURIComponent(email)}&token=${raw}`);
    await sendMail({ to: email, ...resetEmail(link) }).catch((e) => console.error("[forgot] email failed", e));
  }
  return NextResponse.json(GENERIC);
});
