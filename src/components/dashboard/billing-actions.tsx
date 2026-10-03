"use client";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";

export function ManageBillingButton() {
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  return (
    <Button
      variant="outline"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        try {
          const { url } = await apiFetch<{ url: string }>("/api/billing/portal", { method: "POST" });
          window.location.assign(url);
        } catch (e) {
          toast((e as Error).message, "error");
          setLoading(false);
        }
      }}
    >
      {loading && <Loader2 className="animate-spin" />} Manage billing
    </Button>
  );
}
