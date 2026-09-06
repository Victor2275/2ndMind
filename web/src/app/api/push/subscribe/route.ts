import { NextResponse } from "next/server";
import { z } from "zod";

import { requireSession } from "@/lib/auth/dal";
import { db, isDatabaseConfigured } from "@/lib/db/client";
import { pushSubscriptions } from "@/lib/db/schema";
import { forgetDevice } from "@/lib/push/send";

/**
 * Where a device says it will accept notifications, and where it takes that back (§4.1, D-185).
 *
 * **Session-gated, unlike `/api/errors`.** That endpoint is deliberately open because the
 * failures worth knowing about happen where there is no session; this one is the opposite —
 * a subscription is a standing permission to interrupt Victor's phone, and a stranger must not
 * be able to add one. The row it writes is also the thing every notification is sent to.
 *
 * The endpoint URL is the identity: a browser reissues the same one for the same installation,
 * so re-subscribing after a permission reset overwrites the previous row rather than leaving a
 * dead one behind it. That is what the unique index on `endpoint` is for.
 */
export const dynamic = "force-dynamic";

/**
 * The three opaque strings a browser hands over, and nothing else.
 *
 * An allowlist rather than a pass-through: `PushSubscription.toJSON()` carries other fields, and
 * storing whatever arrives is how a schema grows things nobody chose. The lengths are far above
 * any real value and exist so a malformed body is rejected rather than stored.
 */
const subscription = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({
    p256dh: z.string().min(1).max(200),
    auth: z.string().min(1).max(200),
  }),
  // Coarse only — "Android" or "Windows", enough to tell two devices apart in a list. The
  // client sends a trimmed platform string, never the full user agent.
  agent: z.string().max(60).optional(),
});

export async function POST(request: Request) {
  await requireSession();
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "no database" }, { status: 503 });
  }

  const parsed = subscription.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "malformed subscription" }, { status: 400 });
  }

  const { endpoint, keys, agent } = parsed.data;
  await db()
    .insert(pushSubscriptions)
    .values({ endpoint, p256dh: keys.p256dh, auth: keys.auth, agent: agent ?? "" })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      // The keys are reissued with the subscription, so a returning device brings new ones.
      set: { p256dh: keys.p256dh, auth: keys.auth, agent: agent ?? "" },
    });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  await requireSession();
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "no database" }, { status: 503 });
  }

  const parsed = z
    .object({ endpoint: z.string().url().max(1000) })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "malformed" }, { status: 400 });
  }

  await forgetDevice(parsed.data.endpoint);
  return NextResponse.json({ ok: true });
}
