import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { bytesToBase64url, serialiseCredentials, storedCredentials } from "../config";

/**
 * Parsing PASSKEYS is the code that can lock Victor out of his own site, so the cases below are
 * the ones that would actually do it: a stale legacy pair, a label containing a colon, a typo in
 * one entry, and the same authenticator enrolled twice.
 */

const KEY_A = bytesToBase64url(new Uint8Array([1, 2, 3]));
const KEY_B = bytesToBase64url(new Uint8Array([4, 5, 6]));

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("PASSKEY_CREDENTIAL_ID", undefined);
  vi.stubEnv("PASSKEY_PUBLIC_KEY", undefined);
  vi.stubEnv("PASSKEYS", undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("storedCredentials", () => {
  it("is empty when nothing is configured", () => {
    expect(storedCredentials()).toEqual([]);
  });

  it("still honours the legacy single-credential pair", () => {
    // This pair is what is deployed and working today. Dropping support for it would have made
    // multi-device support the change that logged Victor out.
    vi.stubEnv("PASSKEY_CREDENTIAL_ID", "old-laptop");
    vi.stubEnv("PASSKEY_PUBLIC_KEY", KEY_A);
    expect(storedCredentials().map((c) => c.id)).toEqual(["old-laptop"]);
  });

  it("reads several devices from PASSKEYS", () => {
    vi.stubEnv("PASSKEYS", `laptop:id-a:${KEY_A},phone:id-b:${KEY_B}`);
    const found = storedCredentials();
    expect(found.map((c) => c.id)).toEqual(["id-a", "id-b"]);
    expect(found.map((c) => c.label)).toEqual(["laptop", "phone"]);
  });

  it("accepts newlines as well as commas", () => {
    // Vercel's multi-line environment editor is the likely place this gets pasted.
    vi.stubEnv("PASSKEYS", `laptop:id-a:${KEY_A}\n  phone:id-b:${KEY_B}\n`);
    expect(storedCredentials()).toHaveLength(2);
  });

  it("takes the id and key from the end, so a label may contain a colon", () => {
    vi.stubEnv("PASSKEYS", `victor's pixel: work:id-a:${KEY_A}`);
    const [only] = storedCredentials();
    expect(only.id).toBe("id-a");
    expect(only.label).toBe("victor's pixel: work");
  });

  it("names an unlabelled entry rather than leaving it blank", () => {
    vi.stubEnv("PASSKEYS", `id-a:${KEY_A}`);
    expect(storedCredentials()[0].label).toBe("device 1");
  });

  it("skips a malformed entry and keeps the rest", () => {
    // One typo should cost one device, not the ability to sign in at all.
    vi.stubEnv("PASSKEYS", `broken,phone:id-b:${KEY_B}`);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(storedCredentials().map((c) => c.id)).toEqual(["id-b"]);
  });

  it("does not list one authenticator twice when both forms name it", () => {
    // Mid-migration state: PASSKEYS added, legacy pair not yet deleted. Two entries for one
    // device would put a duplicate into excludeCredentials and block re-enrolment confusingly.
    vi.stubEnv("PASSKEY_CREDENTIAL_ID", "id-a");
    vi.stubEnv("PASSKEY_PUBLIC_KEY", KEY_A);
    vi.stubEnv("PASSKEYS", `laptop:id-a:${KEY_A},phone:id-b:${KEY_B}`);
    expect(storedCredentials().map((c) => c.id)).toEqual(["id-a", "id-b"]);
  });

  it("decodes the public key rather than passing the string through", () => {
    vi.stubEnv("PASSKEYS", `laptop:id-a:${KEY_A}`);
    expect(Array.from(storedCredentials()[0].publicKey)).toEqual([1, 2, 3]);
  });
});

describe("serialiseCredentials", () => {
  it("round-trips through the parser", () => {
    // The enrolment endpoint builds a PASSKEYS value with this and the app reads it back with
    // storedCredentials. If the two ever disagree, enrolment silently produces a dead entry.
    const value = serialiseCredentials([
      { id: "id-a", publicKey: KEY_A, label: "laptop" },
      { id: "id-b", publicKey: KEY_B, label: "phone" },
    ]);
    vi.stubEnv("PASSKEYS", value);
    const found = storedCredentials();
    expect(found.map((c) => [c.label, c.id])).toEqual([
      ["laptop", "id-a"],
      ["phone", "id-b"],
    ]);
  });
});
