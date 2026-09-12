// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";

import { resetTestDb } from "@/test/pg";
import type { Db } from "@/lib/tasks/queries";
import { bytesToBase64url, saveCredential, storedCredentials } from "../config";

/**
 * `passkey_credentials` (D-240) against the committed migration SQL in PGlite, not a mock —
 * the interesting bug here is a schema mismatch a mock cannot see.
 *
 * No environment stubbing here on purpose: `.db.test.ts` files share one process
 * (`src/test/__tests__/db-test-conventions.test.ts`), and `vi.stubEnv` would leak into whatever
 * else is running. The legacy `PASSKEYS` env var's own parsing is covered, with real env
 * stubbing, in `credentials.test.ts`; this file only exercises the database half.
 */

let db: Db;

const KEY_A = bytesToBase64url(new Uint8Array([1, 2, 3]));
const KEY_B = bytesToBase64url(new Uint8Array([4, 5, 6]));

beforeEach(async () => {
  db = await resetTestDb();
});

describe("storedCredentials", () => {
  it("is empty when the table is empty and no handle is given", async () => {
    expect(await storedCredentials()).toEqual([]);
  });

  it("is empty against an empty table", async () => {
    expect(await storedCredentials(db)).toEqual([]);
  });

  it("reads an enrolled credential back", async () => {
    await saveCredential(db, { id: "id-a", publicKey: KEY_A, label: "phone" });
    const found = await storedCredentials(db);
    expect(found).toHaveLength(1);
    expect(found[0].id).toBe("id-a");
    expect(found[0].label).toBe("phone");
  });

  it("decodes the stored public key rather than passing the string through", async () => {
    await saveCredential(db, { id: "id-a", publicKey: KEY_A, label: "phone" });
    expect(Array.from((await storedCredentials(db))[0].publicKey)).toEqual([1, 2, 3]);
  });

  it("keeps two enrolled devices apart", async () => {
    await saveCredential(db, { id: "id-a", publicKey: KEY_A, label: "laptop" });
    await saveCredential(db, { id: "id-b", publicKey: KEY_B, label: "phone" });
    const found = await storedCredentials(db);
    expect(found.map((c) => c.id).sort()).toEqual(["id-a", "id-b"]);
  });

  it("never touches the database when no handle is given", async () => {
    // A caller with the database unconfigured omits the handle entirely rather than passing
    // one that would throw — this is what lets sign-in still work off the legacy env vars
    // alone if Postgres is briefly unreachable.
    await saveCredential(db, { id: "id-a", publicKey: KEY_A, label: "laptop" });
    expect(await storedCredentials()).toEqual([]);
  });
});

describe("saveCredential", () => {
  it("persists a credential that storedCredentials then reads back", async () => {
    await saveCredential(db, { id: "id-a", publicKey: KEY_A, label: "phone" });
    expect((await storedCredentials(db)).map((c) => c.id)).toEqual(["id-a"]);
  });
});
