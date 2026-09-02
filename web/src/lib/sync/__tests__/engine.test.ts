// @vitest-environment jsdom
import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { backoffMs, flush, oldestPendingAgeMs, type Poster } from "@/lib/sync/engine";
import { HlcClock } from "@/lib/sync/hlc";
import type { SyncResponse } from "@/lib/sync/protocol";
import {
  enqueue,
  failedOps,
  getCursor,
  getLocal,
  listLocal,
  openSyncDb,
  pendingBatch,
  pendingCount,
  type SyncDb,
} from "@/lib/sync/store";

/**
 * The flush, with `post` injected. Every branch of the failure taxonomy in `SYNC_DESIGN.md` §6
 * is a test here, because the alternative is staging a 401, a 503 and a dropped socket against
 * a real server — which nobody does, which is why these paths are usually the broken ones.
 */

let db: SyncDb;
let names = 0;
let clock: HlcClock;

beforeEach(async () => {
  db = await openSyncDb(`engine-${++names}-${Math.random().toString(36).slice(2)}`);
  clock = new HlcClock("device-a");
});

afterEach(() => db?.close());

const entry = (clientId: string, note = "") => ({ clientId, category: "day", note });

/** A `post` that answers with whatever the test hands it. */
function poster(answer: Partial<SyncResponse> | number, capture?: { body?: unknown }): Poster {
  return async (body) => {
    if (capture) capture.body = body;
    if (typeof answer === "number") {
      return { ok: answer < 400, status: answer, json: async () => ({}) };
    }
    const full: SyncResponse = {
      results: [],
      changes: [],
      cursor: 0,
      hasMore: false,
      ...answer,
    };
    return { ok: true, status: 200, json: async () => full };
  };
}

async function queueOne(note = "one") {
  return enqueue(db, {
    entity: "log_entry",
    op: "create",
    row: entry("a", note),
    hlc: clock.tick(),
  });
}

describe("a successful flush", () => {
  it("sends the outbox and the cursor, and clears what the server accepted", async () => {
    const op = await queueOne();
    const capture: { body?: unknown } = {};

    const outcome = await flush(
      db,
      poster({ results: [{ opId: op.opId, status: "applied" }], cursor: 12 }, capture),
    );

    expect(outcome).toMatchObject({ status: "synced", pushed: 1 });
    expect(capture.body).toMatchObject({ since: 0 });
    expect(await pendingCount(db)).toBe(0);
    expect(await getCursor(db)).toBe(12);
  });

  it("treats duplicate, stale and superseded exactly like applied", async () => {
    // All four mean "this op has nothing left to do". Keeping them apart is for the retry
    // screen and for debugging a sync that looks stuck, not for control flow.
    for (const status of ["duplicate", "stale", "superseded"] as const) {
      const op = await enqueue(db, {
        entity: "log_entry",
        op: "create",
        row: entry(`row-${status}`),
        hlc: clock.tick(),
      });
      await flush(db, poster({ results: [{ opId: op.opId, status }] }));
    }
    expect(await pendingCount(db)).toBe(0);
  });

  it("merges what the server sends and reports how much changed", async () => {
    const outcome = await flush(
      db,
      poster({
        changes: [
          {
            entity: "task",
            row: { clientId: "t1", title: "from the laptop" },
            updatedHlc: "00000000005-0000-laptop",
            deletedAt: null,
            serverSeq: 4,
          },
        ],
        cursor: 4,
      }),
    );

    expect(outcome).toMatchObject({ status: "synced", merged: 1 });
    const [task] = await listLocal(db, "task");
    expect(task.row).toMatchObject({ title: "from the laptop" });
  });

  it("ignores a table this build does not know about", async () => {
    // Forward compatibility in the direction that actually happens: the server is deployed
    // first and starts sending a new entity before the phone has updated its code.
    const outcome = await flush(
      db,
      poster({
        changes: [
          {
            entity: "something_new" as never,
            row: { clientId: "x" },
            updatedHlc: "1",
            deletedAt: null,
            serverSeq: 3,
          },
        ],
        cursor: 3,
      }),
    );

    expect(outcome).toMatchObject({ status: "synced", merged: 0 });
  });

  it("never moves the cursor backwards", async () => {
    await flush(db, poster({ cursor: 50 }));
    await flush(db, poster({ cursor: 10 }));
    expect(await getCursor(db)).toBe(50);
  });

  it("passes hasMore through, so the caller knows to go again", async () => {
    const outcome = await flush(db, poster({ cursor: 3, hasMore: true }));
    expect(outcome).toMatchObject({ status: "synced", hasMore: true });
  });

  it("flushes with an empty outbox, because that is how a pull happens", async () => {
    const outcome = await flush(db, poster({ cursor: 7 }));
    expect(outcome).toMatchObject({ status: "synced", pushed: 0 });
    expect(await getCursor(db)).toBe(7);
  });
});

describe("the failure taxonomy", () => {
  it("does nothing at all when offline", async () => {
    await queueOne();
    const post = vi.fn();
    const outcome = await flush(db, post as unknown as Poster, { online: false });

    expect(outcome).toEqual({ status: "idle", reason: "offline" });
    expect(post).not.toHaveBeenCalled();
    expect(await pendingCount(db)).toBe(1);
  });

  it("holds the batch when the request never gets an answer", async () => {
    const op = await queueOne();
    const outcome = await flush(db, async () => {
      throw new Error("network down");
    });

    expect(outcome.status).toBe("transient");
    const [still] = await pendingBatch(db);
    expect(still.opId).toBe(op.opId);
    expect(still.attempts).toBe(1);
    // The server may well have applied it. That is exactly why every op carries an
    // idempotency key — a retry comes back as `duplicate` rather than logging it twice.
    expect(still.state).toBe("pending");
  });

  it("holds the batch on a 5xx", async () => {
    await queueOne();
    const outcome = await flush(db, poster(503));

    expect(outcome.status).toBe("transient");
    expect((await pendingBatch(db))[0].attempts).toBe(1);
  });

  it("holds the batch on a 429 rather than failing it", async () => {
    await queueOne();
    expect((await flush(db, poster(429))).status).toBe("transient");
    expect(await pendingCount(db)).toBe(1);
  });

  it("pauses on a 401 without counting it against any op", async () => {
    // Retrying 100 ops against a dead session just burns them, and the attempts counter would
    // drive them into a five-minute backoff for something a sign-in fixes instantly.
    const op = await queueOne();
    const outcome = await flush(db, poster(401));

    expect(outcome).toEqual({ status: "auth" });
    const [still] = await pendingBatch(db);
    expect(still.opId).toBe(op.opId);
    expect(still.attempts).toBe(0);
  });

  it("fails the batch permanently on a 4xx that is not 401", async () => {
    // A malformed request is a client bug or schema skew, not bad luck. Looping on it forever
    // is the alternative.
    await queueOne();
    const outcome = await flush(db, poster(400));

    expect(outcome.status).toBe("permanent");
    expect(await pendingBatch(db)).toHaveLength(0);
    expect(await failedOps(db)).toHaveLength(1);
  });

  it("fails one rejected op and keeps the rest of the batch moving", async () => {
    const bad = await enqueue(db, {
      entity: "log_entry",
      op: "create",
      row: entry("bad"),
      hlc: clock.tick(),
    });
    const good = await enqueue(db, {
      entity: "log_entry",
      op: "create",
      row: entry("good"),
      hlc: clock.tick(),
    });

    await flush(
      db,
      poster({
        results: [
          { opId: bad.opId, status: "rejected", reason: "category: too small" },
          { opId: good.opId, status: "applied" },
        ],
      }),
    );

    const failed = await failedOps(db);
    expect(failed).toHaveLength(1);
    expect(failed[0].lastError?.message).toBe("category: too small");
    expect(await pendingCount(db)).toBe(0);
  });

  it("leaves a rejected op's local row visible rather than silently dropping the change", async () => {
    // Nothing is ever discarded. The entry stays on screen and stays in the outbox until it is
    // fixed, which is the whole point of holding rather than dropping.
    const op = await queueOne("kept");
    await flush(db, poster({ results: [{ opId: op.opId, status: "rejected" }] }));

    const record = await getLocal(db, "log_entry", "a");
    expect(record?.row).toMatchObject({ note: "kept" });
    expect(record?.dirty).toBe(1);
  });
});

describe("backoff", () => {
  it("doubles and then caps at five minutes", () => {
    expect(backoffMs(1)).toBe(1_000);
    expect(backoffMs(2)).toBe(2_000);
    expect(backoffMs(3)).toBe(4_000);
    expect(backoffMs(20)).toBe(300_000);
  });

  it("does not go below the first step for a zeroth attempt", () => {
    expect(backoffMs(0)).toBe(1_000);
  });
});

describe("staleness", () => {
  it("reports nothing pending as null, not zero", async () => {
    expect(await oldestPendingAgeMs(db)).toBeNull();
  });

  it("measures from the oldest pending op, which is what the 24h warning watches", async () => {
    const op = await queueOne();
    const age = await oldestPendingAgeMs(db, op.createdAt + 25 * 60 * 60 * 1000);
    expect(age).toBeGreaterThan(24 * 60 * 60 * 1000);
  });
});
