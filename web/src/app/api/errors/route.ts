import { NextResponse } from "next/server";

import { db, isDatabaseConfigured } from "@/lib/db/client";
import { clean } from "@/lib/errors/report";
// The one importer of the zod schema, and it must stay that way (D-327): this module is
// server-only, so `zod` stops here. Importing it from anything the browser runs puts 64.1KB
// gzipped back on every public page.
import { errorReportSchema } from "@/lib/errors/schema";
import { recordError } from "@/lib/errors/queries";

/**
 * Where crash reports land (V3 §2.4, D-165).
 *
 * Deliberately thin: parse, clean, upsert. The interesting decisions are the two limits below
 * and the cleaning in `lib/errors/report.ts`, both of which are tested away from HTTP.
 *
 * ## Why it accepts unauthenticated requests
 *
 * The failures worth knowing about happen where there is no session to check. A service worker
 * that throws during `install` runs before anything signs in; an error on the public portfolio
 * has no session by definition; and a 401 loop is itself a thing that needs reporting. Gating
 * this on a session would silence exactly the class of failure D-137 scheduled it for.
 *
 * That makes it an open write endpoint, which is a real cost, so it is paid for explicitly:
 *
 * - **The body is capped** before it is parsed, so a large POST cannot be turned into work.
 * - **The schema is an allowlist**, so unknown fields are dropped rather than stored.
 * - **Rows are counted, not accumulated** (`recordError`), so flooding it with one shape
 *   increments an integer rather than growing the table. Flooding it with *distinct* shapes is
 *   the remaining abuse, and the per-instance limiter below is what blunts that.
 *
 * It always answers 204, whatever happened. A reporter that can tell a real failure from a
 * rejected one is a reporter that will retry, and a retry loop inside error reporting is the
 * worst possible bug to ship: it turns one broken thing into an outage.
 */
export const dynamic = "force-dynamic";

/** Bigger than any honest report — the schema caps the fields far below this. */
const MAX_BODY_BYTES = 8_000;

/**
 * A crude ceiling on distinct problems accepted per minute, per server instance.
 *
 * In-memory and therefore per-instance and lost on redeploy, which is fine: this is not a
 * security control, it is a bound on how fast a loop can fill the table before anyone notices.
 * A real limiter would need shared state, which would mean the diagnostics path acquiring a
 * dependency that can itself fail — and a diagnostics path that can fail is worse than a
 * coarse one.
 */
const MAX_PER_MINUTE = 60;
let windowStartedAt = 0;
let acceptedInWindow = 0;

function withinLimit(now: number): boolean {
  if (now - windowStartedAt > 60_000) {
    windowStartedAt = now;
    acceptedInWindow = 0;
  }
  acceptedInWindow += 1;
  return acceptedInWindow <= MAX_PER_MINUTE;
}

/** Everything answers 204. See the note above about retry loops. */
const done = () => new NextResponse(null, { status: 204 });

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) return done();
  if (!withinLimit(Date.now())) return done();

  let text: string;
  try {
    text = await request.text();
  } catch {
    return done();
  }
  if (text.length > MAX_BODY_BYTES) return done();

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return done();
  }

  const parsed = errorReportSchema.safeParse(body);
  if (!parsed.success) return done();

  try {
    // Cleaned here, on the server, rather than trusting a client that already cleaned it. The
    // endpoint is open to anything that can POST, so the client-side scrub is a convenience
    // for the honest path and is not the boundary.
    await recordError(db(), clean(parsed.data));
  } catch {
    // The one place in the app where swallowing an error is right: this *is* the error
    // handler, and there is nowhere left to report a failure to report.
  }

  return done();
}
