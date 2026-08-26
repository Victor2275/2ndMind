/**
 * The "this browser has signed in here before" hint.
 *
 * Its own module rather than a constant in `session.ts`, because it is imported by a Client
 * Component on every public page. `session.ts` carries the HMAC sign/verify code; importing it
 * from the browser bundle to read one string is weight the public site should not carry, and it
 * relies on tree-shaking to stay that way.
 *
 * **This is not a credential.** It is readable and writable by any script — deliberately not
 * `httpOnly` — and it decides exactly one thing: whether a link to `/private` is rendered on a
 * statically generated public page. `/private` calls `requireSession()` regardless, so forging
 * this gets you a link and a redirect to `/signin`.
 *
 * The moment it is used to decide anything else, it becomes an authentication bypass made of a
 * boolean. There is a test asserting no code outside this pair of files reads it.
 */

export const RETURNING_COOKIE = "2m_returning";

/** A year. The point is to outlive the session, which expires weekly. */
export const RETURNING_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Whether the hint is present in a `document.cookie`-style string.
 *
 * Anchored to cookie boundaries: a substring test would also match a *different* cookie whose
 * name happens to end in `2m_returning`, or whose value contains the string.
 */
export function hasReturningCookie(cookie: string): boolean {
  return new RegExp(`(?:^|;\\s*)${RETURNING_COOKIE}=1(?:\\s*;|$)`).test(cookie);
}
