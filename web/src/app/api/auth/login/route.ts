import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";

import {
  relyingParty,
  relyingPartyProblem,
  sessionSecret,
  storedCredentials,
} from "@/lib/auth/config";
import { coseToJwk, type LocalCredential } from "@/lib/auth/cose";
import {
  CHALLENGE_COOKIE,
  newSessionPayload,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  signSession,
  verifySession,
} from "@/lib/auth/session";
import { RETURNING_COOKIE, RETURNING_MAX_AGE } from "@/lib/auth/returning";

export const dynamic = "force-dynamic";

/** Step 1: challenge. */
export async function GET(request: Request) {
  const credentials = storedCredentials();
  if (credentials.length === 0) {
    return NextResponse.json({ error: "no passkey enrolled" }, { status: 503 });
  }

  // Checked before the ceremony starts, so a misconfigured origin is a sentence rather than
  // an opaque DOMException in the browser.
  const problem = relyingPartyProblem(request.headers.get("origin"));
  if (problem) return NextResponse.json({ error: problem }, { status: 500 });

  const { rpID } = relyingParty();
  const options = await generateAuthenticationOptions({
    rpID,
    // Every enrolled device, so the browser can offer whichever one is actually present.
    allowCredentials: credentials.map((c) => ({ id: c.id })),
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
  const credentials = storedCredentials();
  if (credentials.length === 0) {
    return NextResponse.json({ error: "no passkey enrolled" }, { status: 503 });
  }

  const body = (await request.json()) as { response?: AuthenticationResponseJSON };
  if (!body.response) {
    return NextResponse.json({ error: "missing response" }, { status: 400 });
  }

  // Which device signed this. Matching on the asserted id is what makes more than one enrolled
  // device possible; verifying against the first credential in the list would reject the phone
  // whenever the laptop happened to be listed first. An unknown id is an ordinary auth failure
  // and gets the same opaque message as any other, so this does not become an oracle for which
  // credential ids are registered.
  const credential = credentials.find((c) => c.id === body.response!.id);
  if (!credential) {
    return NextResponse.json({ error: "verification failed" }, { status: 401 });
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

  // Deliberately readable by scripts, and deliberately outlives the session. See
  // RETURNING_COOKIE: it decides whether a link is drawn on a static public page, nothing more.
  store.set(RETURNING_COOKIE, "1", {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: RETURNING_MAX_AGE,
  });

  // Hand back the public half of the passkey that just answered, so the device can verify a
  // biometric offline without asking anything (V3 §1.5, D-154). Nothing here is secret: a
  // credential id and a public key, both already public, and only after a successful sign-in.
  //
  // A key this build cannot verify in a browser costs the offline lock, not the sign-in —
  // hence the try. Failing the login over it would be a regression for a feature that is
  // supposed to be additive.
  let local: LocalCredential | null = null;
  try {
    const { jwk, alg } = coseToJwk(credential.publicKey);
    local = { id: credential.id, jwk, alg, rpId: rpID };
  } catch (error) {
    console.warn(`local unlock unavailable for "${credential.label}":`, error);
  }

  return NextResponse.json({ verified: true, local });
}

/** Sign out. */
export async function DELETE() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  // Signing out is a deliberate act, and on a borrowed or shared machine it should not leave a
  // "Victor signs in here" sign on the public site. An expiring session does not clear this —
  // that case wants the link, so the shortcut back to /signin is still there.
  store.delete(RETURNING_COOKIE);
  return NextResponse.json({ ok: true });
}
