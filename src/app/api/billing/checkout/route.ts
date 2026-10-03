import { NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/lib/security";
import { requireUser } from "@/lib/auth";
import { getStripe, getOrCreateCustomer, priceIdFor } from "@/lib/stripe";
import { absoluteUrl } from "@/lib/site";

const schema = z.object({ plan: z.enum(["PREMIUM", "EDUCATION"]), interval: z.enum(["monthly", "yearly"]).default("monthly") });

export const POST = apiHandler(async (req) => {
  const user = await requireUser();
  const body = schema.parse(await req.json());
  const stripe = getStripe();
  const customer = await getOrCreateCustomer(user);
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer,
    line_items: [{ price: priceIdFor(body.plan, body.interval), quantity: 1 }],
    allow_promotion_codes: true,
    client_reference_id: user.id,
    subscription_data: { metadata: { userId: user.id } },
    success_url: absoluteUrl("/dashboard/billing?status=success"),
    cancel_url: absoluteUrl("/pricing?status=cancelled"),
  });
  return NextResponse.json({ url: session.url });
});
