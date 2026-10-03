import "server-only";
import Stripe from "stripe";
import type { Plan, SubscriptionStatus } from "@prisma/client";
import { env } from "./env";
import { prisma } from "./db";
import { ApiError } from "./security";

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (!env.STRIPE_SECRET_KEY) throw new ApiError(503, "Billing is not enabled yet.", "BILLING_DISABLED");
  stripeClient ??= new Stripe(env.STRIPE_SECRET_KEY);
  return stripeClient;
}

export type BillingInterval = "monthly" | "yearly";

export function priceIdFor(plan: "PREMIUM" | "EDUCATION", interval: BillingInterval): string {
  const map = {
    PREMIUM: { monthly: env.STRIPE_PRICE_PREMIUM_MONTHLY, yearly: env.STRIPE_PRICE_PREMIUM_YEARLY },
    EDUCATION: { monthly: env.STRIPE_PRICE_EDUCATION_MONTHLY, yearly: env.STRIPE_PRICE_EDUCATION_YEARLY },
  } as const;
  const id = map[plan][interval];
  if (!id) throw new ApiError(503, "This plan is not available for purchase yet.", "PRICE_MISSING");
  return id;
}

export function planForPrice(priceId: string | null | undefined): Plan {
  if (!priceId) return "FREE";
  if ([env.STRIPE_PRICE_EDUCATION_MONTHLY, env.STRIPE_PRICE_EDUCATION_YEARLY].includes(priceId)) return "EDUCATION";
  if ([env.STRIPE_PRICE_PREMIUM_MONTHLY, env.STRIPE_PRICE_PREMIUM_YEARLY].includes(priceId)) return "PREMIUM";
  return "FREE";
}

const STATUS: Record<string, SubscriptionStatus> = {
  incomplete: "INCOMPLETE", incomplete_expired: "CANCELED", trialing: "TRIALING", active: "ACTIVE", past_due: "PAST_DUE", canceled: "CANCELED", unpaid: "UNPAID", paused: "CANCELED",
};

export async function getOrCreateCustomer(user: { id: string; email?: string | null; name?: string | null }) {
  const stripe = getStripe();
  const db = await prisma.user.findUnique({ where: { id: user.id }, select: { stripeCustomerId: true, email: true, name: true } });
  if (db?.stripeCustomerId) return db.stripeCustomerId;
  const customer = await stripe.customers.create({ email: db?.email ?? user.email ?? undefined, name: db?.name ?? user.name ?? undefined, metadata: { userId: user.id } });
  await prisma.user.update({ where: { id: user.id }, data: { stripeCustomerId: customer.id } });
  return customer.id;
}

/** Sync a Stripe subscription into our database and update the user's plan. Idempotent. */
export async function syncSubscription(sub: Stripe.Subscription) {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const user = await prisma.user.findUnique({ where: { stripeCustomerId: customerId } });
  if (!user) return;
  const item = sub.items.data[0];
  const priceId = item?.price.id;
  const plan = planForPrice(priceId);
  const status = STATUS[sub.status] ?? "INCOMPLETE";
  const periodEnd = (item as unknown as { current_period_end?: number })?.current_period_end ?? (sub as unknown as { current_period_end?: number }).current_period_end;
  await prisma.subscription.upsert({
    where: { stripeSubscriptionId: sub.id },
    create: { userId: user.id, stripeSubscriptionId: sub.id, stripePriceId: priceId, plan, status, currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null, cancelAtPeriodEnd: sub.cancel_at_period_end },
    update: { stripePriceId: priceId, plan, status, currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null, cancelAtPeriodEnd: sub.cancel_at_period_end },
  });
  const active = await prisma.subscription.findFirst({ where: { userId: user.id, status: { in: ["ACTIVE", "TRIALING", "PAST_DUE"] } }, orderBy: { updatedAt: "desc" } });
  await prisma.user.update({ where: { id: user.id }, data: { plan: active?.plan ?? "FREE" } });
}
