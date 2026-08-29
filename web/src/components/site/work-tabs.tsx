"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Sub-navigation for the Work section.
 *
 * Tailor moved under Work on 2026-08-29 (D-110). It was a top-level tab, which put a tool
 * used a handful of times a term beside pages opened daily, and made the private nav nine
 * items wide — one line only because it scrolls. It is career work; it belongs with the
 * career pages.
 *
 * A Client Component only for `usePathname`. Nothing sensitive: this file compiles into
 * `/_next/static/chunks/`, which is served without authentication.
 */

const TABS = [
  { href: "/private/work", label: "Applications" },
  { href: "/private/work/tailor", label: "Tailor" },
];

export function WorkTabs() {
  const pathname = usePathname();

  return (
    <nav className="mt-4 flex items-center gap-1 border-b border-border pb-2">
      {TABS.map((tab) => {
        // Exact match on the index, or the deeper tab lights up its parent too.
        const active =
          tab.href === "/private/work" ? pathname === "/private/work" : pathname === tab.href;

        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-md px-3 py-1.5 font-mono text-xs transition-colors duration-200 ${
              active
                ? "bg-primary/12 text-primary"
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
