"use client";
import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/misc";
import { apiFetch } from "@/lib/api-client";

export function ForgotForm() {
  const [state, setState] = useState<{ loading?: boolean; done?: string; error?: string }>({});
  return state.done ? (
    <Alert variant="success"><CheckCircle2 />{state.done}</Alert>
  ) : (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const email = new FormData(e.currentTarget).get("email");
        setState({ loading: true });
        try {
          const r = await apiFetch<{ message: string }>("/api/auth/forgot", { method: "POST", json: { email } });
          setState({ done: r.message });
        } catch (err) {
          setState({ error: (err as Error).message });
        }
      }}
      className="space-y-4"
    >
      {state.error && <Alert variant="destructive"><AlertCircle />{state.error}</Alert>}
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required maxLength={254} />
      </div>
      <Button type="submit" className="w-full" disabled={state.loading}>{state.loading && <Loader2 className="animate-spin" />} Send reset link</Button>
    </form>
  );
}

export function ResetForm() {
  const params = useSearchParams();
  const [state, setState] = useState<{ loading?: boolean; done?: boolean; error?: string }>({});
  const email = params.get("email") ?? "";
  const token = params.get("token") ?? "";
  if (!email || !token) return <Alert variant="destructive"><AlertCircle />This reset link is incomplete. <Link href="/forgot-password" className="underline">Request a new one</Link>.</Alert>;
  if (state.done)
    return (
      <div className="space-y-4">
        <Alert variant="success"><CheckCircle2 />Your password has been reset.</Alert>
        <Button asChild className="w-full"><Link href="/login">Log in</Link></Button>
      </div>
    );
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        if (f.get("password") !== f.get("confirm")) return setState({ error: "Passwords do not match." });
        setState({ loading: true });
        try {
          await apiFetch("/api/auth/reset", { method: "POST", json: { email, token, password: f.get("password") } });
          setState({ done: true });
        } catch (err) {
          setState({ error: (err as Error).message });
        }
      }}
      className="space-y-4"
    >
      {state.error && <Alert variant="destructive"><AlertCircle />{state.error}</Alert>}
      <p className="text-sm text-muted-foreground">Resetting the password for <strong>{email}</strong></p>
      <div className="space-y-1.5"><Label htmlFor="password">New password</Label><Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required /></div>
      <div className="space-y-1.5"><Label htmlFor="confirm">Confirm new password</Label><Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required /></div>
      <Button type="submit" className="w-full" disabled={state.loading}>{state.loading && <Loader2 className="animate-spin" />} Reset password</Button>
    </form>
  );
}
