import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Offline",
  robots: { index: false, follow: false },
};

/**
 * The page the service worker serves when a navigation fails with no network (V3 §1.1).
 *
 * It is precached at install, so it has to be public and static: nothing from the vault,
 * nothing behind the session, no data fetch of any kind. A cached document is a document on
 * the device, and this one is the only page in the app that is cached before anyone has
 * signed in.
 *
 * It is also the honest edge of Phase 1. Until Phase 2 precaches the app shell, a *cold*
 * launch with no signal lands here rather than on the dashboard. Saying that plainly on the
 * page beats a spinner that never resolves.
 */
export default function OfflinePage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-5 py-16 sm:px-6">
      <p className="font-mono text-[0.6rem] tracking-[0.18em] text-highlight uppercase">
        No connection
      </p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground">
        This page needs a signal.
      </h1>
      <p className="mt-4 max-w-[52ch] text-sm leading-relaxed text-muted-foreground">
        The app could not reach the network. Anything already logged on this device is safe —
        entries are written to the phone first and sent when the connection comes back.
      </p>
      <p className="mt-3 max-w-[52ch] text-sm leading-relaxed text-muted-foreground">
        Try again once you have signal. If you were part-way through writing something, it is still
        there.
      </p>
    </main>
  );
}
