"use client";

import {
  ActivityIcon,
  BriefcaseIcon,
  CalendarDaysIcon,
  DumbbellIcon,
  GraduationCapIcon,
  HammerIcon,
  HouseIcon,
  InboxIcon,
  NotebookPenIcon,
  PanelLeftIcon,
  SettingsIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";

import { ConnectionGlyph } from "@/components/site/connection-glyph";
import { setCollapsed, sidebarStore } from "@/lib/nav/sidebar";
import { outboxStore } from "@/lib/sync/status";

/**
 * The private app's navigation at `sm` and above (V4 §4.1, Q359–Q363).
 *
 * This replaces `private-nav.tsx`, which was eight items in a horizontally scrolling row.
 * Q258's note — _"the top bar is scrolling. This is an indication of too much going on there"_ —
 * is what it is answering, and Q359 confirmed it: a scrolling bar on a 1440px screen is a
 * presentation failure, not a routing one.
 *
 * `PrivateTabBar` still owns everything below `sm`, untouched. **Two components over one route
 * set remains deliberate** (D-132, reconfirmed by Q358): a phone's navigation belongs under the
 * thumb at the bottom of the screen and a desktop's belongs in a column, and one adaptive
 * component that does both is a component with two layouts inside it and no shared behaviour.
 *
 * ## Collapsing is CSS, not state
 *
 * The collapsed/expanded look is entirely `globals.css` reading `data-nav` on `<html>`, which
 * an inline script in the private layout sets before first paint (`lib/nav/sidebar.ts`). This
 * component holds no layout state at all — it subscribes to the store only to keep the toggle's
 * `aria-expanded` honest. Doing it the other way round, with React state driving the width,
 * means every private page paints expanded and then collapses once hydration lands.
 *
 * Below `lg` the rail is icon-only whatever the preference says, also in CSS: a 208px column of
 * labels beside a 560px page is not a layout, and a viewport is not a choice to be persisted.
 *
 * ## Grouping, and what it does not decide
 *
 * The two headings answer Q258's "too much going on" with structure. **They merge nothing** —
 * every route that was reachable in one tap still is. C11 (is eight the right number?) stays
 * open in `V4_PLAN.md` §8 on purpose: it is a question about how Victor uses the app, and the
 * fix for a cramped bar is not evidence about it.
 *
 * Nothing sensitive may appear in this file. It is a Client Component, so it compiles into
 * `/_next/static/chunks/`, which is served without authentication — labels, icons and hrefs
 * only.
 */

type NavItem = {
  href: string;
  label: string;
  Icon: typeof HouseIcon;
  /** Broader than `href` when an entry stands for more than the page it opens. */
  match?: string;
};

type Group = { heading: string; items: NavItem[] };

/**
 * `Training` points at the logger and lights for the whole area — the same split the tab bar
 * makes, for the same reason (D-225): the screen you want at a rack is the one that writes, and
 * Records, Exercises and History are tabs on the page once you are there.
 */
const GROUPS: Group[] = [
  {
    heading: "Daily",
    items: [
      { href: "/private", label: "Today", Icon: HouseIcon },
      { href: "/private/now", label: "Now", Icon: ActivityIcon },
      { href: "/private/log", label: "Log", Icon: NotebookPenIcon },
    ],
  },
  {
    heading: "Areas",
    items: [
      {
        href: "/private/athletics/log",
        match: "/private/athletics",
        label: "Training",
        Icon: DumbbellIcon,
      },
      { href: "/private/academics", label: "Academics", Icon: GraduationCapIcon },
      { href: "/private/work", label: "Work", Icon: BriefcaseIcon },
      { href: "/private/calendar", label: "Calendar", Icon: CalendarDaysIcon },
      { href: "/private/hobbies", label: "Hobbies", Icon: HammerIcon },
    ],
  },
];

/** Below the rule at the bottom: the two screens that are about the app rather than the day. */
const FOOTER: NavItem[] = [
  { href: "/private/sync", label: "Not sent", Icon: InboxIcon },
  { href: "/private/settings", label: "Settings", Icon: SettingsIcon },
];

/** Exact for the index, prefix for the rest — otherwise `/private` lights up everywhere. */
export function isActive(pathname: string, item: NavItem): boolean {
  const prefix = item.match ?? item.href;
  return prefix === "/private" ? pathname === "/private" : pathname.startsWith(prefix);
}

export function PrivateSidebar() {
  const pathname = usePathname();
  const collapsed = useSyncExternalStore(
    sidebarStore.subscribe,
    sidebarStore.getSnapshot,
    sidebarStore.getServerSnapshot,
  );
  const outbox = useSyncExternalStore(
    outboxStore.subscribe,
    outboxStore.getSnapshot,
    outboxStore.getServerSnapshot,
  );

  return (
    <div className="nav-sidebar nav-desktop">
      {/* `sticky` rather than `fixed`: the rail then scrolls with a short page and pins on a
          long one, without the layout having to reserve a gutter for it. */}
      <nav
        aria-label="Private sections"
        className="sticky top-0 flex h-dvh flex-col gap-1 border-r border-border py-4 pr-3 pl-2"
      >
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          title={collapsed ? "Expand navigation" : "Collapse navigation"}
          className="mb-2 flex min-h-10 items-center gap-3 rounded-md px-2 text-muted-foreground transition-colors duration-fast hover:bg-accent/60 hover:text-foreground"
        >
          <PanelLeftIcon className="icon-md" aria-hidden />
          <span className="nav-label eyebrow">Second brain</span>
        </button>

        {GROUPS.map((group) => (
          <div key={group.heading} className="mb-1">
            {/* Hidden from assistive technology when collapsed would leave it floating without
                its items visible — but it is never actually removed, so the group structure is
                the same for a screen reader at every width. */}
            <p className="nav-label px-2 pt-2 pb-1 eyebrow text-faint-foreground">
              {group.heading}
            </p>
            {/* The rule stands in for the heading when there is no room to print it, so the
                collapsed rail still reads as two groups rather than eight loose icons. */}
            <div className="nav-rule mx-2 mb-1 hidden h-px bg-border" aria-hidden />
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <li key={item.href}>
                  <Item item={item} pathname={pathname} />
                </li>
              ))}
            </ul>
          </div>
        ))}

        {/* Pushes the app-level links and the glyph to the bottom of the rail. */}
        <div className="flex-1" />

        <div className="mx-2 mb-1 h-px bg-border" aria-hidden />
        <ul className="flex flex-col gap-0.5">
          {FOOTER.map((item) => (
            <li key={item.href}>
              <Item
                item={item}
                pathname={pathname}
                // The count rides the link to the screen that explains it, which is the same
                // rule the pill follows: a number is worth showing only where tapping it leads
                // somewhere that says more.
                badge={
                  item.href === "/private/sync" && outbox && outbox.pending + outbox.failed > 0
                    ? outbox.pending + outbox.failed
                    : undefined
                }
                badgeTone={outbox?.urgency === "failed" ? "fault" : "quiet"}
              />
            </li>
          ))}
        </ul>
        <ConnectionGlyph variant="rail" />
      </nav>
    </div>
  );
}

function Item({
  item,
  pathname,
  badge,
  badgeTone = "quiet",
}: {
  item: NavItem;
  pathname: string;
  badge?: number;
  badgeTone?: "quiet" | "fault";
}) {
  const active = isActive(pathname, item);
  const { Icon } = item;

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      // `title` is what the collapsed rail has instead of a label. It is set at every width
      // rather than only when collapsed, because the attribute is written server-side and the
      // collapsed state is not known there.
      title={item.label}
      className={`flex min-h-10 items-center gap-3 rounded-md px-2 text-sm transition-colors duration-fast ${
        active
          ? "bg-primary/12 text-primary"
          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
      }`}
    >
      <span className="relative flex shrink-0 items-center">
        <Icon className="icon-md" aria-hidden />
        {/* When the rail is collapsed the label — and with it the number — is gone, so the dot
            is the only thing left to say something is waiting. It is drawn on the icon rather
            than beside it for that reason. */}
        {badge !== undefined && (
          <span
            aria-hidden
            data-status-dot
            className={`nav-dot absolute -top-0.5 -right-0.5 hidden size-2 rounded-full ring-2 ring-background ${
              badgeTone === "fault" ? "bg-destructive" : "bg-primary"
            }`}
          />
        )}
      </span>
      <span className="nav-label flex-1 truncate">{item.label}</span>
      {badge !== undefined && (
        <span
          className={`nav-label tabular rounded-pill px-1.5 text-xs ${
            badgeTone === "fault"
              ? "bg-destructive/15 text-destructive"
              : "bg-primary/15 text-primary"
          }`}
        >
          {badge}
        </span>
      )}
    </Link>
  );
}
