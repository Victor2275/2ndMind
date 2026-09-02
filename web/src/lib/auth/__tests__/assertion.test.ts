// @vitest-environment node
import { isoCBOR } from "@simplewebauthn/server/helpers";
import { beforeAll, describe, expect, it } from "vitest";

import { derToRaw, verifyAssertion, type AssertionInput } from "@/lib/auth/assertion";
import { toBase64url } from "@/lib/auth/base64url";
import { coseToJwk, UnsupportedKeyError, type LocalCredential } from "@/lib/auth/cose";
import {
  coseFor,
  fakeAuthenticator,
  rawToDer,
  type FakeAuthenticator,
  type SignedAssertion,
} from "@/test/webauthn";

/**
 * The local unlock verifier, exercised against real signatures from a real key pair.
 *
 * Every check in `verifyAssertion` exists to refuse a specific forgery, and a test that only
 * confirms the happy path proves none of them. So each rejection gets a case that would pass
 * if that one check were deleted — the assertion is genuinely signed in every one of them,
 * and only the thing being tested is wrong.
 *
 * The signature format matters more than it looks. Authenticators emit ECDSA signatures
 * DER-encoded and `crypto.subtle.verify` accepts only raw `r || s`; handing it the wrong one
 * returns `false` rather than throwing, so the bug would look exactly like a wrong fingerprint
 * every single time. The harness in `@/test/webauthn` signs the way an authenticator does
 * rather than the way Node does, which is the only reason that trap is visible here.
 */

const RP_ID = "victorgusev.com";
const ORIGIN = "https://victorgusev.com";

let device: FakeAuthenticator;
let credential: LocalCredential;

const assertionFor = (overrides = {}) => device.assert(overrides);

const verify = (assertion: SignedAssertion, credentialOverride?: LocalCredential) =>
  verifyAssertion(assertion as AssertionInput, credentialOverride ?? credential, {
    challenge: assertion.challenge,
    origins: [ORIGIN, "https://www.victorgusev.com"],
  });

beforeAll(async () => {
  device = await fakeAuthenticator({ rpId: RP_ID, origin: ORIGIN });
  credential = device.credential;
});

describe("a genuine assertion", () => {
  it("verifies with no network and no server", async () => {
    expect(await verify(await assertionFor())).toEqual({ ok: true });
  });

  it("verifies on the www origin too, because either may be primary", async () => {
    const assertion = await assertionFor({ origin: "https://www.victorgusev.com" });
    expect(await verify(assertion)).toEqual({ ok: true });
  });
});

describe("what it refuses", () => {
  it("a signature that does not match the data", async () => {
    const result = await verify(await assertionFor({ tamperSignature: true }));
    expect(result).toEqual({ ok: false, reason: "the signature did not check out" });
  });

  it("an assertion answering a challenge we did not issue", async () => {
    // The replay: a captured assertion, presented again later. Genuinely signed, and the
    // signature check alone would accept it — the fresh challenge is what does not.
    const captured = await assertionFor();
    const result = await verifyAssertion(captured, credential, {
      challenge: toBase64url(crypto.getRandomValues(new Uint8Array(32))),
      origins: [ORIGIN],
    });
    expect(result).toEqual({ ok: false, reason: "the response answered a different challenge" });
  });

  it("an assertion produced for another site", async () => {
    const result = await verify(await assertionFor({ origin: "https://evil.example" }));
    expect(result).toEqual({ ok: false, reason: "the response came from another site" });
  });

  it("a registration response replayed as a sign-in", async () => {
    const result = await verify(await assertionFor({ type: "webauthn.create" }));
    expect(result).toEqual({ ok: false, reason: "that was not a sign-in response" });
  });

  it("a passkey bound to a different domain", async () => {
    const result = await verify(await assertionFor({ rpId: "someone-elses-site.com" }));
    expect(result).toEqual({ ok: false, reason: "the passkey belongs to another domain" });
  });

  it("a tap that never verified who was holding the phone", async () => {
    // The one that turns a biometric lock back into a button, and the only sign of it is a
    // single bit in the authenticator data.
    const result = await verify(await assertionFor({ userVerified: false }));
    expect(result).toEqual({ ok: false, reason: "the passkey did not verify who you are" });
  });

  it("an assertion with nobody present at all", async () => {
    const assertion = await assertionFor({ userPresent: false, userVerified: false });
    expect(await verify(assertion)).toEqual({ ok: false, reason: "nobody was present" });
  });

  it("a different enrolled passkey answering", async () => {
    const result = await verify(await assertionFor({ id: "c29tZS1vdGhlci1rZXk" }));
    expect(result).toEqual({ ok: false, reason: "a different passkey answered" });
  });

  it("a well-formed assertion against somebody else's public key", async () => {
    const other = await fakeAuthenticator({ rpId: RP_ID, origin: ORIGIN });

    const result = await verify(await assertionFor(), other.credential);
    expect(result).toEqual({ ok: false, reason: "the signature did not check out" });
  });

  it("a truncated response, without throwing", async () => {
    const assertion = await assertionFor();
    const result = await verify({
      ...assertion,
      authenticatorData: toBase64url(new Uint8Array(8)),
    });
    expect(result).toEqual({ ok: false, reason: "the response was truncated" });
  });

  it("client data that is not JSON, without throwing", async () => {
    const assertion = await assertionFor();
    const result = await verify({
      ...assertion,
      clientDataJSON: toBase64url(new Uint8Array([1, 2, 3])),
    });
    expect(result).toEqual({ ok: false, reason: "the response was not readable" });
  });
});

describe("the DER signature format", () => {
  it("rejects a raw signature, which is what a naive implementation would send", async () => {
    // Not a hypothetical: `crypto.subtle.verify` returns false rather than throwing on the
    // wrong encoding, so getting this backwards produces a lock that never opens and never
    // says why. This test is the difference between finding that here and finding it on the
    // phone, offline, at the airport.
    const result = await verify(await assertionFor({ signRaw: true }));
    expect(result.ok).toBe(false);
  });

  it("unpacks r and s, stripping DER's sign byte and padding back to width", () => {
    const r = new Uint8Array(32).fill(0xaa);
    const s = new Uint8Array(32).fill(0xbb);
    const raw = new Uint8Array([...r, ...s]);

    expect(derToRaw(rawToDer(raw), 32)).toEqual(raw);
  });

  it("left-pads a short integer rather than shifting the halves", () => {
    // An r that happens to start with zero bytes is encoded shorter. Copying it in without
    // padding slides s left by the same amount and every signature that day fails.
    const r = new Uint8Array(32);
    r.set([0x01, 0x02], 30);
    const s = new Uint8Array(32).fill(0x7f);
    const raw = new Uint8Array([...r, ...s]);

    expect(derToRaw(rawToDer(raw), 32)).toEqual(raw);
  });

  it("refuses a signature that is not a DER sequence", () => {
    expect(() => derToRaw(new Uint8Array([0x02, 0x01, 0x00]), 32)).toThrow();
  });
});

describe("the stored key", () => {
  it("converts an EC2 COSE key into something the browser can import", async () => {
    const { jwk, alg } = coseToJwk(await coseFor(device.keys.publicKey));
    expect(alg).toBe(-7);
    expect(jwk).toMatchObject({ kty: "EC", crv: "P-256" });
    await expect(
      crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, [
        "verify",
      ]),
    ).resolves.toBeDefined();
  });

  it("refuses a key type it cannot verify, rather than producing one that never works", () => {
    // Ed25519. Browser support is uneven, so the caller degrades to "no offline unlock" up
    // front instead of failing at the lock screen with no network to fall back on.
    const encoded = isoCBOR.encode(
      new Map<number, number | Uint8Array>([
        [1, 1],
        [3, -8],
        [-1, 6],
        [-2, new Uint8Array(32).fill(3)],
      ]),
    );
    const okp = new Uint8Array(new ArrayBuffer(encoded.byteLength));
    okp.set(new Uint8Array(encoded));

    expect(() => coseToJwk(okp)).toThrow(UnsupportedKeyError);
  });
});
