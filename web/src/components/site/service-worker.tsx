"use client";

import { useEffect, useState } from "react";

import { applyUpdate, watchForUpdate } from "@/lib/pwa/register";

/**
 * Registers the service worker and offers a reload when a new version is waiting
 * (V3 §1.1, D-146).
 *
 * Mounted once in the root layout so the worker is registered on the public site too. That is
 * deliberate: the install `start_url` is `/private`, but Chrome will only offer to install
 * from a page inside the worker's scope, and the portfolio is where a first visit lands.
 *
 * Nothing sensitive may appear in this file — it is a Client Component, so it compiles into
 * `/_next/static/chunks/` and is served without authentication.
 */
export function ServiceWorker() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const container = navigator.serviceWorker;
    let detach: (() => void) | undefined;
    let cancelled = false;

    // `updateViaCache: "none"` stops the browser serving /sw.js from its own HTTP cache. Without
    // it a worker can be pinned for up to 24 hours by a stale cache entry, which is exactly the
    // silent version skew the build stamp exists to prevent.
    container
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((registration) => {
        if (cancelled) return;
        detach = watchForUpdate(registration, {
          isControlled: () => container.controller !== null,
          onWaiting: setWaiting,
        });
        return registration;
      })
      .catch(() => {
        // A failed registration must never break the page. It fails legitimately on http
        // origins other than localhost, and in private-browsing modes.
      });

    // Coming back to the app is the moment worth re-checking: an installed PWA can sit in the
    // background for days, and the browser will not look for a new worker on its own.
    const handleVisibility = () => {
      if (document.visibilityState !== "visible") return;
      container.getRegistration().then((registration) => registration?.update());
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      detach?.();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  if (!waiting || dismissed) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      // Above the phone tab bar, and clear of the gesture pill. This never covers the centre
      // of the screen and never takes focus: `context.md` requires that a log entry in progress
      // survives anything the app decides to tell you about itself.
      className="fixed inset-x-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-md items-center gap-3 rounded-lg border border-primary/40 bg-card/95 px-4 py-3 shadow-lg backdrop-blur-md sm:bottom-6 print:hidden"
    >
      <p className="min-w-0 flex-1 text-sm text-foreground">
        A new version is ready.
        <span className="block text-xs text-muted-foreground">
          Nothing you have typed will be lost.
        </span>
      </p>

      <button
        type="button"
        onClick={() => applyUpdate(waiting, navigator.serviceWorker, () => location.reload())}
        className="min-h-10 shrink-0 rounded-md border border-primary/50 bg-primary/15 px-3 text-sm font-medium text-primary transition-colors hover:bg-primary/25"
      >
        Reload
      </button>

      {/* Dismissable on purpose. The prompt reappears on the next load, because the worker is
          still waiting — so "Later" postpones without losing the update. */}
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="min-h-10 shrink-0 rounded-md px-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        Later
      </button>
    </div>
  );
}
