"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * One Training area, four tabs (V4 Phase 2++ Stage 7).
 *
 * ## Why this replaces two navigation entries
 *
 * `PrivateNav` carried **Train** and **Athletics** as separate top-level items, which was two of
 * its nine entries spent on one subject — and C-11 in the V4 plan has been asking whether nine
 * is too many since 2026-09-06. They are one area: you log a session, you look at what the
 * sessions add up to, and you edit the catalogue those sessions are written in. So the nav
 * carries **Training**, and the four screens inside it are tabs on the page rather than
 * competitors in a bar that already scrolls sideways at 1440px.
 *
 * A Client Component only because it needs `usePathname`. Nothing here is sensitive: this file
 * compiles into `/_next/static/chunks/`, which is served without authentication — titles and
 * hrefs only.
 */

const TABS = [
  { href: "/private/athletics/log", label: "Log" },
  { href: "/private/athletics/exercises", label: "Exercises" },
  { href: "/private/athletics", label: "Records" },
  { href: "/private/athletics/history", label: "History" },
];

export function TrainingTabs() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Training"
      // No negative margin, unlike `PrivateNav`'s otherwise-identical row. That one is hidden
      // below the desktop breakpoint, so it is never measured at phone width; this one is
      // always on screen, and `scripts/diag-widths.mjs` counts an element wider than its parent
      // as a containment fault whether or not the page ends up scrolling. A gate that reports
      // twelve deliberate offenders every run is a gate nobody reads.
      className="mt-4 flex [scrollbar-width:none] items-center gap-1 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden"
    >
      {TABS.map((tab) => {
        // Records is the area's index, so it matches exactly; the rest match by prefix, which is
        // what keeps `/exercises/bench-press` marking the Exercises tab rather than none of them.
        const active =
          tab.href === "/private/athletics"
            ? pathname === "/private/athletics"
            : pathname.startsWith(tab.href);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`min-h-9 shrink-0 rounded-md px-3 py-1.5 text-sm transition-colors ${
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
