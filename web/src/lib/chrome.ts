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
 */
export function hasPublicChrome(pathname: string): boolean {
  return !(pathname === "/private" || pathname.startsWith("/private/"));
}
