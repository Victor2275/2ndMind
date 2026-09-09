import type { Metadata } from "next";

import { OfflineRecovery } from "@/components/site/offline-recovery";

export const metadata: Metadata = {
  title: "Offline",
  robots: { index: false, follow: false },
};

/**
 * The page the service worker serves when a navigation fails (V3 §1.1, D-157, D-158).
 *
 * It is precached at install, so it has to be public and static: nothing from the vault,
 * nothing behind the session, no data fetch of any kind. A cached document is a document on
 * the device, and this one is the only page in the app that is cached before anyone has
 * signed in.
 *
 * **Two things here are load-bearing and easy to undo by accident.**
 *
 * *The escapes below are server-rendered, and must stay that way.* On 2026-09-03 the retry
 * moved into a client component, which meant the only way out of this page depended on a
 * JavaScript chunk loading — on the one page whose entire job is to work when things are not
 * loading. `<noscript>` does not cover that case either: a script that fails to *fetch* is not
 * a browser with scripting disabled. So the links are plain `<a>` tags in the server output,
 * and `OfflineRecovery` only ever *adds* to them.
 *
 * *The heading does not claim there is no signal.* It said that unconditionally until
 * 2026-09-03, when it appeared on a phone that was online.
 *
 * It is also the honest edge of Phase 1. Until §2.1 and §2.2 precache the app shell and the
 * public site, **every** navigation with no signal lands here — the dashboard, the portfolio
 * and sign-in alike. Saying that plainly beats a spinner that never resolves, but it is a
 * placeholder for offline support, not offline support.
 */
export default function OfflinePage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-5 py-16 sm:px-6">
      <p className="eyebrow text-primary">Could not load</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground">
        That page did not arrive.
      </h1>

      {/* Everything JavaScript can improve on. It renders nothing until it has something to
          say, so the links below are what is on screen either way. */}
      <OfflineRecovery />

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <a
          href="/private"
          className="min-h-11 rounded-md border border-primary/50 px-4 py-2.5 text-sm text-primary transition-colors hover:border-primary hover:bg-primary/10"
        >
          Second brain
        </a>
        {/* A plain anchor, not `<Link>`, and deliberately so on both counts. A router
            navigation from here is a client-side RSC fetch — more JavaScript, on the page that
            exists because something failed to load, and a soft navigation that has to fail
            before Next falls back to a hard one. A hard load is the behaviour wanted. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/"
          className="min-h-11 rounded-md px-3 py-2.5 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          Public site
        </a>
      </div>

      <p className="mt-8 max-w-[52ch] text-xs leading-relaxed text-muted-foreground">
        Reading and logging with no signal is Phase 2 — until then this page is where every offline
        navigation lands, including this one.
      </p>
    </main>
  );
}
