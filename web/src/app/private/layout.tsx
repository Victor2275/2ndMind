import { SettingsIcon } from "lucide-react";
import Link from "next/link";

import { PrivateNav } from "@/components/site/private-nav";
import { PrivateTabBar } from "@/components/site/private-tabbar";
import { PullToRefresh } from "@/components/site/pull-to-refresh";
import { SyncRunner } from "@/components/site/sync-runner";
import { requireSession } from "@/lib/auth/dal";

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
      {/* `pb-24` on a phone clears the fixed tab bar, which would otherwise cover the last
          ~68px of every page — including the save button at the foot of a log form. */}
      <div className="mx-auto w-full max-w-5xl flex-1 px-5 pt-8 pb-24 sm:px-6 sm:pb-8">
        {/* Desktop navigation, untouched by V3 (D-132). Hidden on a phone, where the bottom bar
          owns navigation — showing both would put two navs on one small screen and waste the
          vertical space D-083 spent a whole feature reclaiming.

          Since D-149 this is the topmost thing on the page: the public header no longer renders
          here, so `PublicSiteLink` is the only way back to the portfolio on a desktop. */}
        {/* Section links on the left, one way into settings on the right (V4 §4.4).
            The theme toggle, push toggle, public-site link and sign-out used to sit here and are
            now in `/private/settings` — Victor's rule being that anything affecting the app and
            reached rarely belongs there, and one home per control means the two navigations
            cannot drift apart. Settings is a link rather than a nav entry because `PrivateNav`
            is already eight items and a scrolling bar at 1440px (§4.1). */}
        <div className="nav-desktop mb-8 flex items-center justify-between gap-4 border-b border-border pb-3">
          <PrivateNav />
          <Link
            href="/private/settings"
            aria-current={undefined}
            className="flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 font-mono text-xs text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
          >
            <SettingsIcon className="size-3.5" aria-hidden />
            Settings
          </Link>
        </div>

        {children}

        {/* Flushes the outbox on mount, on reconnect and on foreground. Mounted here rather than
          at the root because sync only runs for a signed-in session — the endpoint answers 401
          to anyone else, and starting a flush loop on the public site would just burn 401s. */}
        <SyncRunner />

        {/* On every private screen, from the layout, because a gesture that works on some of
            them is worse than one that works on none (§3.3). */}
        <PullToRefresh />

        <PrivateTabBar />
      </div>
    </>
  );
}
