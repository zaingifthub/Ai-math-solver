import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/security";
import { requireUser } from "@/lib/auth";
import { getStripe, getOrCreateCustomer } from "@/lib/stripe";
import { absoluteUrl } from "@/lib/site";

export const POST = apiHandler(async () => {
  const user = await requireUser();
  const session = await getStripe().billingPortal.sessions.create({ customer: await getOrCreateCustomer(user), return_url: absoluteUrl("/dashboard/billing") });
  return NextResponse.json({ url: session.url });
});
