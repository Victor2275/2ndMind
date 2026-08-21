import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { sessionSecret } from "./config";
import { SESSION_COOKIE, verifySession, type SessionPayload } from "./session";

/**
 * Data Access Layer.
 *
 * `proxy.ts` performs an optimistic cookie check to keep unauthenticated requests off the
 * private routes cheaply, but per the Next.js authentication guidance it is explicitly not
 * the line of defence — it runs on prefetches and may be deployed to a CDN. Every private
 * page and every write path calls `requireSession()` here instead, as close to the data as
 * possible.
 *
 * `cache` dedupes the cookie read and HMAC verification across a single render pass, so a
 * layout and three components asking independently cost one verification.
 */

export const getSession = cache(async (): Promise<SessionPayload | null> => {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value, sessionSecret());
});

/** Returns the session or redirects to sign-in. Never returns null. */
export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) redirect("/signin");
  return session;
}
