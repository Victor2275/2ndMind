import { cose, decodeCredentialPublicKey } from "@simplewebauthn/server/helpers";

import { toBase64url } from "@/lib/auth/base64url";

/**
 * COSE → JWK, so the browser can verify an assertion with no network and no CBOR parser.
 *
 * A stored credential's public key is COSE-encoded CBOR, which is the natural format for the
 * server — `@simplewebauthn` reads it directly. The browser cannot: `crypto.subtle.importKey`
 * speaks JWK, SPKI and raw, none of which is COSE, and a CBOR decoder in the client bundle to
 * bridge that gap would be a hand-written parser on the auth path for the sake of saving one
 * conversion. So the conversion happens once, here, on the server, and the client caches the
 * JWK it is handed (V3 §1.5, D-154).
 *
 * The result is not secret. It is a public key and a credential id, which is the entire reason
 * this can be cached on the device at all.
 */

export type LocalCredential = {
  /** base64url credential id, matched against the assertion's own id. */
  id: string;
  /** Ready for `crypto.subtle.importKey("jwk", …)`. */
  jwk: JsonWebKey;
  /** The COSE algorithm identifier, e.g. -7 for ES256. Decides the verify parameters. */
  alg: number;
  /** The relying party this key is bound to, checked against the assertion's rpIdHash. */
  rpId: string;
};

/** Thrown for a key this build cannot verify in the browser. Never for a malformed one. */
export class UnsupportedKeyError extends Error {
  constructor(readonly detail: string) {
    super(`This passkey cannot be verified offline: ${detail}`);
    this.name = "UnsupportedKeyError";
  }
}

const EC_CURVES: Record<number, string> = {
  [cose.COSECRV.P256]: "P-256",
  [cose.COSECRV.P384]: "P-384",
  [cose.COSECRV.P521]: "P-521",
};

export function coseToJwk(publicKey: Uint8Array<ArrayBuffer>): { jwk: JsonWebKey; alg: number } {
  const decoded = decodeCredentialPublicKey(publicKey);
  const alg = decoded.get(cose.COSEKEYS.alg);

  if (typeof alg !== "number") {
    throw new UnsupportedKeyError("the key does not name an algorithm");
  }

  if (cose.isCOSEPublicKeyEC2(decoded)) {
    const crv = decoded.get(cose.COSEKEYS.crv);
    const x = decoded.get(cose.COSEKEYS.x);
    const y = decoded.get(cose.COSEKEYS.y);
    const namedCurve = EC_CURVES[crv as number];

    if (!namedCurve) throw new UnsupportedKeyError(`unknown elliptic curve ${String(crv)}`);
    if (!(x instanceof Uint8Array) || !(y instanceof Uint8Array)) {
      throw new UnsupportedKeyError("the key is missing a coordinate");
    }

    return {
      alg,
      jwk: { kty: "EC", crv: namedCurve, x: toBase64url(x), y: toBase64url(y), ext: true },
    };
  }

  if (cose.isCOSEPublicKeyRSA(decoded)) {
    const n = decoded.get(cose.COSEKEYS.n);
    const e = decoded.get(cose.COSEKEYS.e);

    if (!(n instanceof Uint8Array) || !(e instanceof Uint8Array)) {
      throw new UnsupportedKeyError("the key is missing a modulus or exponent");
    }

    return {
      alg,
      jwk: { kty: "RSA", n: toBase64url(n), e: toBase64url(e), ext: true },
    };
  }

  // OKP/Ed25519 lands here. Web Crypto's Ed25519 support is still uneven across browsers, and
  // a passkey that verifies on the laptop but not the phone is worse than one that says so up
  // front — the caller degrades to "no offline unlock" rather than failing at the lock screen.
  throw new UnsupportedKeyError(`unsupported key type ${String(decoded.get(cose.COSEKEYS.kty))}`);
}
