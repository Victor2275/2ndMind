"use client";

import { useEffect } from "react";

import { flushHeldErrors, watchForErrors } from "@/lib/errors/client";

/**
 * Installs the global error listeners (V3 §2.4, D-165).
 *
 * Mounted in the root layout, so it covers the public site as well as the private app — a
 * broken portfolio page is exactly the sort of thing nobody would otherwise mention, because
 * the person who saw it was a stranger.
 *
 * Renders nothing. It is a component only because listeners have to be installed on the client
 * and removed when it unmounts, which is what an effect is for.
 */
export function ErrorWatch() {
  useEffect(() => {
    const stop = watchForErrors();
    // Anything held while the phone had no signal. On load rather than on the `online` event,
    // which is unreliable — a captive portal reports online — and because a page load is a
    // moment when nobody is waiting.
    void flushHeldErrors();
    return stop;
  }, []);

  return null;
}
