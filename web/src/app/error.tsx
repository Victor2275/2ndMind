"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangleIcon, RotateCwIcon } from "lucide-react";

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
 *
 * ## What §5.1 changed (Q283)
 *
 * Q283 asked for this to be designed, and what it had was a centred heading, a paragraph and a
 * `Try again` button with the same weight as every other button on the site. Three things are
 * different now, and each is a rule from elsewhere rather than a preference:
 *
 * - **The recovery is the first thing, not the last** (DESIGN.md §2 rule 7 — actionable before
 *   descriptive). "Try again" was below the digest box, so on a phone the thing you can do was
 *   under a monospace block you cannot act on.
 * - **Two ways out, because `reset()` does not always work.** It re-renders the same subtree,
 *   which fixes a transient failure and loops forever on a deterministic one. A second,
 *   different exit — going home — is what stops that loop, and it is a plain link so it works
 *   even when the client bundle is what broke.
 * - **Destructive red carries the icon, not the whole panel.** A full red page reads as *you
 *   have lost something*, and almost nothing here loses anything: these are reads.
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
    // `<main id="main">`, and it is not a nested landmark (§4.7). A root `error.tsx` /
    // `not-found.tsx` replaces everything below the root layout — including
    // `app/private/layout.tsx` and the one `<main>` `ContentWidth` renders — so on every route
    // this element is the only landmark on the page, and the skip link's target.
    <main
      id="main"
      className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-6 py-24 text-center"
    >
      <span className="flex size-11 items-center justify-center rounded-full border border-destructive/40 bg-destructive/10">
        <AlertTriangleIcon aria-hidden className="icon-md text-destructive" />
      </span>

      <h1 className="mt-5 text-2xl font-bold tracking-tight text-foreground">
        Something broke on this page.
      </h1>
      <p className="mt-3 max-w-[52ch] text-sm leading-relaxed text-muted-foreground">
        The rest of the site is unaffected. Trying again is worth a shot — most failures here are a
        database waking up or a feed timing out.
      </p>

      {/* Above the diagnostics, per DESIGN.md §2 rule 7. `h-11` is §9's 44px floor. */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <Button onClick={reset} className="h-11 px-4">
          <RotateCwIcon aria-hidden />
          Try again
        </Button>
        {/* A plain anchor, not `reset`, and not a router push: the second exit has to work when
            what broke is the client bundle itself, and a full navigation is the only thing here
            that does not depend on React still functioning. */}
        <Link
          href="/"
          className="inline-flex h-11 press items-center rounded-control border border-border px-4 text-sm text-foreground transition-colors duration-fast ease-standard hover:border-primary/50 hover:text-primary"
        >
          Go to the start
        </Link>
      </div>

      {(error.digest || showMessage) && (
        <div className="mt-8 w-full rounded-lg border border-border bg-card/70 p-4 text-left">
          <p className="eyebrow text-faint-foreground">For the logs</p>
          {showMessage && (
            <p className="mt-2 font-mono text-xs break-words text-foreground">{error.message}</p>
          )}
          {error.digest && (
            // `select-all` so the digest is one tap to copy on a phone, which is the only thing
            // anyone ever does with it.
            <p className="mt-2 font-mono text-xs text-muted-foreground select-all">
              digest {error.digest}
            </p>
          )}
        </div>
      )}
    </main>
  );
}
