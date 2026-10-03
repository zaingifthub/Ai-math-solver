import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, syncSubscription } from "@/lib/stripe";
import { env } from "@/lib/env";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

/** Stripe webhook: signature-verified (no CSRF check — requests come from Stripe, not browsers). */
export async function POST(req: Request) {
  if (!env.STRIPE_WEBHOOK_SECRET) return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await req.text(), signature, env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session;
        if (s.subscription) await syncSubscription(await stripe.subscriptions.retrieve(typeof s.subscription === "string" ? s.subscription : s.subscription.id));
        await audit(s.client_reference_id, "billing.checkout_completed", "Subscription", typeof s.subscription === "string" ? s.subscription : null);
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await syncSubscription(event.data.object as Stripe.Subscription);
        break;
      default:
        break;
    }
  } catch (e) {
    console.error("[stripe] webhook handling failed", e);
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
