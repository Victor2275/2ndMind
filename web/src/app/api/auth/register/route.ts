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
  relyingPartyProblem,
  serialiseCredentials,
  sessionSecret,
  storedCredentials,
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

  // Before the ceremony, not after: enrolling against the wrong relying party produces a
  // credential bound to a hostname that will never serve the site, and the only symptom is a
  // sign-in that fails later for reasons that look unrelated.
  const problem = relyingPartyProblem(request.headers.get("origin"));
  if (problem) return NextResponse.json({ error: problem }, { status: 500 });

  const { rpID, rpName } = relyingParty();
  const existing = storedCredentials();

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
    label?: string;
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

  // Colons and commas are the separators, so a label containing either would split into
  // something that no longer parses back. Stripped here rather than rejected: the label is a
  // convenience, and failing an otherwise-good enrolment over punctuation would be absurd.
  const label = (body.label ?? "").replace(/[:,\n]/g, " ").trim() || "device";

  // The whole list, not just the new device. Enrolment returns one variable to paste, so the
  // phone cannot be added by overwriting the laptop — which is exactly the mistake the old
  // two-variable output invited, and it locks you out of the machine you are sitting at.
  const all = serialiseCredentials([
    ...storedCredentials().map((c) => ({
      id: c.id,
      publicKey: bytesToBase64url(c.publicKey),
      label: c.label,
    })),
    { id: credential.id, publicKey: bytesToBase64url(credential.publicKey), label },
  ]);

  // Returned, not persisted: there is no database. The value goes into .env.local and Vercel
  // by hand, which is also what keeps enrolment a deliberate act.
  return NextResponse.json({
    verified: true,
    env: { PASSKEYS: all },
    next:
      "Set PASSKEYS to this value in .env.local and Vercel, remove PASSKEY_CREDENTIAL_ID and " +
      "PASSKEY_PUBLIC_KEY, then unset PASSKEY_REGISTRATION_SECRET and redeploy.",
  });
}
