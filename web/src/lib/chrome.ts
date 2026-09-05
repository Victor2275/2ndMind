/**
 * Whether a path should carry the public site chrome — the header with the portfolio nav, and
 * the footer with the contact links.
 *
 * Everything does except the private app. `/private` has its own navigation twice over (the
 * desktop nav row and the phone tab bar), so the public header was a third one, stacked above
 * them, pointing at pages the app is not about. On a phone it cost 56px at the top of every
 * screen — a feature and a half of the vertical space D-083 and D-132 were spent reclaiming.
 *
 * A pure function rather than an inline `startsWith` so the boundary is testable. The naive
 * `pathname.startsWith("/private")` also matches `/privateer` and `/private-beta`; those do not
 * exist today, and a route added later that quietly loses its header is a confusing thing to
 * debug.
 *
 * **`/cached` is the private app too**, and leaving it out was a real bug rather than an
 * oversight in taste: it is what the service worker serves in place of any failed `/private`
 * navigation, so in airplane mode the app opened wearing the portfolio's header, without the
 * tab bar, and read as the public site. Reported from the phone on 2026-09-05. The route sits
 * outside `/private` for a reason that has nothing to do with chrome — everything under
 * `/private` is `force-dynamic` and needs a server — so the two lists differ by exactly this
 * one path, and that is why this function exists rather than a prefix check (D-174).
 */
export function hasPublicChrome(pathname: string): boolean {
  return !(pathname === "/private" || pathname.startsWith("/private/") || pathname === "/cached");
}
