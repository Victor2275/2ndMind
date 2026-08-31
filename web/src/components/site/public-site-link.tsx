import { ArrowUpRightIcon } from "lucide-react";
import Link from "next/link";

/**
 * The way back to the portfolio from inside the private app (D-149).
 *
 * The private pages no longer carry the public header, so this is the only route out. It sits
 * in two places, because the app has two navigations: the desktop nav row and the phone More
 * sheet. Both are one tap from anywhere.
 *
 * Deliberately not a `<Link prefetch>` candidate worth worrying about and deliberately plain:
 * this is an exit, not a destination, and it should not compete with the private nav beside it.
 *
 * No `"use client"` — it needs no hooks. It is imported by client components, which makes it
 * part of their bundle; that is fine, since it contains a label and an href and nothing else.
 */
export function PublicSiteLink({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`flex items-center gap-1.5 rounded-md text-muted-foreground transition-colors hover:text-foreground ${className}`}
    >
      Public site
      <ArrowUpRightIcon className="size-3.5" aria-hidden />
    </Link>
  );
}
