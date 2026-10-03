"use client";
import { useState } from "react";
import { signOut } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { LEVELS } from "@/lib/utils";

export function SettingsForms({ user }: { user: { name: string | null; email: string | null; educationLevel: string; hasPassword: boolean } }) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Profile</CardTitle><CardDescription>{user.email}</CardDescription></CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void run("profile", async () => {
                await apiFetch("/api/user", { method: "PATCH", json: { name: f.get("name"), educationLevel: f.get("level") } });
                toast("Profile updated", "success");
              });
            }}
            className="grid gap-4 sm:grid-cols-2"
          >
            <div className="space-y-1.5"><Label htmlFor="name">Name</Label><Input id="name" name="name" defaultValue={user.name ?? ""} maxLength={80} required /></div>
            <div className="space-y-1.5">
              <Label htmlFor="level">Education level</Label>
              <NativeSelect id="level" name="level" defaultValue={user.educationLevel}>{LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}</NativeSelect>
            </div>
            <div className="sm:col-span-2"><Button type="submit" disabled={busy === "profile"}>{busy === "profile" && <Loader2 className="animate-spin" />} Save changes</Button></div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{user.hasPassword ? "Change password" : "Set a password"}</CardTitle><CardDescription>Use at least 8 characters with letters and numbers.</CardDescription></CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const f = new FormData(form);
              void run("password", async () => {
                await apiFetch("/api/user/password", { method: "POST", json: { current: f.get("current") || undefined, next: f.get("next") } });
                form.reset();
                toast("Password updated", "success");
              });
            }}
            className="grid gap-4 sm:grid-cols-2"
          >
            {user.hasPassword && <div className="space-y-1.5"><Label htmlFor="current">Current password</Label><Input id="current" name="current" type="password" autoComplete="current-password" required /></div>}
            <div className="space-y-1.5"><Label htmlFor="next">New password</Label><Input id="next" name="next" type="password" autoComplete="new-password" minLength={8} required /></div>
            <div className="sm:col-span-2"><Button type="submit" variant="outline" disabled={busy === "password"}>{busy === "password" && <Loader2 className="animate-spin" />} Update password</Button></div>
          </form>
        </CardContent>
      </Card>

      <Card className="border-destructive/30">
        <CardHeader><CardTitle className="text-destructive">Delete account</CardTitle><CardDescription>Permanently delete your account, history, progress and tutor conversations.</CardDescription></CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              if (f.get("confirm") !== "DELETE") return toast('Type DELETE to confirm', "error");
              void run("delete", async () => {
                await apiFetch("/api/user", { method: "DELETE", json: { confirm: "DELETE", password: f.get("password") || undefined } });
                await signOut({ callbackUrl: "/" });
              });
            }}
            className="grid gap-4 sm:grid-cols-2"
          >
            <div className="space-y-1.5"><Label htmlFor="confirm">Type DELETE to confirm</Label><Input id="confirm" name="confirm" autoComplete="off" /></div>
            {user.hasPassword && <div className="space-y-1.5"><Label htmlFor="del-password">Password</Label><Input id="del-password" name="password" type="password" autoComplete="current-password" /></div>}
            <div className="sm:col-span-2"><Button type="submit" variant="destructive" disabled={busy === "delete"}>{busy === "delete" && <Loader2 className="animate-spin" />} Delete my account</Button></div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
