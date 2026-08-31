// @vitest-environment jsdom
import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { HlcClock } from "@/lib/sync/hlc";
import {
  applyRemote,
  deviceId,
  enqueue,
  failedOps,
  forgetOp,
  getCursor,
  getLocal,
  listLocal,
  loadClock,
  markFailed,
  openSyncDb,
  pendingBatch,
  pendingCount,
  requeue,
  retryLater,
  saveClock,
  setCursor,
  type SyncDb,
} from "@/lib/sync/store";

/**
 * The offline store, against a real IndexedDB implementation (`fake-indexeddb` is the actual
 * algorithm, not a stub) — the same standard the database tests hold themselves to.
 *
 * Each test gets its own database name so nothing leaks between them; `fake-indexeddb` keeps
 * one global registry, and a shared name makes tests order-dependent in a way that only shows
 * up when someone adds the eighth test.
 */

let db: SyncDb;
let names = 0;
let name: string;
let clock: HlcClock;

beforeEach(async () => {
  name = `test-${++names}-${Math.random().toString(36).slice(2)}`;
  db = await openSyncDb(name);
  clock = new HlcClock("device-a", () => Date.now());
});

afterEach(() => {
  db?.close();
});

const entry = (clientId: string, note = "") => ({ clientId, category: "day", note });

describe("device identity", () => {
  it("mints an id once and keeps it", async () => {
    // It is the final tiebreak in every HLC comparison, so a device that re-rolled its id each
    // launch could tie with its own past stamps.
    const first = await deviceId(db);
    expect(first).toMatch(/^[0-9a-f-]{36}$/);
    expect(await deviceId(db)).toBe(first);
  });

  it("survives closing and reopening the database", async () => {
    const first = await deviceId(db);
    db.close();
    db = await openSyncDb(name);
    expect(await deviceId(db)).toBe(first);
  });
});

describe("clock and cursor persistence", () => {
  it("round-trips the clock, so a reload does not rewind it", async () => {
    expect(await loadClock(db)).toEqual({ wallMs: 0, counter: 0 });
    await saveClock(db, { wallMs: 1234, counter: 7 });
    db.close();
    db = await openSyncDb(name);
    expect(await loadClock(db)).toEqual({ wallMs: 1234, counter: 7 });
  });

  it("starts the cursor at zero and remembers where it got to", async () => {
    expect(await getCursor(db)).toBe(0);
    await setCursor(db, 4096);
    expect(await getCursor(db)).toBe(4096);
  });
});

describe("writing offline", () => {
  it("makes the row readable immediately and queues it", async () => {
    await enqueue(db, { entity: "log_entry", op: "create", row: entry("a"), hlc: clock.tick() });

    const rows = await listLocal(db, "log_entry");
    expect(rows).toHaveLength(1);
    expect(rows[0].row).toMatchObject({ clientId: "a" });
    expect(rows[0].dirty).toBe(1);
    expect(rows[0].serverSeq).toBeNull();
    expect(await pendingCount(db)).toBe(1);
  });

  it("survives a force-quit and a reboot", async () => {
    // §1.2's stated done-when, and the reason this is IndexedDB and not localStorage. Closing
    // the connection and reopening from the same origin is what a cold app launch does.
    await enqueue(db, {
      entity: "log_entry",
      op: "create",
      row: entry("a", "wrote this on a plane"),
      hlc: clock.tick(),
    });

    db.close();
    db = await openSyncDb(name);

    const rows = await listLocal(db, "log_entry");
    expect(rows[0].row).toMatchObject({ note: "wrote this on a plane" });
    expect(await pendingCount(db)).toBe(1);
  });

  it("addresses natural-key tables by their natural key", async () => {
    // No client id on these, by design — the key they already have makes an offline create
    // idempotent for free.
    await enqueue(db, {
      entity: "rehab",
      op: "create",
      row: { completedOn: "2026-08-31", slug: "banded-external-rotation" },
      hlc: clock.tick(),
    });

    const record = await getLocal(db, "rehab", "2026-08-31|banded-external-rotation");
    expect(record).toBeDefined();
  });

  it("refuses to queue a write for a pull-only table", async () => {
    // Not a user-facing error — a programming one. The server would reject it after a round
    // trip, and this catches it before it costs a flush.
    await expect(
      enqueue(db, {
        entity: "workout",
        op: "create",
        row: { clientId: "w1" },
        hlc: clock.tick(),
      }),
    ).rejects.toThrow(/pull-only/);
  });

  it("hides a deleted row but keeps it, because a tombstone is a row", async () => {
    await enqueue(db, { entity: "log_entry", op: "create", row: entry("a"), hlc: clock.tick() });
    await enqueue(db, { entity: "log_entry", op: "delete", row: entry("a"), hlc: clock.tick() });

    expect(await listLocal(db, "log_entry")).toHaveLength(0);
    expect((await getLocal(db, "log_entry", "a"))?.deletedAt).not.toBeNull();
  });
});

describe("queue order", () => {
  it("sends ops in the order they were made, not in key order", async () => {
    // Ordered by HLC rather than by createdAt: two ops written in the same millisecond share a
    // timestamp, and IndexedDB would then fall back to key order, which is a random UUID. A
    // create arriving after its own update is exactly the bug that causes.
    const first = await enqueue(db, {
      entity: "log_entry",
      op: "create",
      row: entry("a"),
      hlc: clock.tick(),
    });
    const second = await enqueue(db, {
      entity: "log_entry",
      op: "update",
      row: entry("a", "edited"),
      hlc: clock.tick(),
    });

    expect((await pendingBatch(db)).map((op) => op.opId)).toEqual([first.opId, second.opId]);
  });

  it("respects the batch limit", async () => {
    for (let i = 0; i < 5; i++) {
      await enqueue(db, {
        entity: "log_entry",
        op: "create",
        row: entry(`a${i}`),
        hlc: clock.tick(),
      });
    }
    expect(await pendingBatch(db, 3)).toHaveLength(3);
  });

  it("a failed op blocks later ops on the same row", async () => {
    // Otherwise a rejected create is skipped and its follow-up update lands on a row the
    // server has never heard of.
    const create = await enqueue(db, {
      entity: "log_entry",
      op: "create",
      row: entry("a"),
      hlc: clock.tick(),
    });
    await enqueue(db, {
      entity: "log_entry",
      op: "update",
      row: entry("a", "edited"),
      hlc: clock.tick(),
    });

    await markFailed(db, create.opId, { at: Date.now(), status: 400, message: "bad" });

    expect(await pendingBatch(db)).toHaveLength(0);
  });

  it("and blocks nothing else", async () => {
    // A global block is how one malformed entry from last week stops the app syncing at all.
    const create = await enqueue(db, {
      entity: "log_entry",
      op: "create",
      row: entry("a"),
      hlc: clock.tick(),
    });
    const other = await enqueue(db, {
      entity: "log_entry",
      op: "create",
      row: entry("b"),
      hlc: clock.tick(),
    });

    await markFailed(db, create.opId, { at: Date.now(), status: 400, message: "bad" });

    expect((await pendingBatch(db)).map((op) => op.opId)).toEqual([other.opId]);
  });
});

describe("outbox outcomes", () => {
  it("forgets an accepted op and marks the row settled", async () => {
    const op = await enqueue(db, {
      entity: "log_entry",
      op: "create",
      row: entry("a"),
      hlc: clock.tick(),
    });
    await forgetOp(db, op.opId);

    expect(await pendingCount(db)).toBe(0);
    expect((await getLocal(db, "log_entry", "a"))?.dirty).toBe(0);
  });

  it("keeps a row dirty while a later edit to it is still queued", async () => {
    // Clearing the flag per-op would mark the row settled while an unsent change to it waits,
    // and the merge below would then let a server copy overwrite that change.
    const create = await enqueue(db, {
      entity: "log_entry",
      op: "create",
      row: entry("a"),
      hlc: clock.tick(),
    });
    await enqueue(db, {
      entity: "log_entry",
      op: "update",
      row: entry("a", "edited"),
      hlc: clock.tick(),
    });

    await forgetOp(db, create.opId);
    expect((await getLocal(db, "log_entry", "a"))?.dirty).toBe(1);
  });

  it("counts a transient failure without dropping the op", async () => {
    const op = await enqueue(db, {
      entity: "log_entry",
      op: "create",
      row: entry("a"),
      hlc: clock.tick(),
    });
    await retryLater(db, op.opId, { at: 1, status: 503, message: "upstream" });

    const [still] = await pendingBatch(db);
    expect(still.attempts).toBe(1);
    expect(still.state).toBe("pending");
    expect(still.lastError?.status).toBe(503);
  });

  it("surfaces a permanent failure and never retries it on its own", async () => {
    const op = await enqueue(db, {
      entity: "log_entry",
      op: "create",
      row: entry("a"),
      hlc: clock.tick(),
    });
    await markFailed(db, op.opId, { at: 1, status: 400, message: "invalid category" });

    expect(await pendingBatch(db)).toHaveLength(0);
    const failed = await failedOps(db);
    expect(failed).toHaveLength(1);
    expect(failed[0].lastError?.message).toBe("invalid category");

    // Nothing is ever discarded — the retry screen can put it back after a fix.
    await requeue(db, op.opId);
    expect(await pendingBatch(db)).toHaveLength(1);
  });
});

describe("merging what the server sends", () => {
  const remote = (clientId: string, hlc: string, note = "server", seq = 1) => ({
    row: { clientId, category: "day", note },
    updatedHlc: hlc,
    deletedAt: null,
    serverSeq: seq,
  });

  it("writes a row it has never seen", async () => {
    expect(await applyRemote(db, "log_entry", remote("a", "00000000005-0000-x"))).toBe(true);
    const [row] = await listLocal(db, "log_entry");
    expect(row.row).toMatchObject({ note: "server" });
    expect(row.dirty).toBe(0);
  });

  it("takes the later stamp when both sides are settled", async () => {
    await applyRemote(db, "log_entry", remote("a", "00000000005-0000-x", "old", 1));
    await applyRemote(db, "log_entry", remote("a", "00000000009-0000-x", "new", 2));

    expect((await getLocal(db, "log_entry", "a"))?.row).toMatchObject({ note: "new" });
  });

  it("keeps the older stamp from overwriting a newer one", async () => {
    await applyRemote(db, "log_entry", remote("a", "00000000009-0000-x", "new", 2));
    expect(await applyRemote(db, "log_entry", remote("a", "00000000005-0000-x", "old", 3))).toBe(
      false,
    );
    expect((await getLocal(db, "log_entry", "a"))?.row).toMatchObject({ note: "new" });
  });

  it("never overwrites an unsent local edit, even with a newer server stamp", async () => {
    // The server has not seen this change yet, so it is not a conflict — it will win or lose
    // on its own stamp when it is flushed. Overwriting it here would throw away something the
    // user typed without telling them.
    await enqueue(db, {
      entity: "log_entry",
      op: "create",
      row: entry("a", "mine"),
      hlc: clock.tick(),
    });

    expect(await applyRemote(db, "log_entry", remote("a", "zzzzzzzzzzz-zzzz-x", "theirs", 9))).toBe(
      false,
    );
    expect((await getLocal(db, "log_entry", "a"))?.row).toMatchObject({ note: "mine" });
  });

  it("still records the cursor value for a row it declined to overwrite", async () => {
    // Otherwise the same row comes back on every sync forever, because nothing ever advances
    // past it.
    await enqueue(db, {
      entity: "log_entry",
      op: "create",
      row: entry("a", "mine"),
      hlc: clock.tick(),
    });
    await applyRemote(db, "log_entry", remote("a", "zzzzzzzzzzz-zzzz-x", "theirs", 9));

    expect((await getLocal(db, "log_entry", "a"))?.serverSeq).toBe(9);
  });

  it("applies a delete made on another device", async () => {
    await applyRemote(db, "log_entry", remote("a", "00000000005-0000-x", "alive", 1));
    await applyRemote(db, "log_entry", {
      ...remote("a", "00000000009-0000-x", "alive", 2),
      deletedAt: new Date().toISOString(),
    });

    expect(await listLocal(db, "log_entry")).toHaveLength(0);
  });
});
