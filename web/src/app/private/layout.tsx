import { PrivateNav } from "@/components/site/private-nav";
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
    <div className="mx-auto w-full max-w-5xl flex-1 px-5 py-8 sm:px-6">
      <div className="mb-8 flex items-center justify-between gap-4 border-b border-border pb-3">
        <PrivateNav />
        <SignOutButton />
      </div>

      {children}
    </div>
  );
}
