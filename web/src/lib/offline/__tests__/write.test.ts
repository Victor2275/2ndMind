// @vitest-environment jsdom
import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { localCaptureWriter, localLogWriter } from "@/lib/offline/write";
import { flush, type Poster } from "@/lib/sync/engine";
import type { SyncResponse } from "@/lib/sync/protocol";
import { allOps, openSyncDb, DB_NAME, type SyncDb } from "@/lib/sync/store";

/**
 * Writing a log entry with no signal (V3 §2.2).
 *
 * The claim being tested is end-to-end and is the whole of Milestone A: an entry written with
 * the radio off is **held, shaped exactly as the server expects, and sent by the ordinary
 * flush** when there is a network. Nothing new is trusted — §1.2's store and §1.3's flush do
 * the work — so what these tests actually guard is the join: that the offline writer builds the
 * same row the Server Action would, and hands it to the outbox rather than to the network.
 *
 * The failure this is here to catch does not throw. A field parsed differently offline, or a
 * missing `searchText` on a `notNull` column, produces an entry that looks saved on the phone
 * and is rejected days later when it finally reaches the server.
 */

let db: SyncDb;

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(values)) data.append(name, value);
  return data;
}

const training = (over: Record<string, string> = {}) =>
  form({
    category: "athletics",
    kind: "lift",
    exercise: "Bench Press",
    "sets.0.weightLbs": "185",
    "sets.0.reps": "5",
    note: "",
    ...over,
  });

beforeEach(async () => {
  db = await openSyncDb(DB_NAME);
  const tx = db.transaction(["outbox", "log_entries", "bodyweight_entries", "tasks"], "readwrite");
  await Promise.all([
    tx.objectStore("outbox").clear(),
    tx.objectStore("log_entries").clear(),
    tx.objectStore("bodyweight_entries").clear(),
    tx.objectStore("tasks").clear(),
  ]);
  await tx.done;
});

afterEach(() => db?.close());

describe("an entry written with no signal", () => {
  it("goes into the outbox, shaped the way the server expects", async () => {
    const result = await localLogWriter()(null, training());
    expect(result.ok).toBe(true);

    const [op] = await allOps(db);
    expect(op.entity).toBe("log_entry");
    expect(op.op).toBe("create");
    expect(op.state).toBe("pending");

    expect(op.payload.category).toBe("athletics");
    expect(op.payload.data).toEqual({
      kind: "lift",
      exercise: "Bench Press",
      sets: [{ weightLbs: 185, reps: 5 }],
    });
    // `search_text` is notNull on the column. Omitting it here would look fine on the phone
    // and be rejected days later, when the entry finally reached the server.
    expect(op.payload.searchText).toContain("Bench Press");
    expect(typeof op.payload.clientId).toBe("string");
  });

  it("parses fields the same way the Server Action does", async () => {
    // Two parsers for one form is how a field means one thing offline and another online, and
    // nothing would ever say so. Both call `readField`/`readRows`; this pins the outcome.
    await localLogWriter()(
      null,
      form({
        category: "athletics",
        kind: "erg",
        exercise: "2k",
        "sets.0.distance": "2",
        "sets.0.distanceUnit": "km",
        "sets.0.duration": "7:12",
        "sets.0.spm": "28",
      }),
    );

    const [op] = await allOps(db);
    expect(op.payload.data).toMatchObject({
      sets: [{ distance: 2000, duration: 432, spm: 28 }],
    });
  });

  it("sends the weigh-in to its own table, not onto the entry", async () => {
    // Same rule as D-159 online: bodyweight is the second input to every adjusted split, so
    // there is one copy of it and the log entry is not where it lives.
    await localLogWriter()(null, training({ bodyweightLbs: "178.3" }));

    const ops = await allOps(db);
    const entry = ops.find((op) => op.entity === "log_entry");
    const weight = ops.find((op) => op.entity === "bodyweight");

    expect(entry?.payload.data).not.toHaveProperty("bodyweightLbs");
    expect(weight?.payload).toMatchObject({ weightLbs: 178.3 });
  });

  it("gives each op a distinct, increasing stamp", async () => {
    // Both ops come from one submit. Sharing a stamp would leave last-write-wins with a tie to
    // break on a device id it cannot tell apart from itself.
    await localLogWriter()(null, training({ bodyweightLbs: "178" }));

    const stamps = (await allOps(db)).map((op) => op.hlc);
    expect(new Set(stamps).size).toBe(2);
    expect([...stamps].sort()).toEqual(stamps.slice().sort());
  });

  it("refuses an empty submit rather than queueing nothing", async () => {
    const result = await localLogWriter()(null, form({ category: "athletics" }));

    expect(result.ok).toBe(false);
    expect(await allOps(db)).toHaveLength(0);
  });

  it("refuses a retired category, the same door the Server Action closes", async () => {
    const result = await localLogWriter()(null, form({ category: "work", note: "Anthropic" }));

    expect(result.ok).toBe(false);
    expect(await allOps(db)).toHaveLength(0);
  });

  it("says it is held, not that it is saved — those are different promises", async () => {
    const result = await localLogWriter()(null, training());
    expect(result.message).toMatch(/reconnect/i);
  });

  it("asks for a flush, so it leaves the moment there is a network", async () => {
    const onWritten = vi.fn();
    await localLogWriter(onWritten)(null, training());
    expect(onWritten).toHaveBeenCalled();
  });

  it("backdates to the day given, at noon local rather than midnight", async () => {
    // Midnight rendered in a zone behind UTC shows as the previous day, which would misdate
    // every backdated entry. Same reasoning as the action, and worth pinning in both places.
    await localLogWriter()(null, training({ occurredOn: "2026-07-04" }));

    const [op] = await allOps(db);
    expect(String(op.payload.occurredAt)).toBe("2026-07-04T19:00:00.000Z");
  });
});

describe("a quick note with no signal (D-164)", () => {
  const capture = (text: string, as?: string) =>
    localCaptureWriter()(null, form(as ? { text, as } : { text }));

  it("goes into the outbox as an unsorted entry", async () => {
    const result = await capture("that stroke cue worked");
    expect(result.ok).toBe(true);

    const [op] = await allOps(db);
    expect(op.entity).toBe("log_entry");
    expect(op.payload.category).toBe("note");
    expect(op.payload.note).toBe("that stroke cue worked");
    // Searchable before it has ever synced, and the column is notNull either way.
    expect(op.payload.searchText).toContain("that stroke cue worked");
  });

  it("goes into the task inbox when asked", async () => {
    await capture("email the coach", "task");

    const [op] = await allOps(db);
    expect(op.entity).toBe("task");
    expect(op.payload).toMatchObject({ title: "email the coach", source: "inbox", dueAt: null });
  });

  it("defaults to a note, which is the cheaper mistake", async () => {
    // A note can be filed later. A task nobody meant sits in a list demanding to be ticked.
    await capture("something");
    expect((await allOps(db))[0].entity).toBe("log_entry");
  });

  it("refuses an empty capture rather than queueing a blank", async () => {
    const result = await capture("   ");

    expect(result.ok).toBe(false);
    expect(await allOps(db)).toHaveLength(0);
  });

  it("says it is held, not that it is filed", async () => {
    expect((await capture("a thought")).message).toMatch(/send/i);
  });
});

describe("and then reconnecting", () => {
  it("is sent by the ordinary flush, with nothing offline-specific involved", async () => {
    // The point of writing into the outbox rather than inventing a second send path: this is
    // the same `flush` that `roundtrip.test.ts` runs against real Postgres.
    await localLogWriter()(null, training());
    const [op] = await allOps(db);

    let sent: unknown = null;
    const server: Poster = async (body) => {
      sent = body.ops;
      const answer: SyncResponse = {
        results: [{ opId: op.opId, status: "applied" }],
        changes: [],
        cursor: 1,
        hasMore: false,
      };
      return { ok: true, status: 200, json: async () => answer };
    };

    const outcome = await flush(db, server);

    expect(outcome.status).toBe("synced");
    expect(sent).toHaveLength(1);
    expect(await allOps(db)).toHaveLength(0);
  });

  it("survives a failed attempt and is still there to send later", async () => {
    await localLogWriter()(null, training());

    const unreachable: Poster = async () => {
      throw new Error("connection lost");
    };
    await flush(db, unreachable);

    const [op] = await allOps(db);
    expect(op.state).toBe("pending");
    expect(op.payload.data).toMatchObject({ exercise: "Bench Press" });
  });
});
