import { startAuthentication } from "@simplewebauthn/browser";
import type { AuthenticationResponseJSON } from "@simplewebauthn/browser";

import { verifyAssertion } from "@/lib/auth/assertion";
import { toBase64url } from "@/lib/auth/base64url";
import type { LocalCredential } from "@/lib/auth/cose";

/**
 * The unlock ceremony: a biometric, verified here, with no network (V3 §1.5, D-154).
 *
 * The plan called for this to live in the service worker. It cannot, and the reason is not a
 * preference: `navigator.credentials` is exposed on `Window` only. A service worker has no
 * `CredentialsContainer` at all, so the prompt cannot be raised from one — it needs a document
 * and a user gesture. The verification is what the plan was really asking for, and it happens
 * here against the cached public key with nothing on the wire. D-154 records the change.
 *
 * `get` is injected so every branch below is a test rather than something only reachable by
 * standing in front of a phone with a fingerprint ready.
 */

export type UnlockOutcome =
  /** A real authenticator answered a fresh challenge and the signature checked out. */
  | { status: "unlocked" }
  /** The prompt was dismissed, or timed out. Not an error — say so gently and stay locked. */
  | { status: "cancelled" }
  /** Something answered, and it was wrong. This is the interesting one. */
  | { status: "refused"; reason: string }
  /** No cached key, or no WebAuthn here. The lock cannot be enforced; see `LocalLock`. */
  | { status: "unarmed"; reason: string };

export type Authenticator = (
  optionsJSON: Parameters<typeof startAuthentication>[0]["optionsJSON"],
) => Promise<AuthenticationResponseJSON>;

const defaultAuthenticator: Authenticator = (optionsJSON) => startAuthentication({ optionsJSON });

export async function unlockLocally(
  credentials: LocalCredential[],
  options: {
    origins: string[];
    authenticate?: Authenticator;
    randomBytes?: (length: number) => Uint8Array;
    subtle?: SubtleCrypto;
  },
): Promise<UnlockOutcome> {
  if (credentials.length === 0) {
    return { status: "unarmed", reason: "no passkey has been cached on this device yet" };
  }

  const authenticate = options.authenticate ?? defaultAuthenticator;
  const randomBytes =
    options.randomBytes ?? ((length: number) => crypto.getRandomValues(new Uint8Array(length)));

  // Generated here and never reused. This is what separates an unlock from a replay: an
  // assertion captured earlier answers a challenge that will never be asked again.
  const challenge = toBase64url(randomBytes(32));

  // Every cached key is offered, because which one is present depends on which device this is.
  const rpId = credentials[0].rpId;

  let assertion: AuthenticationResponseJSON;
  try {
    assertion = await authenticate({
      challenge,
      rpId,
      allowCredentials: credentials.map((c) => ({ id: c.id, type: "public-key" as const })),
      // Not "preferred". A lock that accepts a bare tap is a button, and the verifier refuses
      // an assertion without the user-verified bit regardless — asking for less here would
      // only produce a prompt that cannot succeed.
      userVerification: "required",
      timeout: 60_000,
    });
  } catch (error) {
    // A dismissed prompt, a timeout and "no matching credential" all arrive as NotAllowedError,
    // and none of them is a failure worth alarming about.
    if (error instanceof Error && error.name === "NotAllowedError") {
      return { status: "cancelled" };
    }
    return {
      status: "refused",
      reason: error instanceof Error ? error.message : "the passkey prompt failed",
    };
  }

  const credential = credentials.find((c) => c.id === assertion.id);
  if (!credential) {
    return { status: "refused", reason: "a passkey this device does not know about answered" };
  }

  const result = await verifyAssertion(
    {
      id: assertion.id,
      clientDataJSON: assertion.response.clientDataJSON,
      authenticatorData: assertion.response.authenticatorData,
      signature: assertion.response.signature,
    },
    credential,
    { challenge, origins: options.origins },
    options.subtle,
  );

  return result.ok ? { status: "unlocked" } : { status: "refused", reason: result.reason };
}
