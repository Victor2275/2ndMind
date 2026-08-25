import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";

import {
  bytesToBase64url,
  registrationSecret,
  relyingParty,
  sessionSecret,
  storedCredential,
} from "@/lib/auth/config";
import { CHALLENGE_COOKIE, signSession, verifySession } from "@/lib/auth/session";

/**
 * Passkey enrolment. Runs once per device, then should be switched off again.
 *
 * Gated on PASSKEY_REGISTRATION_SECRET being both set and supplied. With no credential
 * configured and no gate, this endpoint would hand the private site to whoever found it.
 */

export const dynamic = "force-dynamic";

function gateOpen(supplied: string | null): boolean {
  const expected = registrationSecret();
  return expected !== null && supplied === expected;
}

/** Step 1: hand the browser a challenge. */
export async function GET(request: Request) {
  const supplied = new URL(request.url).searchParams.get("secret");
  if (!gateOpen(supplied)) {
    return NextResponse.json({ error: "registration is disabled" }, { status: 403 });
  }

  const { rpID, rpName } = relyingParty();
  const existing = storedCredential();

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: "victor",
    userDisplayName: "Victor Gusev",
    attestationType: "none",
    // Refuse to silently enrol a second credential over the first.
    excludeCredentials: existing ? [{ id: existing.id }] : [],
    authenticatorSelection: {
      residentKey: "required",
      userVerification: "preferred",
    },
  });

  // The challenge must survive the round trip and must not be attacker-chosen, so it goes
  // into a signed, httpOnly cookie rather than being echoed back by the client.
  const store = await cookies();
  store.set(
    CHALLENGE_COOKIE,
    await signSession(
      { sub: options.challenge, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 300 },
      sessionSecret(),
    ),
    { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" },
  );

  return NextResponse.json(options);
}

/** Step 2: verify the attestation and print what to paste into the environment. */
export async function POST(request: Request) {
  const body = (await request.json()) as {
    secret?: string;
    response?: RegistrationResponseJSON;
  };
  if (!gateOpen(body.secret ?? null)) {
    return NextResponse.json({ error: "registration is disabled" }, { status: 403 });
  }
  if (!body.response) {
    return NextResponse.json({ error: "missing response" }, { status: 400 });
  }

  const store = await cookies();
  const challenge = await verifySession(store.get(CHALLENGE_COOKIE)?.value, sessionSecret());
  if (!challenge) {
    return NextResponse.json({ error: "challenge expired — start again" }, { status: 400 });
  }

  const { rpID, origins } = relyingParty();
  const verification = await verifyRegistrationResponse({
    response: body.response,
    expectedChallenge: challenge.sub,
    expectedOrigin: origins,
    expectedRPID: rpID,
  });

  store.delete(CHALLENGE_COOKIE);

  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json({ error: "verification failed" }, { status: 400 });
  }

  const { credential } = verification.registrationInfo;

  // Returned, not persisted: there is no database. These two values go into .env.local and
  // Vercel by hand, which is also what keeps enrolment a deliberate act.
  return NextResponse.json({
    verified: true,
    env: {
      PASSKEY_CREDENTIAL_ID: credential.id,
      PASSKEY_PUBLIC_KEY: bytesToBase64url(credential.publicKey),
    },
    next: "Add both values to .env.local and Vercel, then unset PASSKEY_REGISTRATION_SECRET.",
  });
}
