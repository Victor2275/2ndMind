import { bytesEqual, fromBase64url } from "@/lib/auth/base64url";
import type { LocalCredential } from "@/lib/auth/cose";

/**
 * A WebAuthn assertion, verified locally with no server (V3 §1.5, D-154).
 *
 * This is the same set of checks `@simplewebauthn/server` performs, done in the browser
 * against a cached public key so that unlocking works with no network. Everything here is
 * pure — bytes in, a verdict out — because the alternative is a security check that can only
 * be exercised by standing in front of a phone with the wifi off.
 *
 * **What this is worth, stated plainly, because it is easy to overrate.** The verifier and the
 * decision it feeds both run in JavaScript this origin serves, so anyone able to run code in
 * the origin can ignore it. It is not a defence against an attacker with developer tools; it
 * is a defence against someone picking up an unlocked phone, which is the threat this app
 * actually has. What the signature check buys over a boolean is that the lock cannot be opened
 * by anything short of the real authenticator answering a fresh challenge — a copied profile
 * directory, a replayed old assertion, or a stubbed `navigator.credentials` all fail it.
 *
 * The device lock screen remains the primary control. This is defence in depth, and D-154
 * records the limits it does not cover.
 */

export type AssertionInput = {
  /** base64url credential id, as returned by the authenticator. */
  id: string;
  clientDataJSON: string;
  authenticatorData: string;
  signature: string;
};

export type VerifyResult = { ok: true } | { ok: false; reason: string };

/** Authenticator data flag bits. Only the two that matter here are named. */
const FLAG_USER_PRESENT = 0x01;
const FLAG_USER_VERIFIED = 0x04;

const EC_FIELD_BYTES: Record<string, number> = { "P-256": 32, "P-384": 48, "P-521": 66 };

export async function verifyAssertion(
  assertion: AssertionInput,
  credential: LocalCredential,
  expected: {
    challenge: string;
    origins: string[];
    /** Platform passkeys always verify the user; a lock that did not require it is not a lock. */
    requireUserVerification?: boolean;
  },
  subtle: SubtleCrypto = crypto.subtle,
): Promise<VerifyResult> {
  if (assertion.id !== credential.id) {
    return { ok: false, reason: "a different passkey answered" };
  }

  let clientDataBytes: Uint8Array<ArrayBuffer>;
  let authData: Uint8Array<ArrayBuffer>;
  let signature: Uint8Array<ArrayBuffer>;
  try {
    clientDataBytes = fromBase64url(assertion.clientDataJSON);
    authData = fromBase64url(assertion.authenticatorData);
    signature = fromBase64url(assertion.signature);
  } catch {
    return { ok: false, reason: "the response was not readable" };
  }

  /* ------------------------------------------------------------- client data */

  let clientData: { type?: unknown; challenge?: unknown; origin?: unknown };
  try {
    clientData = JSON.parse(new TextDecoder().decode(clientDataBytes)) as typeof clientData;
  } catch {
    return { ok: false, reason: "the response was not readable" };
  }

  // `webauthn.create` here would mean a registration response replayed as a login. The
  // signature over it is perfectly valid, which is exactly why the type is checked separately.
  if (clientData.type !== "webauthn.get") {
    return { ok: false, reason: "that was not a sign-in response" };
  }

  // The challenge is generated fresh for each unlock and never reused, so this is what stops
  // a captured assertion from being replayed later.
  if (typeof clientData.challenge !== "string" || clientData.challenge !== expected.challenge) {
    return { ok: false, reason: "the response answered a different challenge" };
  }

  if (typeof clientData.origin !== "string" || !expected.origins.includes(clientData.origin)) {
    return { ok: false, reason: "the response came from another site" };
  }

  /* --------------------------------------------------- authenticator data */

  // 32 bytes of rpIdHash, one of flags, four of counter.
  if (authData.length < 37) {
    return { ok: false, reason: "the response was truncated" };
  }

  const expectedRpIdHash = new Uint8Array(
    await subtle.digest("SHA-256", new TextEncoder().encode(credential.rpId)),
  );
  if (!bytesEqual(authData.subarray(0, 32), expectedRpIdHash)) {
    return { ok: false, reason: "the passkey belongs to another domain" };
  }

  const flags = authData[32];
  if ((flags & FLAG_USER_PRESENT) === 0) {
    return { ok: false, reason: "nobody was present" };
  }
  if (expected.requireUserVerification !== false && (flags & FLAG_USER_VERIFIED) === 0) {
    // The authenticator signed without checking who was holding it — a tap, not a fingerprint.
    // Accepting it would turn a biometric lock into a button.
    return { ok: false, reason: "the passkey did not verify who you are" };
  }

  /* ---------------------------------------------------------- the signature */

  const clientDataHash = new Uint8Array(await subtle.digest("SHA-256", clientDataBytes));
  const signed = new Uint8Array(authData.length + clientDataHash.length);
  signed.set(authData, 0);
  signed.set(clientDataHash, authData.length);

  let params: ReturnType<typeof verifyParams>;
  let raw: Uint8Array;
  try {
    params = verifyParams(credential);
    raw = params.der ? derToRaw(signature, params.fieldBytes) : signature;
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : "unsupported passkey" };
  }

  let key: CryptoKey;
  try {
    key = await subtle.importKey("jwk", credential.jwk, params.import, false, ["verify"]);
  } catch {
    return { ok: false, reason: "the stored key could not be read" };
  }

  const verified = await subtle.verify(
    params.verify,
    key,
    raw as unknown as BufferSource,
    signed as unknown as BufferSource,
  );

  return verified ? { ok: true } : { ok: false, reason: "the signature did not check out" };
}

/** Web Crypto parameters for a COSE algorithm, and whether its signature arrives DER-encoded. */
function verifyParams(credential: LocalCredential): {
  import: EcKeyImportParams | RsaHashedImportParams;
  verify: EcdsaParams | AlgorithmIdentifier;
  der: boolean;
  fieldBytes: number;
} {
  const hashFor: Record<number, string> = {
    [-7]: "SHA-256",
    [-35]: "SHA-384",
    [-36]: "SHA-512",
    [-257]: "SHA-256",
    [-258]: "SHA-384",
    [-259]: "SHA-512",
  };
  const hash = hashFor[credential.alg];
  if (!hash) throw new Error("this passkey uses an algorithm this app cannot verify");

  if (credential.jwk.kty === "EC") {
    const namedCurve = credential.jwk.crv ?? "P-256";
    const fieldBytes = EC_FIELD_BYTES[namedCurve];
    if (!fieldBytes) throw new Error("this passkey uses a curve this app cannot verify");
    return {
      import: { name: "ECDSA", namedCurve },
      verify: { name: "ECDSA", hash },
      der: true,
      fieldBytes,
    };
  }

  if (credential.jwk.kty === "RSA") {
    return {
      import: { name: "RSASSA-PKCS1-v1_5", hash },
      verify: { name: "RSASSA-PKCS1-v1_5" },
      der: false,
      fieldBytes: 0,
    };
  }

  throw new Error("this passkey uses a key type this app cannot verify");
}

/**
 * ASN.1 DER `SEQUENCE { INTEGER r, INTEGER s }` → the fixed-width `r || s` Web Crypto wants.
 *
 * A genuine interoperability trap rather than an implementation detail: authenticators emit
 * ECDSA signatures DER-encoded, `crypto.subtle.verify` accepts only raw, and handing it DER
 * does not throw — it returns `false`. So the failure looks exactly like a wrong fingerprint,
 * on every attempt, with nothing in any log to say otherwise.
 *
 * The two integers are signed, so a value whose top bit is set carries a leading zero byte
 * that has to come off, and a short value has to be left-padded back to the field width.
 */
export function derToRaw(der: Uint8Array, fieldBytes: number): Uint8Array {
  let offset = 0;
  const byte = () => {
    if (offset >= der.length) throw new Error("the signature was truncated");
    return der[offset++];
  };

  if (byte() !== 0x30) throw new Error("the signature was not in the expected format");

  // Length may be long-form (0x81 nn) once the two integers pass 127 bytes, which P-521 does.
  const first = byte();
  if (first & 0x80) offset += first & 0x7f;

  const readInteger = (): Uint8Array => {
    if (byte() !== 0x02) throw new Error("the signature was not in the expected format");
    const length = byte();
    if (offset + length > der.length) throw new Error("the signature was truncated");
    let value = der.subarray(offset, offset + length);
    offset += length;

    // Strip the sign byte DER adds when the high bit is set…
    while (value.length > 1 && value[0] === 0x00) value = value.subarray(1);
    if (value.length > fieldBytes) throw new Error("the signature was not in the expected format");

    // …then pad back to the fixed width Web Crypto expects.
    const padded = new Uint8Array(fieldBytes);
    padded.set(value, fieldBytes - value.length);
    return padded;
  };

  const r = readInteger();
  const s = readInteger();

  const raw = new Uint8Array(fieldBytes * 2);
  raw.set(r, 0);
  raw.set(s, fieldBytes);
  return raw;
}
