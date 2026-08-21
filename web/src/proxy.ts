import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";

/**
 * Optimistic auth check. `middleware.ts` was renamed to `proxy.ts` in Next.js 16.
 *
 * This exists to keep unauthenticated traffic off the private routes cheaply. It is
 * explicitly NOT the security boundary: it runs on prefetches and may be deployed to a CDN,
 * and the Next.js authentication guidance is clear that checks belong close to the data.
 * Every private page calls `requireSession()` from the DAL, which is the real gate.
 *
 * It reads the cookie and nothing else — no database, no imports from the render tree.
 */
export async function proxy(request: NextRequest) {
  const secret = process.env.SESSION_SECRET;

  // A missing secret must fail closed. Failing open would silently unlock the private site
  // the moment an environment variable went missing in a deploy.
  if (!secret) {
    return NextResponse.redirect(new URL("/signin?error=unconfigured", request.url));
  }

  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value, secret);
  if (session) return NextResponse.next();

  const signin = new URL("/signin", request.url);
  signin.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(signin);
}

export const config = {
  matcher: ["/private/:path*"],
};
