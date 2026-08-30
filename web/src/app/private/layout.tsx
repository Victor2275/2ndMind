import { PrivateNav } from "@/components/site/private-nav";
import { PrivateTabBar } from "@/components/site/private-tabbar";
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
          vertical space D-083 spent a whole feature reclaiming. */}
      <div className="nav-desktop mb-8 flex items-center justify-between gap-4 border-b border-border pb-3">
        <PrivateNav />
        <SignOutButton />
      </div>

      {children}

      <PrivateTabBar />
    </div>
  );
}
