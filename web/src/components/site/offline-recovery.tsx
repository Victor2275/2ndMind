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
 * So it now reads the connection before saying anything, and offers to retry the page that
 * actually failed.
 *
 * **It only ever adds.** The page's own escape links are server-rendered and are what is on
 * screen whether or not this component ever runs — because the first version of this put the
 * only way out behind a JavaScript chunk, on the one page whose job is to work when things are
 * not loading (D-158). Nothing here is the sole route to anything.
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

  // Nothing until hydration has an answer. The server snapshot is `null` for both values, so
  // this renders empty on the server and on the first client pass — which is correct rather
  // than merely safe: the page's own links are already on screen underneath.
  if (online === null && target === null) return null;

  const explanation =
    online === false
      ? "There is no network right now. Anything already logged on this device is safe — entries are written to the phone first and sent when the connection comes back."
      : online === true
        ? "Your phone says it is online, so this was one request failing rather than a lost connection — often a moment's drop, or wifi that has not finished connecting. Anything already logged on this device is safe."
        : null;

  return (
    <>
      {explanation && (
        <p className="mt-4 max-w-[52ch] text-sm leading-relaxed text-muted-foreground">
          {explanation}
        </p>
      )}

      {target && (
        <div className="mt-6">
          <button
            type="button"
            disabled={retrying}
            onClick={() => {
              setRetrying(true);
              // `replace`, not `assign`: a failed navigation should not leave the offline page
              // sitting in history for the back button to land on.
              window.location.replace(target);
            }}
            className="min-h-11 rounded-md border border-primary/50 px-4 py-2.5 text-sm text-primary transition-colors hover:border-primary hover:bg-primary/10 disabled:opacity-60"
          >
            {retrying ? "Trying…" : `Try ${target} again`}
          </button>
        </div>
      )}
    </>
  );
}
