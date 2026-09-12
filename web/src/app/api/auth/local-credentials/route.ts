import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/dal";
import { relyingParty, storedCredentials } from "@/lib/auth/config";
import { coseToJwk, type LocalCredential } from "@/lib/auth/cose";
import { db, isDatabaseConfigured } from "@/lib/db/client";

/**
 * The public half of every enrolled passkey, for a session that is already signed in
 * (V3 §1.5, D-157).
 *
 * **Why this exists.** D-154 armed the offline lock from the sign-in response, which is the
 * one moment the credential is already in hand. That turned out to be the wrong *only* moment:
 * a session lasts seven days, so a device that signed in before the feature shipped never runs
 * that code again and the lock sits unarmed — invisibly, because an unarmed lock opens. Found
 * on the phone on 2026-09-03, where "there is no biometric login" was the entire symptom.
 *
 * So the app can now ask. Any signed-in session gets the enrolled credentials' public halves
 * and caches them, and the lock arms itself the next time the phone has signal.
 *
 * **Nothing here is secret.** A credential id and a public key are public by definition — the
 * private key never leaves the authenticator — which is the same reason they can sit in
 * IndexedDB at all. The session check is still first, because an unauthenticated caller has no
 * business learning which devices are enrolled.
 *
 * `getSession` rather than `requireSession`: this is fetched in the background by a component
 * that must degrade quietly, and `requireSession` redirects, which would turn a 401 into an
 * HTML sign-in page arriving where JSON was expected.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const { rpID } = relyingParty();
  const credentials: LocalCredential[] = [];

  for (const stored of await storedCredentials(isDatabaseConfigured() ? db() : undefined)) {
    try {
      const { jwk, alg } = coseToJwk(stored.publicKey);
      credentials.push({ id: stored.id, jwk, alg, rpId: rpID });
    } catch (error) {
      // A key this build cannot verify in a browser costs the lock on that device, not the
      // response. Every other enrolled passkey still works.
      console.warn(`local unlock unavailable for "${stored.label}":`, error);
    }
  }

  return NextResponse.json({ credentials });
}
