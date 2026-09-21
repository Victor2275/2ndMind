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
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { InstallButton } from "@/components/site/install-button";
import { ThemeToggle } from "@/components/site/theme-toggle";
import { reachabilityStore } from "@/lib/net/reachability";
import { outboxStore } from "@/lib/sync/status";
import { settle, Velocity, type Snap } from "@/lib/ui/sheet-drag";

/**
 * The private app's bottom navigation, phone only (V3 §0.5, D-132).
 *
 * `PrivateSidebar` owns every width at `sm` and above — two components over one set of routes,
 * which is deliberate duplication (D-132, reconfirmed by Q358). Unifying them into one adaptive
 * component was the alternative and was declined twice: a phone's navigation belongs under the
 * thumb and a desktop's belongs in a column, and one component doing both is two layouts in one
 * file with no shared behaviour.
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
  /**
   * The **action**, not the overview (V4 Phase 2.7). Victor's call: tapping Train should put you
   * in front of an exercise search, because that is what you are doing when you reach for the
   * phone in a gym. The records page is one tap from the top of that screen and is still linked
   * from More, so nothing became unreachable — it stopped being the default.
   *
   * `section` is where it *points* versus what it *represents*. Without it, standing on
   * `/private/athletics` would light no tab at all, because the href is a longer path than the
   * page — a tab that goes dark on a page inside its own section reads as being lost.
   */
  {
    href: "/private/athletics/log",
    section: "/private/athletics",
    label: "Train",
    Icon: DumbbellIcon,
  },
  { href: "/private/calendar", label: "Next", Icon: CalendarDaysIcon },
] as const;

/** Everything that did not earn a tab. Order is by how often it is opened. */
const MORE = [
  // The Train tab opens the logger; these are the other three screens in the same area, whose
  // in-page tabs (V4 Phase 2++ Stage 7) also reach each other once you are on any of them.
  { href: "/private/athletics", label: "Training records" },
  { href: "/private/athletics/exercises", label: "Exercises" },
  { href: "/private/athletics/history", label: "Training history" },
  { href: "/private/now", label: "Now" },
  { href: "/private/academics", label: "Academics" },
  { href: "/private/work", label: "Work" },
  { href: "/private/hobbies", label: "Hobbies" },
  // Last, because it is only interesting when the badge has already said so (§1.7).
  { href: "/private/sync", label: "Not sent" },
  { href: "/private/settings", label: "Settings" },
] as const;

/**
 * Exact match for the index, prefix for the rest — otherwise "/private" lights up everywhere.
 *
 * `section` lets a tab point somewhere deeper than the area it stands for, which Train needs
 * since Phase 2.7: it opens the logger and represents everything under `/private/athletics`.
 */
function isActive(pathname: string, href: string, section?: string): boolean {
  const prefix = section ?? href;
  return prefix === "/private" ? pathname === "/private" : pathname.startsWith(prefix);
}

// `press` explicitly (§5.3): the tab bar's items are `<a>` elements, which §5.3's base rule
// cannot reach — it selects `button` and `[role=button]`. This is the most-tapped surface in the
// app, so it is the last place a tap should look like it did nothing.
const ITEM =
  "press flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-md transition-colors";

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

  /**
   * What is waiting to be sent (V4 §4.3, Q287).
   *
   * Read from the store `SyncRunner` publishes rather than from IndexedDB, so this badge, the
   * sidebar's and the glyph's are the same number by construction — `lib/sync/status.ts`.
   * `null` means nothing has looked yet, which renders no badge at all: a zero would be a
   * claim, and an empty outbox is not something this bar should assert on first paint.
   */
  const outbox = useSyncExternalStore(
    outboxStore.subscribe,
    outboxStore.getSnapshot,
    outboxStore.getServerSnapshot,
  );
  const waiting = outbox ? outbox.pending + outbox.failed : 0;

  /**
   * The sheet's drag (§4.3, Q172/Q173).
   *
   * `snap` is where it rests, `drag` is the live finger offset in pixels, and they are separate
   * because only the second changes at 60fps. The transform is applied inline for the same
   * reason — a class per pixel is not a thing Tailwind can generate, and this is the one place
   * in the app where an inline style is the cheap option rather than the lazy one.
   */
  const [snap, setSnap] = useState<Snap>("partial");
  const [drag, setDrag] = useState(0);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const gesture = useRef<{ startY: number; velocity: Velocity } | null>(null);

  function onPointerDown(event: React.PointerEvent) {
    // Left button or touch only: a right-click on the grabber should open a context menu, not
    // start a drag that never ends because no `pointerup` follows.
    if (event.button !== 0) return;
    gesture.current = { startY: event.clientY, velocity: new Velocity() };
    gesture.current.velocity.push(event.clientY, event.timeStamp);
    // Guarded because jsdom has no pointer capture, and neither do the tests that drive this.
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent) {
    const active = gesture.current;
    if (!active) return;
    active.velocity.push(event.clientY, event.timeStamp);
    const dy = event.clientY - active.startY;
    // Upward drag moves nothing: there is no sheet above the top of the sheet, and letting it
    // follow the finger produces a gap between the sheet and the bottom of the screen.
    setDrag(Math.max(0, dy));
  }

  function onPointerUp(event: React.PointerEvent) {
    const active = gesture.current;
    if (!active) return;
    gesture.current = null;
    const dy = event.clientY - active.startY;
    const landing = settle({
      dy,
      velocity: active.velocity.get(),
      height: sheetRef.current?.offsetHeight || 1,
      from: snap,
    });
    setDrag(0);
    if (landing === "closed") setMoreOpen(false);
    else setSnap(landing);
  }

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
            ref={sheetRef}
            role="dialog"
            aria-label="More pages"
            // Sits above the bar rather than over it, so the close control and the More tab
            // are never the same pixels.
            //
            // `partial` is the sheet's own height, which is what it has always been and is
            // enough for the ten items in it today. `full` caps at 85dvh and lets the list
            // scroll, so the same sheet still works when §5 adds to `MORE` — the snap point
            // exists for the sheet's future, and for the flick people already expect.
            style={{
              transform: drag ? `translateY(${drag}px)` : undefined,
              // No transition while the finger is down: a 250ms ease between every pointer
              // move is what makes a dragged sheet feel like it is on a rubber band.
              transition: drag ? "none" : undefined,
              height: snap === "full" ? "85dvh" : undefined,
            }}
            className="absolute inset-x-0 bottom-0 flex max-h-[85dvh] flex-col rounded-t-sheet border-t border-border bg-card px-4 pb-[calc(4.5rem+env(safe-area-inset-bottom))] duration-medium ease-standard"
          >
            {/* The grabber, and the drag surface (Q173). Dragging starts here rather than
                anywhere on the sheet so that a list which has grown past the screen can still
                be scrolled with a finger — the two gestures are the same gesture, and the only
                reliable way to tell them apart is where they begin.

                `touch-action: none` stops the browser treating the same movement as a page
                scroll and stealing the pointer stream halfway through. */}
            <div
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              className="-mx-4 flex cursor-grab touch-none justify-center px-4 pt-3 pb-1 active:cursor-grabbing"
            >
              <span aria-hidden className="h-1 w-9 rounded-pill bg-border" />
            </div>

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

            {/* Scrolls only when expanded past what fits; `min-h-0` is what allows a flex child
                to be shorter than its content and therefore to scroll at all. */}
            <nav className="grid min-h-0 grid-cols-2 gap-2 overflow-y-auto">
              {MORE.map((item) => (
                <NavLink
                  key={item.href}
                  href={item.href}
                  hard={offline}
                  aria-current={isActive(pathname, item.href) ? "page" : undefined}
                  className={`flex min-h-12 items-center gap-2 rounded-md border px-3 text-sm transition-colors ${
                    isActive(pathname, item.href)
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border text-foreground hover:border-primary/40"
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {/* The count is on the row it belongs to as well as on the tab: the badge on
                      More says *something* is waiting, and this says which screen to open. */}
                  {item.href === "/private/sync" && waiting > 0 && (
                    <Count
                      value={waiting}
                      tone={outbox?.urgency === "failed" ? "fault" : "quiet"}
                    />
                  )}
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
          {TABS.slice(0, 2).map((tab) => (
            <TabLink
              key={tab.href}
              href={tab.href}
              section={"section" in tab ? tab.section : undefined}
              label={tab.label}
              Icon={tab.Icon}
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
            className="flex min-h-12 flex-1 press flex-col items-center justify-center gap-0.5 rounded-md border border-primary/50 bg-primary/15 text-primary transition-colors hover:bg-primary/25"
          >
            <PlusIcon className="icon-md" aria-hidden />
            <span className="text-xs">Log</span>
          </NavLink>

          {TABS.slice(2).map((tab) => (
            <TabLink
              key={tab.href}
              href={tab.href}
              section={"section" in tab ? tab.section : undefined}
              label={tab.label}
              Icon={tab.Icon}
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
            {/* The outbox badge (Q287). It rides More because "Not sent" is inside More — a
                badge on a tab that does not lead to the thing it is counting would be a riddle.

                It is a dot with no number on purpose: the exact count is on the row inside and
                on the screen itself, and what this has to carry at 20px is *whether* rather
                than *how many*. The failed state is the one that changes colour, because that
                is the one that will still be here tomorrow without a person. */}
            <span className="relative flex items-center">
              <EllipsisIcon className="icon-md" aria-hidden />
              {waiting > 0 && (
                <span
                  aria-hidden
                  data-status-dot
                  className={`absolute -top-0.5 -right-1 size-2 rounded-full ring-2 ring-background ${
                    outbox?.urgency === "failed" ? "bg-destructive" : "bg-primary"
                  }`}
                />
              )}
            </span>
            <span className="text-xs">More</span>
            {/* The dot is decorative; this is what a screen reader gets. */}
            {waiting > 0 && (
              <span className="sr-only">
                {waiting === 1 ? "1 entry not sent" : `${waiting} entries not sent`}
              </span>
            )}
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
  section,
}: {
  href: string;
  label: string;
  Icon: typeof HouseIcon;
  pathname: string;
  hard: boolean;
  /** The area this tab stands for, when that is broader than where it points. */
  section?: string;
}) {
  const active = isActive(pathname, href, section);
  return (
    <NavLink
      href={href}
      hard={hard}
      aria-current={active ? "page" : undefined}
      className={`${ITEM} ${
        active ? "text-primary" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {/* Filled when active (Q367): "colour alone is currently the only active signal", and a
          signal carried by hue alone is the one a colour-blind eye and a bright pavement both
          lose first.

          lucide draws outlines, so "filled" here is the same outline over a wash of its own
          colour rather than a second icon set. A solid fill was tried first and is wrong for
          this set specifically — `CalendarDaysIcon` becomes a black rectangle, because the
          dots that make it a calendar are strokes inside the shape being filled. At 20% the
          interior detail survives and the tab still reads as filled at arm's length. */}
      <Icon className={`icon-md ${active ? "fill-primary/20" : "fill-none"}`} aria-hidden />
      <span className="text-xs">{label}</span>
    </NavLink>
  );
}

/** The count on a row inside the sheet. A pill, because it is a quantity, not a status. */
function Count({ value, tone }: { value: number; tone: "quiet" | "fault" }) {
  return (
    <span
      className={`tabular shrink-0 rounded-pill px-1.5 text-xs ${
        tone === "fault" ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary"
      }`}
    >
      {value}
    </span>
  );
}
