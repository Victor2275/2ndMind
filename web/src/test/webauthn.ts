import { isoCBOR } from "@simplewebauthn/server/helpers";

import { fromBase64url, toBase64url } from "@/lib/auth/base64url";
import { coseToJwk, type LocalCredential } from "@/lib/auth/cose";

/**
 * A real authenticator, in about eighty lines.
 *
 * Local unlock is a signature check, so testing it against anything but a genuine signature
 * tests nothing. This generates a P-256 key pair, produces properly formed client data and
 * authenticator data, signs them, and hands back the same three base64url strings a browser
 * would — with one thing wrong when a test asks for it, and everything else still correct.
 *
 * The DER re-encoding is the part that earns its keep. Node's Web Crypto signs ECDSA as raw
 * `r || s`; every real authenticator emits DER. Skipping that step here would make the tests
 * agree with a verifier that could never open a lock on an actual phone.
 */

export type FakeAuthenticator = {
  credential: LocalCredential;
  keys: CryptoKeyPair;
  assert: (overrides?: AssertionOverrides) => Promise<SignedAssertion>;
};

export type AssertionOverrides = {
  challenge?: string;
  origin?: string;
  type?: string;
  rpId?: string;
  userPresent?: boolean;
  userVerified?: boolean;
  id?: string;
  tamperSignature?: boolean;
  /** Skip the DER encoding — what a naive implementation would produce. */
  signRaw?: boolean;
};

export type SignedAssertion = {
  id: string;
  challenge: string;
  clientDataJSON: string;
  authenticatorData: string;
  signature: string;
};

/** Node signs ECDSA as raw `r || s`; an authenticator hands back DER. Re-encode it. */
export function rawToDer(raw: Uint8Array): Uint8Array {
  const half = raw.length / 2;
  const encodeInteger = (value: Uint8Array): number[] => {
    let start = 0;
    while (start < value.length - 1 && value[start] === 0) start += 1;
    const trimmed = [...value.subarray(start)];
    // DER integers are signed, so a leading byte above 0x7f needs a zero in front of it.
    if (trimmed[0] & 0x80) trimmed.unshift(0);
    return [0x02, trimmed.length, ...trimmed];
  };

  const body = [...encodeInteger(raw.subarray(0, half)), ...encodeInteger(raw.subarray(half))];
  const header = body.length > 127 ? [0x30, 0x81, body.length] : [0x30, body.length];
  return new Uint8Array([...header, ...body]);
}

/** The COSE key an authenticator would have registered for this public key. */
export async function coseFor(publicKey: CryptoKey): Promise<Uint8Array<ArrayBuffer>> {
  const jwk = await crypto.subtle.exportKey("jwk", publicKey);
  const encoded = isoCBOR.encode(
    new Map<number, number | Uint8Array>([
      [1, 2], // kty: EC2
      [3, -7], // alg: ES256
      [-1, 1], // crv: P-256
      [-2, fromBase64url(jwk.x!)],
      [-3, fromBase64url(jwk.y!)],
    ]),
  );
  const bytes = new Uint8Array(new ArrayBuffer(encoded.byteLength));
  bytes.set(new Uint8Array(encoded));
  return bytes;
}

/** Authenticator data: rpIdHash ‖ flags ‖ counter. */
export async function authenticatorData(
  rpId: string,
  { userPresent = true, userVerified = true } = {},
): Promise<Uint8Array> {
  const hash = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rpId)),
  );
  const data = new Uint8Array(37);
  data.set(hash, 0);
  data[32] = (userPresent ? 0x01 : 0x00) | (userVerified ? 0x04 : 0x00);
  return data;
}

export async function fakeAuthenticator(options: {
  rpId: string;
  origin: string;
  id?: string;
}): Promise<FakeAuthenticator> {
  const keys = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;

  const { jwk, alg } = coseToJwk(await coseFor(keys.publicKey));
  const credential: LocalCredential = {
    id: options.id ?? "Y3JlZGVudGlhbC1pZA",
    jwk,
    alg,
    rpId: options.rpId,
  };

  async function assert(overrides: AssertionOverrides = {}): Promise<SignedAssertion> {
    const challenge =
      overrides.challenge ?? toBase64url(crypto.getRandomValues(new Uint8Array(32)));

    const clientData = new TextEncoder().encode(
      JSON.stringify({
        type: overrides.type ?? "webauthn.get",
        challenge,
        origin: overrides.origin ?? options.origin,
        crossOrigin: false,
      }),
    );

    const authData = await authenticatorData(overrides.rpId ?? options.rpId, {
      userPresent: overrides.userPresent,
      userVerified: overrides.userVerified,
    });

    const clientDataHash = new Uint8Array(await crypto.subtle.digest("SHA-256", clientData));
    const signed = new Uint8Array(authData.length + clientDataHash.length);
    signed.set(authData, 0);
    signed.set(clientDataHash, authData.length);

    const rawSignature = new Uint8Array(
      await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, keys.privateKey, signed),
    );
    if (overrides.tamperSignature) rawSignature[0] ^= 0xff;

    return {
      id: overrides.id ?? credential.id,
      challenge,
      clientDataJSON: toBase64url(clientData),
      authenticatorData: toBase64url(authData),
      signature: toBase64url(overrides.signRaw ? rawSignature : rawToDer(rawSignature)),
    };
  }

  return { credential, keys, assert };
}
