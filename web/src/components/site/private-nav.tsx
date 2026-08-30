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

const NAV = [
  { href: "/private", label: "Today" },
  { href: "/private/now", label: "Now" },
  { href: "/private/log", label: "Log" },
  { href: "/private/athletics", label: "Athletics" },
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
        const active =
          item.href === "/private" ? pathname === "/private" : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`relative shrink-0 rounded-md px-3 py-1.5 font-mono text-xs transition-colors duration-200 ${
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
