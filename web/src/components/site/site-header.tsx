"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Mark } from "@/components/site/mark";
import { PrivateLink } from "@/components/site/private-link";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "About" },
  { href: "/now", label: "Now" },
  { href: "/projects", label: "Projects" },
  { href: "/resume/robotics", label: "Resume" },
];

export function SiteHeader({ name }: { name: string }) {
  const pathname = usePathname();

  // "/" only matches itself; every other entry also owns its detail pages.
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href.split("/").slice(0, 2).join("/"));

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur-md print:hidden">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-3 px-4 sm:gap-6 sm:px-6">
        {/* The mark replaces the magenta dot (Q36), and the name is set in the display face,
            tracked tight (Q41) — it is a wordmark now, not a label.

            Below `cramped` (380px) the wordmark is dropped and the mark stands alone (Q42). The
            old comment on PrivateLink recorded the reason: at 360px the nav wins the space
            fight against the name, and a truncated "Victor Gu…" is a worse identity than no
            words at all. The link keeps its accessible name either way, from `sr-only`. */}
        <Link
          href="/"
          className="group flex min-w-0 items-center gap-2 text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          <Mark className="icon-md text-primary transition-transform duration-fast ease-standard group-hover:scale-110" />
          <span className="sr-only cramped:hidden">{name}</span>
          <span
            aria-hidden
            className="hidden truncate font-heading text-sm font-semibold tracking-tight transition-colors duration-fast group-hover:text-primary cramped:inline"
          >
            {name}
          </span>
        </Link>

        <nav className="flex shrink-0 items-center gap-0.5">
          {NAV.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative rounded-md px-1.5 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring phone:px-3",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                )}
              >
                {item.label}
                <span
                  aria-hidden
                  className={cn(
                    "absolute inset-x-2 -bottom-px h-px origin-left bg-primary transition-transform duration-300 ease-out sm:inset-x-3",
                    active ? "scale-x-100" : "scale-x-0",
                  )}
                />
              </Link>
            );
          })}

          {/* Victor's, visible only to a browser that has signed in before — see
              `lib/auth/returning.ts`. It gates nothing: `/private` still requires a session.
              Last, not first: at 360px the nav wins the space fight against the name, and a
              link placed ahead of "About" sits where the site's identity belongs — the first
              thing on the page read "Private" instead of "Victor Gusev". */}
          <PrivateLink className="rounded-md px-1.5 py-1.5 text-sm text-primary transition-colors hover:bg-accent/60 phone:px-3" />
        </nav>
      </div>
    </header>
  );
}
