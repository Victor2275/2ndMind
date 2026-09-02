"use client";

import { useState, useSyncExternalStore } from "react";

/**
 * The half of the offline page that knows whether there is actually a connection (D-157).
 *
 * The page used to say "This page needs a signal" and stop there — no retry, no way back, and
 * no check that the claim was true. Reported from the installed app on 2026-09-03: tapping Log
 * landed here **while the phone was online**. Whatever made that one request fail, the page
 * turned a blip into a dead end and blamed the wrong thing on the way.
 *
 * So it now reads the connection before saying anything, and offers the two actions that fix
 * the two cases: retry the page you were going to, or go back to the dashboard.
 *
 * `navigator.onLine` is weak evidence and is treated as such — it only knows whether the device
 * has *a* network, not whether anything answers, so hotel wifi with a sign-in page reports
 * true. That is precisely why it softens a claim rather than making one: false is conclusive
 * (there is definitely no network), true means "something else went wrong", which is a
 * different sentence and a different action.
 *
 * Both values come through `useSyncExternalStore` rather than an effect. Neither exists during
 * SSR, and this is the one page that has to render correctly when everything else is broken —
 * a hydration mismatch here would be a blank screen with no way out. An explicit server
 * snapshot of `null` renders the neutral wording, and the real answer arrives on hydration.
 */

/** Never changes after load; the subscribe is a formality so the server snapshot can differ. */
const noSubscribe = () => () => {};

function subscribeToConnection(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/**
 * The page the service worker could not load, from `?from=`.
 *
 * Same-origin paths only. This arrives in a URL and is therefore untrusted input — an absolute
 * URL here would turn the Retry button into an open redirect, on a page anyone can reach.
 */
function readTarget(): string | null {
  const wanted = new URLSearchParams(window.location.search).get("from");
  if (!wanted || !wanted.startsWith("/") || wanted.startsWith("//")) return null;
  return wanted;
}

export function OfflineRecovery() {
  const online = useSyncExternalStore(
    subscribeToConnection,
    () => navigator.onLine,
    () => null,
  );
  const target = useSyncExternalStore(noSubscribe, readTarget, () => null);
  const [retrying, setRetrying] = useState(false);

  const explanation =
    online === false
      ? "There is no network right now. Anything already logged on this device is safe — entries are written to the phone first and sent when the connection comes back."
      : online === true
        ? "Your phone says it is online, so this was one request failing rather than a lost connection — often a moment's drop, or wifi that has not finished connecting. Try again. Anything already logged on this device is safe."
        : "Anything already logged on this device is safe — entries are written to the phone first and sent when the connection comes back.";

  return (
    <>
      <p className="mt-4 max-w-[52ch] text-sm leading-relaxed text-muted-foreground">
        {explanation}
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={retrying}
          onClick={() => {
            setRetrying(true);
            // `replace`, not `assign`: a failed navigation should not leave the offline page
            // sitting in history for the back button to land on.
            window.location.replace(target ?? "/private");
          }}
          className="min-h-11 rounded-md border border-primary/50 px-4 py-2.5 text-sm text-primary transition-colors hover:border-primary hover:bg-primary/10 disabled:opacity-60"
        >
          {retrying ? "Trying…" : "Try again"}
        </button>

        {target && target !== "/private" && (
          <button
            type="button"
            onClick={() => window.location.replace("/private")}
            className="min-h-11 rounded-md px-3 py-2.5 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Back to Today
          </button>
        )}
      </div>

      {target && (
        <p className="mt-4 font-mono text-[0.6rem] tracking-wide text-muted-foreground">
          could not load {target}
        </p>
      )}
    </>
  );
}
