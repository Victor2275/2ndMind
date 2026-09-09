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
import { useEffect, useState, useSyncExternalStore } from "react";

import { InstallButton } from "@/components/site/install-button";
import { ThemeToggle } from "@/components/site/theme-toggle";
import { reachabilityStore } from "@/lib/net/reachability";

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
  { href: "/private/settings", label: "Settings" },
] as const;

/** Exact match for the index, prefix for the rest — otherwise "/private" lights up everywhere. */
function isActive(pathname: string, href: string): boolean {
  return href === "/private" ? pathname === "/private" : pathname.startsWith(href);
}

const ITEM =
  "flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-md transition-colors";

/**
 * How the bar's own links navigate.
 *
 * On `/private` a `<Link>` is right: the router prefetches, the transition is instant, and the
 * shared layout is not re-rendered. On the offline shell it is wrong, and quietly so — a client
 * transition fetches an RSC payload from a server that is not reachable, which is the one thing
 * guaranteed to fail in the situation this bar exists to serve. A plain anchor is a document
 * navigation, which the service worker intercepts and answers from the cache. `Elsewhere` in
 * `cached-app.tsx` is a plain anchor for the same reason and says so.
 *
 * **Prefetching stops once the connection is known to be degraded** (V4 Phase N6). Every link
 * here prefetches an RSC payload on render, so this bar alone puts eight speculative requests
 * on the wire. Over HTTP/2 they share one TCP connection with the request the user is actually
 * waiting for, so on a stalled connection the prefetches are not free background work — they
 * are competing with the navigation, and they lose it nothing but time.
 *
 * It is gated on evidence rather than turned off outright, because prefetching is exactly what
 * makes a tab tap instant on a connection that works. `lib/net/reachability.ts` only reports
 * `degraded` once requests have actually stalled or failed twice, so a good connection keeps
 * the behaviour it has today and never sees this branch.
 */
function NavLink({
  href,
  hard,
  ...rest
}: {
  href: string;
  hard: boolean;
  children: React.ReactNode;
  className?: string;
  "aria-current"?: "page" | undefined;
}) {
  const { state } = useSyncExternalStore(
    reachabilityStore.subscribe,
    reachabilityStore.getSnapshot,
    reachabilityStore.getServerSnapshot,
  );

  // `undefined` rather than `true`: the default is Next's own policy, and forcing it on would
  // be a second decision this file has no reason to make.
  const prefetch = state === "healthy" ? undefined : false;

  return hard ? <a href={href} {...rest} /> : <Link href={href} prefetch={prefetch} {...rest} />;
}

/**
 * @param path      Which route to treat as current. Defaults to the live pathname; the offline
 *                  shell passes the path its failed navigation was aimed at, because
 *                  `usePathname()` there is `/cached` and no tab would light up at all.
 * @param offline   Renders document navigations rather than client transitions, and shows the
 *                  reduced control row — offline being the one case where `/private/settings`
 *                  cannot be reached at all.
 */
export function PrivateTabBar({
  path,
  offline = false,
}: { path?: string; offline?: boolean } = {}) {
  // Called unconditionally — hooks cannot be skipped — and then overridden. The prop wins
  // because on `/cached` the live pathname is not the page the user thinks they are on.
  const livePathname = usePathname();
  const pathname = path ?? livePathname;

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
              <span className="eyebrow text-muted-foreground">More</span>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                aria-label="Close menu"
                className="flex size-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
              >
                <XIcon className="icon-sm" />
              </button>
            </div>

            <nav className="grid grid-cols-2 gap-2">
              {MORE.map((item) => (
                <NavLink
                  key={item.href}
                  href={item.href}
                  hard={offline}
                  aria-current={isActive(pathname, item.href) ? "page" : undefined}
                  className={`flex min-h-12 items-center rounded-md border px-3 text-sm transition-colors ${
                    isActive(pathname, item.href)
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border text-foreground hover:border-primary/40"
                  }`}
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>

            {/* Online, this row is empty and does not render: every control that used to live
                here is in `/private/settings` now (V4 §4.4), which is one tap away in the list
                above.

                Offline it is the only place left. `/private/settings` is `force-dynamic`, so a
                failed navigation to it is served the cached shell instead — the settings screen
                genuinely cannot be reached without a network. The theme is the one control that
                needs no server at all (it writes to `localStorage` and sets an attribute), so
                it stays reachable here rather than becoming something you can only change when
                online. Push, sign-out and the public site all need a round trip and are already
                absent offline for that reason. */}
            {offline && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                <span className="eyebrow text-faint-foreground">Offline</span>
                <div className="flex items-center gap-2">
                  <ThemeToggle />
                  <InstallButton />
                </div>
              </div>
            )}
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
            <TabLink
              key={href}
              href={href}
              label={label}
              Icon={Icon}
              pathname={pathname}
              hard={offline}
            />
          ))}

          {/* The centre action. Larger, filled, and labelled with a verb rather than a noun:
              it is the one control on this bar that writes something. */}
          <NavLink
            href="/private/log"
            hard={offline}
            aria-current={isActive(pathname, "/private/log") ? "page" : undefined}
            className="flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-md border border-primary/50 bg-primary/15 text-primary transition-colors hover:bg-primary/25"
          >
            <PlusIcon className="icon-md" aria-hidden />
            <span className="text-xs">Log</span>
          </NavLink>

          {TABS.slice(2).map(({ href, label, Icon }) => (
            <TabLink
              key={href}
              href={href}
              label={label}
              Icon={Icon}
              pathname={pathname}
              hard={offline}
            />
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
            <EllipsisIcon className="icon-md" aria-hidden />
            <span className="text-xs">More</span>
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
  hard,
}: {
  href: string;
  label: string;
  Icon: typeof HouseIcon;
  pathname: string;
  hard: boolean;
}) {
  const active = isActive(pathname, href);
  return (
    <NavLink
      href={href}
      hard={hard}
      aria-current={active ? "page" : undefined}
      className={`${ITEM} ${
        active ? "text-primary" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <Icon className="icon-md" aria-hidden />
      <span className="text-xs">{label}</span>
    </NavLink>
  );
}
