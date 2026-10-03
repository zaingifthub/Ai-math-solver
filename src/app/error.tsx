"use client";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="container-page flex min-h-[60vh] flex-col items-center justify-center py-24 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="mt-3 max-w-md text-muted-foreground">An unexpected error occurred. Please try again.{error.digest ? ` (ref: ${error.digest})` : ""}</p>
      <Button className="mt-6" onClick={reset}>Try again</Button>
    </main>
  );
}
