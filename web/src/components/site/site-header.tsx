"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "About" },
  { href: "/projects", label: "Projects" },
  { href: "/labs", label: "Labs" },
];

export function SiteHeader({ name }: { name: string }) {
  const pathname = usePathname();

  // "/" only matches itself; every other entry also owns its detail pages.
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-6 px-6">
        <Link
          href="/"
          className="group flex items-center gap-2 font-mono text-sm font-semibold tracking-tight text-foreground"
        >
          <span
            aria-hidden
            className="size-1.5 rounded-full bg-primary transition-all duration-300 group-hover:scale-150 group-hover:shadow-[0_0_10px_2px_var(--primary)]"
          />
          <span className="transition-colors group-hover:text-primary">{name}</span>
        </Link>

        <nav className="flex items-center gap-0.5">
          {NAV.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative rounded-md px-3 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                )}
              >
                {item.label}
                <span
                  aria-hidden
                  className={cn(
                    "absolute inset-x-3 -bottom-px h-px origin-left bg-primary transition-transform duration-300 ease-out",
                    active ? "scale-x-100" : "scale-x-0",
                  )}
                />
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
