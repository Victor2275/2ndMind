import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/dal";
import { db, isDatabaseConfigured } from "@/lib/db/client";
import { applyOps, pullChanges } from "@/lib/sync/apply";
import { syncRequestSchema, type SyncResponse } from "@/lib/sync/protocol";

/**
 * The sync endpoint (V3 §1.3).
 *
 * Push the outbox, pull what changed, in one round trip. Deliberately thin: authentication,
 * parsing, and a JSON response. Everything that could lose data lives in `lib/sync/apply.ts`,
 * where it can be tested against real Postgres instead of through HTTP.
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  // The real gate, close to the data, exactly as the DAL requires. Not `requireSession` —
  // that redirects, and a redirect to an HTML sign-in page is a terrible thing to hand a
  // background fetch. A 401 is what the client's failure taxonomy expects: pause the flush
  // and prompt for sign-in, rather than burning 100 ops against a dead session.
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }

  if (!isDatabaseConfigured()) {
    // 503, not 500: this is transient from the client's point of view, so the outbox should
    // hold and retry rather than mark everything permanently failed.
    return NextResponse.json({ error: "database not configured" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "body is not JSON" }, { status: 400 });
  }

  const parsed = syncRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "malformed request", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const handle = db();
  const { ops, since } = parsed.data;

  // Push before pull, so a change made on this device comes back in the same response rather
  // than on the next sync. Without that ordering the phone's own write looks like it vanished
  // for one round trip.
  const results = await applyOps(handle, ops);
  const { changes, cursor, hasMore } = await pullChanges(handle, since);

  const response: SyncResponse = { results, changes, cursor, hasMore };
  return NextResponse.json(response);
}
