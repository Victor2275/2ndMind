"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Private-site navigation with the current tab marked.
 *
 * A Client Component only because it needs `usePathname`. Nothing here is sensitive: this
 * file compiles into `/_next/static/chunks/`, which is served without authentication, so no
 * private data may ever be hard-coded in it — page titles and hrefs only.
 */

/**
 * `except` keeps a section from lighting up on a page that has its own entry.
 *
 * It was added with **Train** (V4 §2.12, D-225) when the logger and the record board were two
 * entries here, and it is unused now — see below — but kept, because the situation it solves
 * recurs the moment any section grows a page with its own entry.
 *
 * ## Nine entries became eight (V4 Phase 2++ Stage 7)
 *
 * **Train** and **Athletics** were two of nine top-level items spent on one subject, in a bar
 * that already scrolls sideways at 1440px — and C-11 in the V4 plan has asked whether nine is
 * the right number since 2026-09-06. They are one area: you log a session, you look at what the
 * sessions add up to, you edit the catalogue they are written in, and you read the history.
 * So this carries **Training**, pointing at the logger because that is the screen you reach for
 * at a rack, and the four screens inside it are tabs on the page (`training-tabs.tsx`).
 */
type NavItem = {
  href: string;
  label: string;
  /** Broader than `href` when an entry stands for more than the page it opens. */
  match?: string;
  /** Paths that must *not* light this entry, for a page with an entry of its own. */
  except?: string[];
};

const NAV: NavItem[] = [
  { href: "/private", label: "Today" },
  { href: "/private/now", label: "Now" },
  { href: "/private/log", label: "Log" },
  // `match` is broader than `href`: the entry *goes* to the logger and *lights* for the whole
  // area, so Records, Exercises and History all keep Training marked.
  { href: "/private/athletics/log", label: "Training", match: "/private/athletics" },
  { href: "/private/academics", label: "Academics" },
  { href: "/private/work", label: "Work" },
  { href: "/private/calendar", label: "Calendar" },
  { href: "/private/hobbies", label: "Hobbies" },
];

export function PrivateNav() {
  const pathname = usePathname();

  return (
    // Scrolls rather than wraps on a phone, so the bar stays one line at any width.
    <nav className="-mx-1 flex [scrollbar-width:none] items-center gap-0.5 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden">
      {NAV.map((item) => {
        // Exact match for the index, prefix match for the rest — otherwise "/private" would
        // light up on every page underneath it.
        const prefix = item.match ?? item.href;
        const active =
          item.href === "/private"
            ? pathname === "/private"
            : pathname.startsWith(prefix) &&
              !item.except?.some((path) => pathname.startsWith(path));

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`relative shrink-0 rounded-md px-3 py-1.5 text-xs transition-colors duration-200 ${
              active
                ? "bg-primary/12 text-primary"
                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
            }`}
          >
            {item.label}
            {active && (
              <span aria-hidden className="absolute inset-x-3 -bottom-1 h-px bg-primary" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
