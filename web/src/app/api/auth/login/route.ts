import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";

import { relyingParty, sessionSecret, storedCredential } from "@/lib/auth/config";
import {
  CHALLENGE_COOKIE,
  newSessionPayload,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  signSession,
  verifySession,
} from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/** Step 1: challenge. */
export async function GET() {
  const credential = storedCredential();
  if (!credential) {
    return NextResponse.json({ error: "no passkey enrolled" }, { status: 503 });
  }

  const { rpID } = relyingParty();
  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: [{ id: credential.id }],
    userVerification: "preferred",
  });

  const now = Math.floor(Date.now() / 1000);
  const store = await cookies();
  store.set(
    CHALLENGE_COOKIE,
    await signSession({ sub: options.challenge, iat: now, exp: now + 300 }, sessionSecret()),
    { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" },
  );

  return NextResponse.json(options);
}

/** Step 2: verify the assertion and mint a session. */
export async function POST(request: Request) {
  const credential = storedCredential();
  if (!credential) {
    return NextResponse.json({ error: "no passkey enrolled" }, { status: 503 });
  }

  const body = (await request.json()) as { response?: AuthenticationResponseJSON };
  if (!body.response) {
    return NextResponse.json({ error: "missing response" }, { status: 400 });
  }

  const store = await cookies();
  const challenge = await verifySession(store.get(CHALLENGE_COOKIE)?.value, sessionSecret());
  if (!challenge) {
    return NextResponse.json({ error: "challenge expired — start again" }, { status: 400 });
  }

  const { rpID, origins } = relyingParty();

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: body.response,
      expectedChallenge: challenge.sub,
      expectedOrigin: origins,
      expectedRPID: rpID,
      credential: {
        id: credential.id,
        publicKey: credential.publicKey,
        // Signature counters guard against cloned authenticators. Platform passkeys
        // (Touch ID, Windows Hello) report 0 and never increment, so there is nothing to
        // persist and nothing to compare — which is the only reason this design can avoid
        // a database. A hardware key that does increment would need real storage.
        counter: 0,
      },
    });
  } catch {
    return NextResponse.json({ error: "verification failed" }, { status: 401 });
  }

  store.delete(CHALLENGE_COOKIE);

  if (!verification.verified) {
    return NextResponse.json({ error: "verification failed" }, { status: 401 });
  }

  store.set(SESSION_COOKIE, await signSession(newSessionPayload(), sessionSecret()), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });

  return NextResponse.json({ verified: true });
}

/** Sign out. */
export async function DELETE() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  return NextResponse.json({ ok: true });
}
