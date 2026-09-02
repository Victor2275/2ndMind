import type { Metadata } from "next";

import { OfflineRecovery } from "@/components/site/offline-recovery";

export const metadata: Metadata = {
  title: "Offline",
  robots: { index: false, follow: false },
};

/**
 * The page the service worker serves when a navigation fails (V3 §1.1, D-157).
 *
 * It is precached at install, so it has to be public and static: nothing from the vault,
 * nothing behind the session, no data fetch of any kind. A cached document is a document on
 * the device, and this one is the only page in the app that is cached before anyone has
 * signed in.
 *
 * It is also the honest edge of Phase 1. Until Phase 2 precaches the app shell, a *cold*
 * launch with no signal lands here rather than on the dashboard. Saying that plainly on the
 * page beats a spinner that never resolves.
 *
 * **The heading no longer claims there is no signal.** It said that unconditionally until
 * 2026-09-03, when it appeared on a phone that was online — the request had failed for some
 * other reason and the page blamed the network, offered nothing to do about it, and had no way
 * back. `OfflineRecovery` reads the connection before saying anything and carries the two
 * actions that fix the two cases.
 */
export default function OfflinePage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-5 py-16 sm:px-6">
      <p className="font-mono text-[0.6rem] tracking-[0.18em] text-highlight uppercase">
        Could not load
      </p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground">
        That page did not arrive.
      </h1>

      <OfflineRecovery />
    </main>
  );
}
