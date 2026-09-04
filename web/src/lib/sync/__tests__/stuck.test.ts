// @vitest-environment jsdom
import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { flush, type Poster } from "@/lib/sync/engine";
import { HlcClock } from "@/lib/sync/hlc";
import type { SyncResponse } from "@/lib/sync/protocol";
import { summariseOutbox } from "@/lib/sync/outbox-view";
import {
  allOps,
  enqueue,
  getLastSyncAt,
  openSyncDb,
  pendingBatch,
  requeue,
  type SyncDb,
} from "@/lib/sync/store";

/**
 * §1.7's acceptance criterion, as a test: *a deliberately malformed entry survives ten
 * launches, stays visible, and syncs after being corrected.*
 *
 * Written as one narrative rather than as unit tests, because the thing being checked is a
 * sequence — reject, survive, survive again, fix, arrive — and the failure it guards against
 * is an op quietly disappearing at some step in the middle. Every launch here opens the same
 * IndexedDB name from scratch, which is what "launch" actually means to a PWA.
 *
 * The rule underneath: **nothing is discarded.** Not by the engine on a rejection, not by a
 * retry loop giving up, not by a cleanup that decides an op is too old to matter.
 */

let name = "";
let db: SyncDb;
let clock: HlcClock;

beforeEach(async () => {
  // A fresh database per test. These tests relaunch by name, so a shared one would carry the
  // previous test's stuck op into the next — and every assertion here is about a count.
  name = `stuck-${Math.random().toString(36).slice(2)}`;
  db = await openSyncDb(name);
  clock = new HlcClock("device-a");
});

afterEach(() => db?.close());

/** A launch: close the handle and open it again, as a cold start does. */
async function relaunch(): Promise<void> {
  db.close();
  db = await openSyncDb(name);
}

const answer = (over: Partial<SyncResponse>): Poster => {
  const full: SyncResponse = { results: [], changes: [], cursor: 0, hasMore: false, ...over };
  return async () => ({ ok: true, status: 200, json: async () => full });
};

/** The server rejecting one op by id, the way a validation failure arrives. */
function rejects(opId: string, reason: string): Poster {
  return answer({ results: [{ opId, status: "rejected", reason }] });
}

const accepts = (opId: string): Poster => answer({ results: [{ opId, status: "applied" }] });

/** A dropped connection — never an answer, so never a rejection. */
const unreachable: Poster = async () => {
  throw new Error("connection lost");
};

describe("an entry the server will not take", () => {
  it("survives ten launches, stays visible, and syncs once corrected", async () => {
    const { opId } = await enqueue(db, {
      entity: "log_entry",
      op: "create",
      row: { clientId: crypto.randomUUID(), category: "athletics", note: "the stuck one" },
      hlc: clock.tick(),
    });

    // 1. The server refuses it. Permanent, so it is marked failed rather than retried.
    await flush(db, rejects(opId, "invalid_type at data.sets"));
    expect((await allOps(db)).map((op) => op.state)).toEqual(["failed"]);

    // 2. Ten cold starts, each with a flush, exactly as opening the app does. A failed op is
    //    never picked up by `pendingBatch`, so the loop must not quietly retry it either.
    for (let launch = 0; launch < 10; launch += 1) {
      await relaunch();
      await flush(db, rejects(opId, "invalid_type at data.sets"));

      const ops = await allOps(db);
      expect(ops, `gone after launch ${launch + 1}`).toHaveLength(1);
      expect(ops[0].state).toBe("failed");
      expect(ops[0].payload.note).toBe("the stuck one");
    }

    // 3. Still visible, and still loud — the badge must not have quietened down over ten days
    //    of being ignored.
    const summary = summariseOutbox(await allOps(db));
    expect(summary.urgency).toBe("failed");
    expect(summary.label).toBe("1 not sent");

    // 4. Corrected. `requeue` is what the screen's button does.
    await requeue(db, opId);
    expect(await pendingBatch(db, 10)).toHaveLength(1);

    await flush(db, accepts(opId));
    expect(await allOps(db)).toHaveLength(0);
  });

  it("is never retried automatically, because retrying bad data is a loop", async () => {
    const { opId } = await enqueue(db, {
      entity: "log_entry",
      op: "create",
      row: { clientId: crypto.randomUUID(), category: "day", note: "" },
      hlc: clock.tick(),
    });

    await flush(db, rejects(opId, "nope"));
    const attemptsAfterRejection = (await allOps(db))[0].attempts;

    // A poster that would count every attempt. It is never called, because a failed op is not
    // in the pending batch — this asserts that, rather than trusting it.
    let calls = 0;
    const counting: Poster = async (body) => {
      calls += 1;
      expect(body.ops).toHaveLength(0);
      return { ok: true, status: 200, json: async () => ({ results: [], changes: [] }) };
    };

    for (let i = 0; i < 5; i += 1) await flush(db, counting);

    expect(calls).toBe(5);
    expect((await allOps(db))[0].attempts).toBe(attemptsAfterRejection);
  });

  it("keeps the reason, so the screen can still explain it after a relaunch", async () => {
    // The error lives on the op in IndexedDB rather than in component state. Without that, the
    // screen after a cold start says "not sent" and cannot say why.
    const { opId } = await enqueue(db, {
      entity: "log_entry",
      op: "create",
      row: { clientId: crypto.randomUUID(), category: "day", note: "" },
      hlc: clock.tick(),
    });

    await flush(db, rejects(opId, "invalid_type at data.sets"));
    await relaunch();

    const [op] = await allOps(db);
    expect(op.lastError?.status).toBe(422);
    expect(op.lastError?.message).toBe("invalid_type at data.sets");
  });
});

describe("an entry that simply has no signal", () => {
  it("waits rather than failing, however many launches it takes", async () => {
    await enqueue(db, {
      entity: "log_entry",
      op: "create",
      row: { clientId: crypto.randomUUID(), category: "day", note: "on a plane" },
      hlc: clock.tick(),
    });

    for (let launch = 0; launch < 10; launch += 1) {
      await relaunch();
      await flush(db, unreachable);
    }

    const ops = await allOps(db);
    expect(ops).toHaveLength(1);
    // Pending, not failed: nothing about it is wrong, and marking it failed would ask him to
    // fix something that only needs a connection.
    expect(ops[0].state).toBe("pending");
    expect(ops[0].attempts).toBe(10);
    expect(summariseOutbox(ops).urgency).not.toBe("failed");
  });

  it("goes as soon as there is a connection, with no intervention", async () => {
    const { opId } = await enqueue(db, {
      entity: "log_entry",
      op: "create",
      row: { clientId: crypto.randomUUID(), category: "day", note: "" },
      hlc: clock.tick(),
    });

    await flush(db, unreachable);
    await flush(db, accepts(opId));

    expect(await allOps(db)).toHaveLength(0);
  });
});

describe("how fresh the screen is", () => {
  it("records a sync time only when the server actually answered", async () => {
    expect(await getLastSyncAt(db)).toBeNull();

    await flush(db, unreachable);
    expect(await getLastSyncAt(db), "a failed attempt is not freshness").toBeNull();

    await flush(db, answer({}));
    expect(await getLastSyncAt(db)).toBeGreaterThan(0);
  });

  it("survives a relaunch, because it is the 'as of' on every cached screen", async () => {
    await flush(db, answer({}));
    const recorded = await getLastSyncAt(db);

    await relaunch();
    expect(await getLastSyncAt(db)).toBe(recorded);
  });
});
