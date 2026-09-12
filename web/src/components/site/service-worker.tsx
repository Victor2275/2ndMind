"use client";

import { useEffect } from "react";

import { applyUpdate, watchForUpdate } from "@/lib/pwa/register";

/**
 * Registers the service worker and reloads automatically when a new version is waiting
 * (V3 §1.1, D-146; auto-applied without a prompt as of 2026-09-12).
 *
 * There is exactly one user, and he knows when he has just deployed — a "new version is
 * ready" banner was overhead for a fact he already knows. `applyUpdate` fires the moment a
 * worker is found waiting, with no confirmation step.
 *
 * Mounted once in the root layout so the worker is registered on the public site too. That is
 * deliberate: the install `start_url` is `/private`, but Chrome will only offer to install
 * from a page inside the worker's scope, and the portfolio is where a first visit lands.
 *
 * Nothing sensitive may appear in this file — it is a Client Component, so it compiles into
 * `/_next/static/chunks/` and is served without authentication.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const container = navigator.serviceWorker;
    let detach: (() => void) | undefined;
    let cancelled = false;

    const onWaiting = (worker: ServiceWorker) => {
      applyUpdate(worker, container, () => location.reload());
    };

    // `updateViaCache: "none"` stops the browser serving /sw.js from its own HTTP cache. Without
    // it a worker can be pinned for up to 24 hours by a stale cache entry, which is exactly the
    // silent version skew the build stamp exists to prevent.
    container
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((registration) => {
        if (cancelled) return;
        detach = watchForUpdate(registration, {
          isControlled: () => container.controller !== null,
          onWaiting,
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
      // Not with the radio off. `update()` fetches /sw.js, so offline it rejects with
      // "unknown error when fetching the script" — which is not a fault, it is the answer to a
      // question that should not have been asked. Unhandled, that rejection reached the global
      // reporter and filed itself as a crash: two of those arrived from the phone on
      // 2026-09-05, from an airplane-mode test, which is precisely when the report is least
      // affordable and least true. Same `onLine !== false` test the worker's retry uses, for
      // the same reason — weak evidence in general, conclusive when it says false.
      if (navigator.onLine === false) return;
      void container
        .getRegistration()
        .then((registration) => registration?.update())
        // A failed update check is a normal outcome of a bad connection, not something to
        // report. The next foreground tries again.
        .catch(() => {});
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      detach?.();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  return null;
}
