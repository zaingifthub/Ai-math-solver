"use client";
import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/misc";
import { apiFetch } from "@/lib/api-client";
import { LEVELS } from "@/lib/utils";

const ERRORS: Record<string, string> = {
  CredentialsSignin: "Incorrect email or password.",
  TooManyAttempts: "Too many sign-in attempts. Please wait a few minutes.",
  AccountLocked: "This account is temporarily locked after several failed attempts. Try again in 15 minutes.",
  AccountSuspended: "This account has been suspended. Contact support.",
  OAuthAccountNotLinked: "This email is already registered with a different sign-in method.",
  AccessDenied: "Access denied.",
};

function safeCallback(url: string | null) {
  return url && url.startsWith("/") && !url.startsWith("//") ? url : "/dashboard";
}

function GoogleButton({ callbackUrl }: { callbackUrl: string }) {
  const [loading, setLoading] = useState(false);
  return (
    <Button type="button" variant="outline" className="w-full" disabled={loading} onClick={() => { setLoading(true); void signIn("google", { callbackUrl }); }}>
      {loading ? <Loader2 className="animate-spin" /> : (
        <svg viewBox="0 0 24 24" className="size-4" aria-hidden><path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.9-5.5 3.9-3.3 0-6-2.7-6-6.1S8.7 5.8 12 5.8c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.2 14.6 2.3 12 2.3 6.6 2.3 2.3 6.6 2.3 12S6.6 21.7 12 21.7c5.6 0 9.3-3.9 9.3-9.5 0-.6-.1-1.1-.2-1.6H12z"/></svg>
      )}
      Continue with Google
    </Button>
  );
}

function Divider() {
  return (
    <div className="relative my-5 text-center text-xs uppercase text-muted-foreground">
      <span className="absolute inset-x-0 top-1/2 h-px bg-border" />
      <span className="relative bg-card px-2">or</span>
    </div>
  );
}

export function LoginForm({ googleEnabled }: { googleEnabled: boolean }) {
  const params = useSearchParams();
  const callbackUrl = safeCallback(params.get("callbackUrl"));
  const [error, setError] = useState<string | null>(params.get("error") ? ERRORS[params.get("error")!] ?? "Sign-in failed." : null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setLoading(true);
    setError(null);
    const res = await signIn("credentials", { email: form.get("email"), password: form.get("password"), redirect: false });
    if (res?.ok && !res.error) {
      window.location.assign(callbackUrl);
      return;
    }
    setError(ERRORS[res?.error ?? ""] ?? ERRORS.CredentialsSignin);
    setLoading(false);
  };

  return (
    <div>
      {googleEnabled && (
        <>
          <GoogleButton callbackUrl={callbackUrl} />
          <Divider />
        </>
      )}
      <form onSubmit={submit} className="space-y-4">
        {error && <Alert variant="destructive"><AlertCircle />{error}</Alert>}
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required maxLength={254} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" autoComplete="current-password" required maxLength={128} />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>{loading && <Loader2 className="animate-spin" />} Log in</Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        New here? <Link href={`/register${callbackUrl !== "/dashboard" ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ""}`} className="font-medium text-primary hover:underline">Create a free account</Link>
      </p>
    </div>
  );
}

export function RegisterForm({ googleEnabled }: { googleEnabled: boolean }) {
  const params = useSearchParams();
  const callbackUrl = safeCallback(params.get("callbackUrl"));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password"));
    if (password !== String(form.get("confirm"))) return setError("Passwords do not match.");
    setLoading(true);
    setError(null);
    try {
      await apiFetch("/api/auth/register", { method: "POST", json: { name: form.get("name"), email: form.get("email"), password, level: form.get("level") } });
      const res = await signIn("credentials", { email: form.get("email"), password, redirect: false });
      if (res?.error) throw new Error(ERRORS[res.error] ?? "Account created — please log in.");
      window.location.assign(callbackUrl);
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  };

  return (
    <div>
      {googleEnabled && (
        <>
          <GoogleButton callbackUrl={callbackUrl} />
          <Divider />
        </>
      )}
      <form onSubmit={submit} className="space-y-4">
        {error && <Alert variant="destructive"><AlertCircle />{error}</Alert>}
        <div className="space-y-1.5">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" autoComplete="name" required maxLength={80} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required maxLength={254} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={128} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm">Confirm password</Label>
            <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={8} maxLength={128} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">At least 8 characters, including letters and numbers.</p>
        <div className="space-y-1.5">
          <Label htmlFor="level">Education level</Label>
          <NativeSelect id="level" name="level" defaultValue="HIGH_SCHOOL">
            {LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
          </NativeSelect>
        </div>
        <Button type="submit" className="w-full" disabled={loading}>{loading && <Loader2 className="animate-spin" />} Create account</Button>
        <p className="text-center text-xs text-muted-foreground">
          By signing up you agree to our <Link href="/terms-of-service" className="underline">Terms</Link> and <Link href="/privacy-policy" className="underline">Privacy Policy</Link>.
        </p>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account? <Link href="/login" className="font-medium text-primary hover:underline">Log in</Link>
      </p>
    </div>
  );
}
