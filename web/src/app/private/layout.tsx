import { ContentWidth } from "@/components/site/content-width";
import { PrivateSidebar } from "@/components/site/private-sidebar";
import { PrivateTabBar } from "@/components/site/private-tabbar";
import { PullToRefresh } from "@/components/site/pull-to-refresh";
import { SyncRunner } from "@/components/site/sync-runner";
import { PrivateToaster } from "@/components/site/toasts";
import { requireSession } from "@/lib/auth/dal";
import { PREPAINT } from "@/lib/nav/sidebar";

export const metadata = {
  title: "Second brain",
  robots: { index: false, follow: false },
};

/** Nothing under /private may be static — every page depends on the session cookie. */
export const dynamic = "force-dynamic";

export default async function PrivateLayout({ children }: LayoutProps<"/private">) {
  // The real gate. proxy.ts already redirected unauthenticated traffic, but it runs on
  // prefetches and may be served from a CDN, so it is not trusted as the boundary.
  await requireSession();

  // The local biometric lock is **built and not mounted** (§1.5, D-158). Wrapping the return
  // below in `<LocalLock>` — and restoring the import above — is the whole of turning it back
  // on; `components/site/local-lock.tsx`, its ceremony, its verifier and their tests are all
  // still here and still green. It was removed on 2026-09-04 because it asked for a
  // fingerprint on every cold start, which is most launches, to protect against a threat the
  // phone's own lock screen already covers.
  return (
    <>
      {/* Sets `data-nav="collapsed"` on `<html>` before the first paint, so a collapsed sidebar
          is collapsed in the first painted frame rather than after hydration (V4 §4.1). The
          same technique `next-themes` uses, and for the same reason. `lib/nav/sidebar.ts` owns
          the string; nothing here should be inlined by hand. */}
      <script dangerouslySetInnerHTML={{ __html: PREPAINT }} />

      {/* One skip link per layout (§4.7, Q444). First in the DOM, visible only on focus, and
          pointing at `<main>` — which `ContentWidth` renders below the navigation, so the skip
          actually skips something. */}
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      <div className="flex w-full">
        {/* Desktop navigation, a rail since §4.1 (was a scrolling row; D-132 still governs the
            split). Hidden on a phone, where the bottom bar owns navigation — showing both would
            put two navs on one small screen and waste the vertical space D-083 spent a whole
            feature reclaiming.

            Settings, the theme picker, push, install, manual sync and sign-out all live on
            `/private/settings` (§4.4, D-195): anything that affects the app and is reached
            rarely belongs there, and one home per control means the two navigations cannot
            drift apart. The rail links to it rather than duplicating any of it. */}
        <PrivateSidebar />

        {/* `min-w-0` because a flex child defaults to `min-width: auto`, which makes it refuse
            to shrink below its widest content — one wide table inside a private page would push
            the sidebar off the screen instead of scrolling itself. */}
        <div className="min-w-0 flex-1">
          <ContentWidth>{children}</ContentWidth>
        </div>
      </div>

      {/* Flushes the outbox on mount, on reconnect and on foreground. Mounted here rather than
          at the root because sync only runs for a signed-in session — the endpoint answers 401
          to anyone else, and starting a flush loop on the public site would just burn 401s.

          Outside the column since §4.1: it is a fixed pill and a publisher, not content, and
          keeping it inside a `max-width` was only ever incidental. */}
      <SyncRunner />

      {/* On every private screen, from the layout, because a gesture that works on some of
          them is worse than one that works on none (§3.3). */}
      <PullToRefresh />

      <PrivateTabBar />

      {/* Mounted here rather than at the root (§5.2, D-192). The public site has nothing that
          writes, so a `Toaster` there would be a client boundary and a portal on every
          statically generated page for a function that can never fire. The offline shell
          mounts its own, because it renders outside this layout. */}
      <PrivateToaster />
    </>
  );
}
