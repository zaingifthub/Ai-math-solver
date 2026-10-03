"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { PLANS } from "@/lib/plans";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export function PricingTable({ billingEnabled }: { billingEnabled: boolean }) {
  const [yearly, setYearly] = useState(true);
  const [loading, setLoading] = useState<string | null>(null);
  const { data: session } = useSession();
  const router = useRouter();
  const toast = useToast();

  const checkout = async (plan: "PREMIUM" | "EDUCATION") => {
    if (!session) return router.push(`/register?callbackUrl=${encodeURIComponent("/pricing")}`);
    setLoading(plan);
    try {
      const { url } = await apiFetch<{ url: string }>("/api/billing/checkout", { method: "POST", json: { plan, interval: yearly ? "yearly" : "monthly" } });
      window.location.assign(url);
    } catch (e) {
      toast((e as Error).message, "error");
      setLoading(null);
    }
  };

  return (
    <div>
      <div className="mb-8 flex items-center justify-center gap-3 text-sm">
        <span className={cn(!yearly && "font-semibold")}>Monthly</span>
        <button type="button" role="switch" aria-checked={yearly} aria-label="Toggle yearly billing" onClick={() => setYearly((y) => !y)} className={cn("relative h-6 w-11 cursor-pointer rounded-full transition-colors", yearly ? "bg-primary" : "bg-input")}>
          <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform", yearly ? "translate-x-5" : "translate-x-0.5")} />
        </button>
        <span className={cn(yearly && "font-semibold")}>Yearly</span>
        <Badge variant="success">Save up to 33%</Badge>
      </div>
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-3">
        {PLANS.map((p) => {
          const price = yearly ? p.yearly / 12 : p.monthly;
          const current = session?.user?.plan === p.id;
          return (
            <div key={p.id} className={cn("relative flex flex-col rounded-2xl border bg-card p-7 shadow-sm", p.highlighted && "border-primary shadow-xl shadow-primary/10 ring-1 ring-primary")}>
              {p.highlighted && <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">Most popular</span>}
              <h2 className="text-lg font-semibold">{p.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{p.tagline}</p>
              <p className="mt-6">
                <span className="text-4xl font-semibold tracking-tight">${price === 0 ? "0" : price.toFixed(2)}</span>
                <span className="text-muted-foreground"> / month</span>
              </p>
              <p className="h-5 text-xs text-muted-foreground">{p.monthly > 0 && yearly ? `Billed $${p.yearly.toFixed(2)} yearly` : p.monthly > 0 ? "Billed monthly" : "Free forever"}</p>
              <ul className="mt-6 flex-1 space-y-2.5 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-success" />{f}</li>
                ))}
              </ul>
              <div className="mt-8">
                {current ? (
                  <Button variant="outline" className="w-full" asChild><Link href="/dashboard/billing">Current plan</Link></Button>
                ) : p.id === "FREE" ? (
                  <Button variant="outline" className="w-full" asChild><Link href={session ? "/solver" : "/register"}>{p.cta}</Link></Button>
                ) : billingEnabled ? (
                  <Button className="w-full" variant={p.highlighted ? "default" : "outline"} onClick={() => void checkout(p.id as "PREMIUM" | "EDUCATION")} disabled={loading !== null}>
                    {loading === p.id && <Loader2 className="animate-spin" />} {p.cta}
                  </Button>
                ) : (
                  <Button className="w-full" variant="outline" disabled>Coming soon</Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-8 text-center text-xs text-muted-foreground">Prices in USD. Taxes may apply. Secure payments by Stripe — cancel anytime.</p>
    </div>
  );
}
