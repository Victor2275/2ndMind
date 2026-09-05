// @vitest-environment node
import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { logEntries } from "@/lib/db/schema";
import { applyOps, pullChanges, type Db } from "@/lib/sync/apply";
import { flush, type Poster } from "@/lib/sync/engine";
import { HlcClock } from "@/lib/sync/hlc";
import { syncRequestSchema, type WireOp } from "@/lib/sync/protocol";
import {
  enqueue,
  failedOps,
  getCursor,
  getLocal,
  loadClock,
  openSyncDb,
  pendingBatch,
  pendingCount,
  type OutboxOp,
  type SyncDb,
} from "@/lib/sync/store";
import { resetTestDb } from "@/test/pg";

/**
 * V3 §1.4 — the six required cases, each as a named test, at the database layer's bar.
 *
 * The other sync test files each hold one half still: `apply.test.ts` drives the server with
 * hand-built ops, `engine.test.ts` drives the client against a scripted `Poster`. Neither can
 * fail the way sync actually fails, because in both of them one side is a fixture that always
 * behaves. So this file wires the two real halves together — IndexedDB outbox on one end, real
 * Postgres on the other, with nothing scripted in between except *when the connection drops*.
 *
 * Four of the six passed on the first run, which is the point of writing an audit as tests
 * rather than as a checklist. The clock-skew case did not: see `absorbStamps` in `engine.ts`.
 */

let db: SyncDb;
let pg: Db;
let names = 0;

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

beforeEach(async () => {
  db = await openSyncDb(`roundtrip-${++names}-${Math.random().toString(36).slice(2)}`);
  pg = (await resetTestDb()) as unknown as Db;
});

afterEach(() => db?.close());

const entry = (clientId: string, note: string) => ({
  clientId,
  category: "day",
  occurredAt: "2026-09-01T10:00:00.000Z",
  note,
  data: {},
  searchText: note,
});

/**
 * The server, reachable as a `Poster`. Request validation included, because that is where
 * schema skew lands and skipping it would test a server the route does not expose.
 *
 * `dropReply` is the only dishonest thing in here, and it is dishonest in the one way a real
 * network is: the write commits, then the answer never arrives.
 */
function server(options: { dropReply?: boolean } = {}): Poster {
  return async (body) => {
    const parsed = syncRequestSchema.safeParse(body);
    if (!parsed.success) {
      return { ok: false, status: 400, json: async () => ({ error: "bad request" }) };
    }

    const results = await applyOps(pg, parsed.data.ops);
    const pulled = await pullChanges(pg, parsed.data.since);

    if (options.dropReply) throw new Error("connection lost");
    return { ok: true, status: 200, json: async () => ({ results, ...pulled }) };
  };
}

/** Queue a local write the way the app will, stamping it off the persisted clock. */
async function write(clientId: string, note: string, clock: HlcClock) {
  return enqueue(db, {
    entity: "log_entry",
    op: "create",
    row: entry(clientId, note),
    hlc: clock.tick(),
  });
}

const rowCount = async () => (await pg.select().from(logEntries)).length;

describe("1 · reconnect mid-flush", () => {
  it("re-sends the batch after a dropped reply, and does not double what landed", async () => {
    const clock = new HlcClock("device-a");
    await write(uuid(1), "one", clock);
    await write(uuid(2), "two", clock);
    await write(uuid(3), "three", clock);

    // The server commits all three, then the connection dies before the answer gets back.
    const lost = await flush(db, server({ dropReply: true }));

    expect(lost.status).toBe("transient");
    expect(await rowCount()).toBe(3); // the server did the work
    expect(await pendingCount(db)).toBe(3); // the client has no way to know that

    // Reconnect. The client re-sends what it still believes is unsent.
    const retry = await flush(db, server());

    expect(retry).toMatchObject({ status: "synced", pushed: 3 });
    expect(await rowCount()).toBe(3);
    expect(await pendingCount(db)).toBe(0);
    expect(await failedOps(db)).toHaveLength(0);
  });
});

describe("2 · partial failure", () => {
  it("lands the good entries, keeps the bad one visible, and does not retry it", async () => {
    const clock = new HlcClock("device-a");
    await write(uuid(11), "good", clock);

    // An empty category fails the server's schema. Nothing on the client rejects it, which is
    // deliberate — validating twice means two schemas to keep in step, and the client's copy
    // is the one that goes stale.
    await enqueue(db, {
      entity: "log_entry",
      op: "create",
      row: { ...entry(uuid(12), "bad"), category: "" },
      hlc: clock.tick(),
    });
    await write(uuid(13), "also good", clock);

    const outcome = await flush(db, server());

    expect(outcome.status).toBe("synced");
    expect(await rowCount()).toBe(2);

    const failed = await failedOps(db);
    expect(failed).toHaveLength(1);
    expect(failed[0].clientId).toBe(uuid(12));
    expect(await pendingCount(db)).toBe(0);

    // The rejected entry is still on the device. Dropping it would lose what the user wrote,
    // and retrying it would loop forever — so it sits there, failed and visible, until the
    // retry screen (§1.7) lets him fix or discard it.
    const local = await getLocal(db, "log_entry", uuid(12));
    expect(local?.row).toMatchObject({ note: "bad" });

    // And a second flush does not pick it back up on its own.
    await flush(db, server());
    expect(await rowCount()).toBe(2);
    expect(await failedOps(db)).toHaveLength(1);
  });
});

describe("3 · duplicate flush", () => {
  it("two flushes racing on the same outbox produce one row each, not two", async () => {
    const clock = new HlcClock("device-a");
    await write(uuid(21), "one", clock);
    await write(uuid(22), "two", clock);

    // `SyncRunner` holds a mutex, so this is not supposed to happen. It is tested anyway
    // because the mutex is one `useRef` in a component that React may mount twice, and a
    // correctness property that depends on a UI detail is not a correctness property.
    const [a, b] = await Promise.all([flush(db, server()), flush(db, server())]);

    expect([a.status, b.status]).toEqual(["synced", "synced"]);
    expect(await rowCount()).toBe(2);
    expect(await pendingCount(db)).toBe(0);
    expect(await failedOps(db)).toHaveLength(0);
  });

  it("reports the second delivery of one batch as duplicate rather than applying it", async () => {
    const clock = new HlcClock("device-a");
    await write(uuid(23), "once", clock);
    const batch = await pendingBatch(db);

    const post = server();
    const first = await post({ ops: batch, since: 0 });
    const second = await post({ ops: batch, since: 0 });

    expect((await first.json()) as { results: { status: string }[] }).toMatchObject({
      results: [{ status: "applied" }],
    });
    expect((await second.json()) as { results: { status: string }[] }).toMatchObject({
      results: [{ status: "duplicate" }],
    });
    expect(await rowCount()).toBe(1);
  });
});

describe("4 · clock skew", () => {
  /** A row already on the server, written by another device whose clock is `aheadMs` fast. */
  async function writtenByASkewedDevice(clientId: string, aheadMs: number) {
    const skewed = new HlcClock("device-b", () => Date.now() + aheadMs);
    const op: WireOp = {
      opId: uuid(900),
      entity: "log_entry",
      op: "create",
      clientId,
      payload: entry(clientId, "from the fast phone"),
      hlc: skewed.tick(),
    };
    expect((await applyOps(pg, [op]))[0].status).toBe("applied");
  }

  it("an edit made on the correct device still wins after pulling a fast device's row", async () => {
    // Five minutes fast is an ordinary phone that has not talked to NTP in a while — well
    // inside the drift bound, and the case this actually protects.
    await writtenByASkewedDevice(uuid(31), 5 * 60 * 1000);

    // The laptop pulls it. Its own clock is correct.
    expect((await flush(db, server())).status).toBe("synced");

    // Then it edits that row. Without `absorbStamps`, this stamp is five minutes *behind* the
    // one already stored, the server calls it `stale`, and the edit is discarded — then the
    // next pull overwrites it on screen too. Silently, with no error anywhere.
    const clock = new HlcClock("device-a", Date.now, await loadClock(db));
    await enqueue(db, {
      entity: "log_entry",
      op: "update",
      row: entry(uuid(31), "corrected on the laptop"),
      hlc: clock.tick(),
    });

    expect((await flush(db, server())).status).toBe("synced");

    const [row] = await pg.select().from(logEntries);
    expect(row.note).toBe("corrected on the laptop");
    expect(await pendingCount(db)).toBe(0);
  });

  it("does not absorb a peer beyond the drift bound, so one bad clock cannot poison this one", async () => {
    // Three days ahead is not drift, it is a broken clock. Absorbing it would push this
    // device's stamps three days into the future permanently, and every later comparison
    // with every other device would be wrong.
    await writtenByASkewedDevice(uuid(32), 3 * 24 * 60 * 60 * 1000);

    const before = await loadClock(db);
    const outcome = await flush(db, server());

    // The row still merges — last-write-wins compares strings and does not consult our clock.
    expect(outcome).toMatchObject({ status: "synced", merged: 1 });
    expect((await getLocal(db, "log_entry", uuid(32)))?.row).toMatchObject({
      note: "from the fast phone",
    });

    const after = await loadClock(db);
    expect(after.wallMs).toBeLessThan(before.wallMs + 3 * 24 * 60 * 60 * 1000);
    expect(after.wallMs).toBeLessThanOrEqual(Date.now());

    // The known cost of that choice, stated rather than hidden: an edit made here to that row
    // *will* come back `stale` until the other device's clock is fixed. Refusing to poison
    // this clock is the right trade, but it is a trade, and §1.7 should surface it.
  });
});

describe("5 · schema version skew", () => {
  it("ignores a change for a table this build has never heard of, and still moves past it", async () => {
    const unknown: Poster = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        results: [],
        changes: [
          {
            entity: "sleep_session",
            row: { clientId: "x" },
            updatedHlc: new HlcClock("device-b").tick(),
            deletedAt: null,
            serverSeq: 12,
          },
        ],
        cursor: 12,
        hasMore: false,
      }),
    });

    const outcome = await flush(db, unknown);

    expect(outcome).toMatchObject({ status: "synced", merged: 0 });
    // The cursor is the half that matters. Refusing to advance past a row this build cannot
    // store would re-pull it on every sync for as long as the phone stayed on the old build.
    expect(await getCursor(db)).toBe(12);
  });

  it("keeps an entry whose payload carries a field the server does not know about", async () => {
    // Skew in the other direction: the phone updated first and sends a field the deployed
    // server has never seen. The entry has to land minus the field — rejecting the whole
    // entry would mean an app update could not be rolled out to one device at a time.
    const clock = new HlcClock("device-a");
    await enqueue(db, {
      entity: "log_entry",
      op: "create",
      row: { ...entry(uuid(41), "written on the newer build"), mood: "good", tags: ["a"] },
      hlc: clock.tick(),
    });

    expect((await flush(db, server())).status).toBe("synced");

    const [row] = await pg.select().from(logEntries);
    expect(row.note).toBe("written on the newer build");
    expect(row).not.toHaveProperty("mood");
    expect(await failedOps(db)).toHaveLength(0);
  });

  it("refuses a whole request naming an entity that does not exist, rather than half-applying it", async () => {
    const clock = new HlcClock("device-a");
    const good = await write(uuid(42), "fine", clock);

    const response = await server()({
      ops: [
        good,
        {
          opId: uuid(43),
          entity: "sleep_session",
          op: "create",
          clientId: uuid(44),
          payload: {},
          hlc: clock.tick(),
          state: "pending",
          attempts: 0,
          lastError: null,
          createdAt: Date.now(),
        } as unknown as OutboxOp,
      ],
      since: 0,
    });

    // 400, not a partial apply: the request itself is unreadable, so the server cannot know
    // what else it got wrong. `engine.ts` turns this into a permanent failure the user sees,
    // which is the only honest answer to "this build is talking to the wrong server".
    expect(response.status).toBe(400);
    expect(await rowCount()).toBe(0);
  });
});

describe("6 · a create retried three times", () => {
  it("produces one row, and the outbox ends up empty", async () => {
    const clock = new HlcClock("device-a");
    await write(uuid(51), "the only one", clock);

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const outcome = await flush(db, server({ dropReply: true }));
      expect(outcome.status).toBe("transient");
      expect(await rowCount()).toBe(1); // committed on the first attempt, never again
      expect((await pendingBatch(db))[0].attempts).toBe(attempt);
    }

    // The fourth attempt gets its answer, and the answer is "you already sent me this".
    const settled = await flush(db, server());

    expect(settled).toMatchObject({ status: "synced", pushed: 1 });
    expect(await rowCount()).toBe(1);
    expect(await pendingCount(db)).toBe(0);
    expect(await failedOps(db)).toHaveLength(0);

    const [row] = await pg.select().from(logEntries);
    expect(row.note).toBe("the only one");
  });
});
