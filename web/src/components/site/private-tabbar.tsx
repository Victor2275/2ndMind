"use client";

import {
  CalendarDaysIcon,
  DumbbellIcon,
  EllipsisIcon,
  HouseIcon,
  PlusIcon,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { InstallButton } from "@/components/site/install-button";
import { PublicSiteLink } from "@/components/site/public-site-link";
import { SignOutButton } from "@/components/site/sign-out-button";

/**
 * The private app's bottom navigation, phone only (V3 §0.5, D-132).
 *
 * `PrivateNav` still owns every width at `sm` and above and is untouched — two components over
 * one set of routes, which is deliberate duplication. Unifying them into one adaptive
 * component was the alternative and was declined: it means editing a desktop layout that works,
 * three weeks before term, to gain a file.
 *
 * Why the bottom: `context.md` requires every write path to sit under three interactions from
 * the dashboard, and D-083 established that vertical distance on a phone is what kills this
 * feature. A horizontally scrolling bar at the top puts every target in the least reachable
 * corner of a 6.7" screen; here the log action sits under the thumb from any page.
 *
 * Nothing sensitive may appear in this file. It is a Client Component, so it compiles into
 * `/_next/static/chunks/` and is served without authentication — labels and hrefs only.
 */

const TABS = [
  { href: "/private", label: "Today", Icon: HouseIcon },
  { href: "/private/athletics", label: "Train", Icon: DumbbellIcon },
  { href: "/private/calendar", label: "Next", Icon: CalendarDaysIcon },
] as const;

/** Everything that did not earn a tab. Order is by how often it is opened. */
const MORE = [
  { href: "/private/now", label: "Now" },
  { href: "/private/academics", label: "Academics" },
  { href: "/private/work", label: "Work" },
  { href: "/private/hobbies", label: "Hobbies" },
  // Last, because it is only interesting when the badge has already said so (§1.7).
  { href: "/private/sync", label: "Not sent" },
] as const;

/** Exact match for the index, prefix for the rest — otherwise "/private" lights up everywhere. */
function isActive(pathname: string, href: string): boolean {
  return href === "/private" ? pathname === "/private" : pathname.startsWith(href);
}

const ITEM =
  "flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-md transition-colors";

export function PrivateTabBar() {
  const pathname = usePathname();

  // The sheet remembers *which page* it was opened on rather than a boolean, so any route
  // change closes it by derivation. The obvious version — a boolean plus an effect that
  // resets it when `pathname` changes — is what `react-hooks/set-state-in-effect` exists to
  // prevent, and it is also worse: it renders one frame with the overlay still covering the
  // new page, and it never fires for a back-button navigation at all.
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const moreOpen = openedAt === pathname;
  const setMoreOpen = (open: boolean) => setOpenedAt(open ? pathname : null);

  // A fixed overlay does not stop the page behind it scrolling, which on a phone reads as the
  // sheet being broken rather than the page being alive.
  useEffect(() => {
    if (!moreOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [moreOpen]);

  const moreActive = MORE.some((item) => isActive(pathname, item.href));

  return (
    <>
      {moreOpen && (
        <div className="nav-mobile fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setMoreOpen(false)}
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
          />

          <div
            role="dialog"
            aria-label="More pages"
            // Sits above the bar rather than over it, so the close control and the More tab
            // are never the same pixels.
            className="absolute inset-x-0 bottom-0 rounded-t-xl border-t border-border bg-card px-4 pt-4 pb-[calc(4.5rem+env(safe-area-inset-bottom))]"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="font-mono text-[0.55rem] tracking-[0.14em] text-muted-foreground uppercase">
                More
              </span>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                aria-label="Close menu"
                className="flex size-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
              >
                <XIcon className="size-4" />
              </button>
            </div>

            <nav className="grid grid-cols-2 gap-2">
              {MORE.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive(pathname, item.href) ? "page" : undefined}
                  className={`flex min-h-12 items-center rounded-md border px-3 text-sm transition-colors ${
                    isActive(pathname, item.href)
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border text-foreground hover:border-primary/40"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            {/* `InstallButton` renders nothing unless Chrome says the app is installable, so
                this row collapses to the public-site link and sign-out in every other case.
                Since D-149 the public header does not render on /private, which makes
                `PublicSiteLink` the only way back to the portfolio from a phone. */}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
              <PublicSiteLink className="min-h-10 px-1 text-sm" />
              <div className="flex items-center gap-2">
                <InstallButton />
                <SignOutButton />
              </div>
            </div>
          </div>
        </div>
      )}

      <nav
        aria-label="Private sections"
        // `env(safe-area-inset-bottom)` keeps the row clear of Android's gesture pill. Without
        // it the bar's lower third is unhittable on a modern Samsung.
        className="nav-mobile fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md print:hidden"
      >
        <div className="flex items-stretch gap-1 px-2 py-1">
          {TABS.slice(0, 2).map(({ href, label, Icon }) => (
            <TabLink key={href} href={href} label={label} Icon={Icon} pathname={pathname} />
          ))}

          {/* The centre action. Larger, filled, and labelled with a verb rather than a noun:
              it is the one control on this bar that writes something. */}
          <Link
            href="/private/log"
            aria-current={isActive(pathname, "/private/log") ? "page" : undefined}
            className="flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-md border border-primary/50 bg-primary/15 text-primary transition-colors hover:bg-primary/25"
          >
            <PlusIcon className="size-5" aria-hidden />
            <span className="font-mono text-[0.55rem] tracking-wide">Log</span>
          </Link>

          {TABS.slice(2).map(({ href, label, Icon }) => (
            <TabLink key={href} href={href} label={label} Icon={Icon} pathname={pathname} />
          ))}

          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-expanded={moreOpen}
            aria-haspopup="dialog"
            className={`${ITEM} ${
              moreActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <EllipsisIcon className="size-5" aria-hidden />
            <span className="font-mono text-[0.55rem] tracking-wide">More</span>
          </button>
        </div>
      </nav>
    </>
  );
}

function TabLink({
  href,
  label,
  Icon,
  pathname,
}: {
  href: string;
  label: string;
  Icon: typeof HouseIcon;
  pathname: string;
}) {
  const active = isActive(pathname, href);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`${ITEM} ${
        active ? "text-primary" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <Icon className="size-5" aria-hidden />
      <span className="font-mono text-[0.55rem] tracking-wide">{label}</span>
    </Link>
  );
}
