import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { generateRegistrationOptions, verifyRegistrationResponse } from "@simplewebauthn/server";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";

import {
  bytesToBase64url,
  registrationSecret,
  relyingParty,
  relyingPartyProblem,
  saveCredential,
  sessionSecret,
  storedCredentials,
} from "@/lib/auth/config";
import { CHALLENGE_COOKIE, signSession, verifySession } from "@/lib/auth/session";
import { db, isDatabaseConfigured } from "@/lib/db/client";

/**
 * Passkey enrolment. Self-serve: a new device can enrol and sign in immediately, with no env
 * edit and no redeploy, because the credential is written straight to Postgres.
 *
 * Gated on PASSKEY_REGISTRATION_SECRET being both set and supplied. Unlike the credential
 * itself, this secret is meant to stay configured permanently — it is what makes enrolment
 * self-serve rather than an open sign-up. With no credential configured and no gate, this
 * endpoint would hand the private site to whoever found it.
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
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "DATABASE_URL is not set — see web/.env.example" },
      {
        status: 500,
      },
    );
  }

  // Before the ceremony, not after: enrolling against the wrong relying party produces a
  // credential bound to a hostname that will never serve the site, and the only symptom is a
  // sign-in that fails later for reasons that look unrelated.
  const problem = relyingPartyProblem(request.headers.get("origin"));
  if (problem) return NextResponse.json({ error: problem }, { status: 500 });

  const { rpID, rpName } = relyingParty();
  const existing = await storedCredentials(db());

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: "victor",
    userDisplayName: "Victor Gusev",
    attestationType: "none",
    // Every device already enrolled. This does not block adding a second device — it blocks
    // adding the *same* device twice, which would otherwise mint a duplicate credential and
    // leave a dead entry in PASSKEYS that nobody could later tell apart from a live one.
    excludeCredentials: existing.map((c) => ({ id: c.id })),
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
      {
        sub: options.challenge,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 300,
      },
      sessionSecret(),
    ),
    { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" },
  );

  return NextResponse.json(options);
}

/** Step 2: verify the attestation and persist the credential. */
export async function POST(request: Request) {
  const body = (await request.json()) as {
    secret?: string;
    label?: string;
    response?: RegistrationResponseJSON;
  };
  if (!gateOpen(body.secret ?? null)) {
    return NextResponse.json({ error: "registration is disabled" }, { status: 403 });
  }
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "DATABASE_URL is not set — see web/.env.example" },
      {
        status: 500,
      },
    );
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

  // A label is a convenience for whoever reads the table later, not part of the ceremony, so
  // punctuation is stripped rather than rejected — failing an otherwise-good enrolment over it
  // would be absurd. No separator characters to protect here (unlike the old PASSKEYS string):
  // each field is its own column.
  const label = (body.label ?? "").replace(/[:,\n]/g, " ").trim() || "device";

  // Persisted immediately — this is the whole point of moving off PASSKEYS. No value to copy
  // anywhere, no redeploy: the device can sign in the moment this returns.
  await saveCredential(db(), {
    id: credential.id,
    publicKey: bytesToBase64url(credential.publicKey),
    label,
  });

  return NextResponse.json({ verified: true, label });
}
