import { PrivateNav } from "@/components/site/private-nav";
import { PrivateTabBar } from "@/components/site/private-tabbar";
import { PublicSiteLink } from "@/components/site/public-site-link";
import { SyncRunner } from "@/components/site/sync-runner";
import { SignOutButton } from "@/components/site/sign-out-button";
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

  return (
    // `pb-24` on a phone clears the fixed tab bar, which would otherwise cover the last
    // ~68px of every page — including the save button at the foot of a log form.
    <div className="mx-auto w-full max-w-5xl flex-1 px-5 pt-8 pb-24 sm:px-6 sm:pb-8">
      {/* Desktop navigation, untouched by V3 (D-132). Hidden on a phone, where the bottom bar
          owns navigation — showing both would put two navs on one small screen and waste the
          vertical space D-083 spent a whole feature reclaiming.

          Since D-149 this is the topmost thing on the page: the public header no longer renders
          here, so `PublicSiteLink` is the only way back to the portfolio on a desktop. */}
      <div className="nav-desktop mb-8 flex items-center justify-between gap-4 border-b border-border pb-3">
        <PrivateNav />
        <div className="flex shrink-0 items-center gap-4">
          <PublicSiteLink className="font-mono text-xs" />
          <SignOutButton />
        </div>
      </div>

      {children}

      {/* Flushes the outbox on mount, on reconnect and on foreground. Mounted here rather than
          at the root because sync only runs for a signed-in session — the endpoint answers 401
          to anyone else, and starting a flush loop on the public site would just burn 401s. */}
      <SyncRunner />

      <PrivateTabBar />
    </div>
  );
}
