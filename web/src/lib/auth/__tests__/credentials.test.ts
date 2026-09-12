import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Db } from "@/lib/tasks/queries";
import { bytesToBase64url, legacyEnvCredentials, storedCredentials } from "../config";

/**
 * Parsing PASSKEYS is the code that could lock Victor out of his own site under the old
 * scheme, and it is still read as a fallback (D-240), so the cases that would have done it are
 * still worth pinning: a stale legacy pair, a label containing a colon, a typo in one entry,
 * and the same authenticator enrolled twice.
 *
 * Deliberately not a `.db.test.ts`: it stubs environment variables, which is exactly what
 * `.db.test.ts` files must not do (`src/test/__tests__/db-test-conventions.test.ts`) because
 * they share one process. This file never touches Postgres, so it pays its own small setup
 * cost and keeps its isolation instead. `storedCredentials()`'s database-reading half is
 * covered separately in `credentials.db.test.ts`.
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

describe("legacyEnvCredentials", () => {
  it("is empty when nothing is configured", () => {
    expect(legacyEnvCredentials()).toEqual([]);
  });

  it("still honours the legacy single-credential pair", () => {
    // This pair is what was deployed before the move to Postgres (D-240). Dropping support
    // for it would have made the migration itself the thing that logs Victor out.
    vi.stubEnv("PASSKEY_CREDENTIAL_ID", "old-laptop");
    vi.stubEnv("PASSKEY_PUBLIC_KEY", KEY_A);
    expect(legacyEnvCredentials().map((c) => c.id)).toEqual(["old-laptop"]);
  });

  it("reads several devices from PASSKEYS", () => {
    vi.stubEnv("PASSKEYS", `laptop:id-a:${KEY_A},phone:id-b:${KEY_B}`);
    const found = legacyEnvCredentials();
    expect(found.map((c) => c.id)).toEqual(["id-a", "id-b"]);
    expect(found.map((c) => c.label)).toEqual(["laptop", "phone"]);
  });

  it("accepts newlines as well as commas", () => {
    // Vercel's multi-line environment editor is the likely place this gets pasted.
    vi.stubEnv("PASSKEYS", `laptop:id-a:${KEY_A}\n  phone:id-b:${KEY_B}\n`);
    expect(legacyEnvCredentials()).toHaveLength(2);
  });

  it("takes the id and key from the end, so a label may contain a colon", () => {
    vi.stubEnv("PASSKEYS", `victor's pixel: work:id-a:${KEY_A}`);
    const [only] = legacyEnvCredentials();
    expect(only.id).toBe("id-a");
    expect(only.label).toBe("victor's pixel: work");
  });

  it("names an unlabelled entry rather than leaving it blank", () => {
    vi.stubEnv("PASSKEYS", `id-a:${KEY_A}`);
    expect(legacyEnvCredentials()[0].label).toBe("device 1");
  });

  it("skips a malformed entry and keeps the rest", () => {
    // One typo should cost one device, not the ability to sign in at all.
    vi.stubEnv("PASSKEYS", `broken,phone:id-b:${KEY_B}`);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(legacyEnvCredentials().map((c) => c.id)).toEqual(["id-b"]);
  });

  it("does not list one authenticator twice when both forms name it", () => {
    // Mid-migration state: PASSKEYS added, legacy pair not yet deleted. Two entries for one
    // device would put a duplicate into excludeCredentials and block re-enrolment confusingly.
    vi.stubEnv("PASSKEY_CREDENTIAL_ID", "id-a");
    vi.stubEnv("PASSKEY_PUBLIC_KEY", KEY_A);
    vi.stubEnv("PASSKEYS", `laptop:id-a:${KEY_A},phone:id-b:${KEY_B}`);
    expect(legacyEnvCredentials().map((c) => c.id)).toEqual(["id-a", "id-b"]);
  });

  it("decodes the public key rather than passing the string through", () => {
    vi.stubEnv("PASSKEYS", `laptop:id-a:${KEY_A}`);
    expect(Array.from(legacyEnvCredentials()[0].publicKey)).toEqual([1, 2, 3]);
  });
});

describe("storedCredentials folding the environment in with the database", () => {
  // A fake handle rather than a real embedded database: this exercises the fold-in logic in
  // `config.ts` itself, not the table, so a plain object matching the one call
  // `storedCredentials` makes is enough — and it lets this case stay next to the env stubbing
  // it depends on. The database's own side is covered without any env stubbing in
  // `credentials.db.test.ts`.
  function fakeDb(rows: { id: string; publicKey: string; label: string }[]): Db {
    return { select: () => ({ from: async () => rows }) } as unknown as Db;
  }

  it("does not list one authenticator twice when both forms name it", async () => {
    // Mid-migration state: the same device known both to the environment and the table.
    vi.stubEnv("PASSKEY_CREDENTIAL_ID", "id-a");
    vi.stubEnv("PASSKEY_PUBLIC_KEY", KEY_A);
    const db = fakeDb([{ id: "id-a", publicKey: KEY_A, label: "laptop (db)" }]);

    const found = await storedCredentials(db);
    expect(found.map((c) => c.id)).toEqual(["id-a"]);
    // The environment wins the label, since it was already known before the row was read.
    expect(found[0].label).toBe("device 1");
  });

  it("appends database rows for devices the environment does not name", async () => {
    vi.stubEnv("PASSKEYS", `laptop:id-a:${KEY_A}`);
    const db = fakeDb([{ id: "id-b", publicKey: KEY_B, label: "phone" }]);

    const found = await storedCredentials(db);
    expect(found.map((c) => c.id)).toEqual(["id-a", "id-b"]);
  });
});
