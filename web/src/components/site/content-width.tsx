"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

/**
 * How wide the column is on each private screen (V4 §4.1, Q149/Q363).
 *
 * Q363 asks for the content to get wider now that navigation has left the top of the page;
 * Q149 says a form at 64rem is unreadable. Both are right about different screens, so the
 * answer is three named widths — `--width-prose` / `--width-content` / `--width-wide`, built in
 * `scripts/build-scale.mts` and specified in DESIGN.md §5 since §1.7 — and one table saying
 * which screen takes which.
 *
 * ## Why a table here rather than a prop on each page
 *
 * A Next layout cannot be told anything by the page inside it: `children` is already rendered
 * when it arrives, and there is no route segment config for "how wide am I". The alternatives
 * were a wrapper element inside all nineteen pages, or this. A wrapper in each page spreads one
 * decision across nineteen files and guarantees the next screen forgets it; a table is one
 * place to read "how wide is Academics" and one place to change it.
 *
 * It is a Client Component for `usePathname` alone, which is the same trade `PrivateSidebar` makes
 * and carries the same rule: **nothing sensitive may appear here**, because this compiles into
 * `/_next/static/chunks/` and is served without authentication. Route paths and width names
 * only — both of which are already in the sitemap-shaped parts of the app.
 */

type Width = "prose" | "content" | "wide";

/**
 * Longest prefix wins, so a section can set a default and one screen inside it can differ.
 *
 * `wide` is for a screen whose subject is a set of things seen together — a board, a table, the
 * two-column screens of §4.6. `content` is the default and is what every private page was
 * before this. `prose` is for a screen that is read rather than worked, and it is deliberately
 * rare: Q130's complaint is that too much of this app is read-only text, so a width that suits
 * reading is not something to hand out generously.
 */
const WIDTHS: Array<[prefix: string, width: Width]> = [
  // Two columns at 1280 (§4.6). At `content` the second column is 30rem and the stat rows in it
  // wrap, which is the layout arguing with itself.
  ["/private/academics", "wide"],
  ["/private/athletics/exercises", "wide"],
  ["/private/athletics/history", "wide"],
  ["/private/athletics", "wide"],
  ["/private/calendar", "wide"],
  ["/private/work", "wide"],
  // The one screen that is genuinely a document: the private "what I am working on", read
  // start to finish rather than scanned. (The public `/now` this used to mirror was removed
  // on 2026-09-23, D-342; this entry is and always was the private route.)
  ["/private/now", "prose"],
  // Everything else — the log form, the logger, settings, sync, Today — stays where it was.
];

/** Exported for the test: the mapping is the behaviour, the `<main>` element is the rest. */
export function widthFor(pathname: string): Width {
  // `/private/athletics` must not win over `/private/athletics/exercises`, and source order is
  // not a reliable way to say so once the table has a dozen rows in it.
  let best: { width: Width; length: number } | null = null;
  for (const [prefix, width] of WIDTHS) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      if (!best || prefix.length > best.length) best = { width, length: prefix.length };
    }
  }
  return best?.width ?? "content";
}

const CLASS: Record<Width, string> = {
  prose: "width-prose",
  content: "width-content",
  wide: "width-wide",
};

/**
 * The private app's `<main>` landmark (§4.7, Q445) and its column.
 *
 * `id="main"` is the skip link's target, and it is here rather than on the outer flex row
 * because "skip to content" that lands you above the navigation has skipped nothing.
 */
export function ContentWidth({ children }: { children: ReactNode }) {
  const width = widthFor(usePathname());

  return (
    <main
      id="main"
      data-width={width}
      // `pt-6` rather than the old `pt-8`: §4.2 put a title bar at the top of the phone layout,
      // and the space above it was measured against a page that started with a 110px header.
      // `pb-24` on a phone clears the fixed tab bar, which would otherwise cover the last ~68px
      // of every page — including the save button at the foot of a log form.
      className={`mx-auto w-full ${CLASS[width]} px-5 pt-6 pb-24 sm:px-8 sm:pt-8 sm:pb-10`}
    >
      {children}
    </main>
  );
}
