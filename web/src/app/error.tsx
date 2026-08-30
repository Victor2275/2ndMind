"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

/**
 * The page-level error boundary.
 *
 * It sits at the root of `app/`, so it covers the public portfolio as well as the private
 * site. That is why it shows the **digest** rather than `error.message`: in production Next
 * redacts messages thrown on the server, but anything thrown in a client component arrives
 * here verbatim, and this boundary is reachable by anyone visiting the public site. A digest
 * is enough to find the real stack trace in the Vercel function logs, and gives a passer-by
 * nothing.
 *
 * In development the message is shown, because there the whole point is to read it.
 *
 * This is *not* `global-error.tsx`. That file replaces the root layout entirely and must
 * render its own `<html>` and `<body>`; it only fires for errors thrown in the layout itself.
 * Renaming this one would trade the boundary that catches almost everything for the one that
 * catches the rarest case. If layout-level coverage is wanted, both files should exist.
 */
export default function PageError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Vercel captures console output from the client into its logs.
    console.error("Page error:", error);
  }, [error]);

  const showMessage = process.env.NODE_ENV === "development";

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">
        Something broke on this page.
      </h1>
      <p className="mt-3 max-w-[52ch] text-sm text-muted-foreground">
        The rest of the site is unaffected. Trying again is worth a shot — most failures here are a
        database waking up or a feed timing out.
      </p>

      {(error.digest || showMessage) && (
        <div className="mt-6 w-full rounded-lg border border-border bg-card/70 p-4 text-left">
          {showMessage && (
            <p className="font-mono text-xs break-words text-foreground">{error.message}</p>
          )}
          {error.digest && (
            <p className="mt-2 font-mono text-[0.65rem] text-muted-foreground">
              digest {error.digest}
            </p>
          )}
        </div>
      )}

      <Button onClick={reset} className="mt-8">
        Try again
      </Button>
    </main>
  );
}
