"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

import { hasReturningCookie } from "@/lib/auth/returning";

/**
 * A link to `/private`, shown only on a browser that has signed in here before.
 *
 * **This gates nothing.** It reads a cookie any script can write, and `/private` still
 * redirects to `/signin` without a valid signed session. Forging the cookie gets you a link.
 *
 * Public pages are statically generated, so the server cannot know who is asking — the check
 * has to happen in the browser after hydration.
 *
 * `useSyncExternalStore` rather than `useState` + `useEffect`, for two reasons that both bite:
 * the server snapshot is `false`, so the prerendered HTML and the first client render agree and
 * there is no hydration mismatch; and setting state from an effect is rejected outright by the
 * React lint rule, which is right — this reads an external source, which is what this hook is
 * for.
 */

function subscribe(): () => void {
  // Nothing to subscribe to. `document.cookie` fires no events, and the value changes only on
  // sign-in or sign-out, both of which navigate. Polling would burn a timer on every public
  // page view to notice something that cannot happen without a page load.
  return () => {};
}

function returningHere(): boolean {
  if (typeof document === "undefined") return false;
  return hasReturningCookie(document.cookie);
}

export function PrivateLink({ className }: { className?: string }) {
  const returning = useSyncExternalStore(subscribe, returningHere, () => false);

  if (!returning) return null;

  return (
    <Link href="/private" className={className} rel="nofollow">
      Private
    </Link>
  );
}
