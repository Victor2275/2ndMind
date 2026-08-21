import Link from "next/link";

import { SignOutButton } from "@/components/site/sign-out-button";
import { requireSession } from "@/lib/auth/dal";

export const metadata = {
  title: "Second brain",
  robots: { index: false, follow: false },
};

/** Nothing under /private may be static — every page depends on the session cookie. */
export const dynamic = "force-dynamic";

const NAV = [
  { href: "/private", label: "Dashboard" },
  { href: "/private/sprint", label: "Sprint" },
  { href: "/private/logbook", label: "Logbook" },
  { href: "/private/athletics", label: "Athletics" },
  { href: "/private/work", label: "Work" },
  { href: "/private/academics", label: "Academics" },
  { href: "/private/calendar", label: "Calendar" },
  { href: "/private/hobbies", label: "Hobbies" },
];

export default async function PrivateLayout({ children }: LayoutProps<"/private">) {
  // The real gate. proxy.ts already redirected unauthenticated traffic, but it runs on
  // prefetches and may be served from a CDN, so it is not trusted as the boundary.
  await requireSession();

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <nav className="flex flex-wrap items-center gap-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-1.5 font-mono text-xs text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <SignOutButton />
      </div>

      {children}
    </div>
  );
}
