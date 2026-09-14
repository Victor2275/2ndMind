// @vitest-environment node
import { eq, isNull } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { bodyweightEntries, exercises, logEntries, rehabCompletions, tasks } from "@/lib/db/schema";
import { applyOps, pullChanges, type Db } from "@/lib/sync/apply";
import { ENTITIES } from "@/lib/sync/entities";
import { HlcClock } from "@/lib/sync/hlc";
import type { WireOp } from "@/lib/sync/protocol";
import { resetTestDb } from "@/test/pg";

/**
 * The server half of sync, against real Postgres (PGlite) — the standard the rest of the
 * database code is held to. A mocked query builder would accept every one of the ordering and
 * idempotency mistakes these tests exist to catch.
 */

let db: Db;
let clock: HlcClock;
let ids = 0;

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

function op(partial: Partial<WireOp> & Pick<WireOp, "entity" | "clientId" | "payload">): WireOp {
  return {
    opId: uuid(++ids),
    op: "create",
    hlc: clock.tick(),
    ...partial,
  } as WireOp;
}

const entry = (clientId: string, note = "") => ({
  entity: "log_entry" as const,
  clientId,
  payload: {
    clientId,
    category: "day",
    occurredAt: "2026-08-31T10:00:00.000Z",
    note,
    data: {},
    searchText: note,
  },
});

beforeEach(async () => {
  db = (await resetTestDb()) as unknown as Db;
  clock = new HlcClock("device-a");
  ids = 0;
});

describe("applying a batch", () => {
  it("writes a create", async () => {
    const [result] = await applyOps(db, [op(entry(uuid(900), "hello"))]);
    expect(result.status).toBe("applied");

    const rows = await db.select().from(logEntries);
    expect(rows).toHaveLength(1);
    expect(rows[0].note).toBe("hello");
  });

  it("is the done-when: three entries logged offline arrive exactly once", async () => {
    // §1.3's stated criterion, checked by row count rather than by looking.
    const ops = [
      op(entry(uuid(901), "one")),
      op(entry(uuid(902), "two")),
      op(entry(uuid(903), "three")),
    ];

    const first = await applyOps(db, ops);
    expect(first.map((r) => r.status)).toEqual(["applied", "applied", "applied"]);
    expect(await db.select().from(logEntries)).toHaveLength(3);

    // And the retry that follows a lost response does not double them.
    const second = await applyOps(db, ops);
    expect(second.map((r) => r.status)).toEqual(["duplicate", "duplicate", "duplicate"]);
    expect(await db.select().from(logEntries)).toHaveLength(3);
  });

  it("reports a re-sent op as duplicate rather than applying it twice", async () => {
    const only = op(entry(uuid(904), "once"));
    expect((await applyOps(db, [only]))[0].status).toBe("applied");
    expect((await applyOps(db, [only]))[0].status).toBe("duplicate");
    expect(await db.select().from(logEntries)).toHaveLength(1);
  });

  it("reports an older op as stale and leaves the newer row alone", async () => {
    const older = op(entry(uuid(905), "old"));
    const newer = op({ ...entry(uuid(905), "new"), op: "update" });

    await applyOps(db, [newer]);
    const [result] = await applyOps(db, [older]);

    expect(result.status).toBe("stale");
    const [row] = await db.select().from(logEntries);
    expect(row.note).toBe("new");
  });

  it("collapses two ops for one row and marks the loser superseded", async () => {
    // Postgres refuses an ON CONFLICT DO UPDATE that would touch a row twice in one statement
    // — "cannot affect row a second time" — so the batch has to be collapsed before it is
    // written. The client drops the superseded op, which is correct: the winner contains it.
    const create = op(entry(uuid(906), "first"));
    const edit = op({ ...entry(uuid(906), "second"), op: "update" });

    const results = await applyOps(db, [create, edit]);
    expect(results.map((r) => r.status)).toEqual(["superseded", "applied"]);

    const rows = await db.select().from(logEntries);
    expect(rows).toHaveLength(1);
    expect(rows[0].note).toBe("second");
  });

  it("rejects a bad payload permanently, and does not touch the rest of the batch", async () => {
    const good = op(entry(uuid(907), "fine"));
    const bad = op({
      entity: "log_entry",
      clientId: uuid(908),
      payload: { clientId: uuid(908), category: "", occurredAt: "not a date" },
    });

    const results = await applyOps(db, [bad, good]);
    expect(results[0].status).toBe("rejected");
    expect(results[0].reason).toBeTruthy();
    expect(results[1].status).toBe("applied");
    expect(await db.select().from(logEntries)).toHaveLength(1);
  });

  it("rejects an op whose clientId disagrees with its payload", async () => {
    // Otherwise an op queued against one row could be applied to another.
    const mismatched = op({ ...entry(uuid(909)), clientId: uuid(910) });
    const [result] = await applyOps(db, [mismatched]);
    expect(result.status).toBe("rejected");
    expect(result.reason).toMatch(/identity/);
  });

  it("returns results in request order", async () => {
    const ops = [op(entry(uuid(911))), op(entry(uuid(912))), op(entry(uuid(913)))];
    const results = await applyOps(db, ops);
    expect(results.map((r) => r.opId)).toEqual(ops.map((o) => o.opId));
  });

  it("applies a delete as a tombstone", async () => {
    const clientId = uuid(914);
    await applyOps(db, [op(entry(clientId, "here"))]);
    const [result] = await applyOps(db, [op({ ...entry(clientId, "here"), op: "delete" })]);

    expect(result.status).toBe("applied");
    const [row] = await db.select().from(logEntries);
    expect(row.deletedAt).not.toBeNull();
  });

  /** V4 Phase 3, §3.5 — tags round-trip through an op like every other `log_entry` column. */
  it("writes tags on a log entry", async () => {
    const clientId = uuid(915);
    const [result] = await applyOps(db, [
      op({
        ...entry(clientId, "recipe"),
        payload: { ...entry(clientId).payload, tags: ["recipe", "reading"] },
      }),
    ]);

    expect(result.status).toBe("applied");
    const [row] = await db.select().from(logEntries);
    expect(row.tags).toEqual(["recipe", "reading"]);
  });

  it("defaults to no tags when the payload omits them", async () => {
    await applyOps(db, [op(entry(uuid(916)))]);
    const [row] = await db.select().from(logEntries);
    expect(row.tags).toEqual([]);
  });

  it("caps tags at 20 and each tag at 40 characters, rejecting an oversized payload", async () => {
    const clientId = uuid(917);
    const tooMany = Array.from({ length: 21 }, (_, i) => `t${i}`);
    const [result] = await applyOps(db, [
      op({ ...entry(clientId), payload: { ...entry(clientId).payload, tags: tooMany } }),
    ]);

    expect(result.status).toBe("rejected");
  });

  it("writes tags on a task", async () => {
    const clientId = uuid(918);
    const [result] = await applyOps(db, [
      op({
        entity: "task",
        clientId,
        payload: { clientId, title: "email the coach", tags: ["athletics"] },
      }),
    ]);

    expect(result.status).toBe("applied");
    const [row] = await db.select().from(tasks);
    expect(row.tags).toEqual(["athletics"]);
  });
});

describe("natural-key entities", () => {
  it("upserts bodyweight by the day, not by a client id", async () => {
    await applyOps(db, [
      op({
        entity: "bodyweight",
        clientId: "2026-08-31",
        payload: { measuredOn: "2026-08-31", weightLbs: 215, note: "" },
      }),
    ]);
    await applyOps(db, [
      op({
        entity: "bodyweight",
        clientId: "2026-08-31",
        payload: { measuredOn: "2026-08-31", weightLbs: 214, note: "evening" },
        op: "update",
      }),
    ]);

    const rows = await db.select().from(bodyweightEntries);
    expect(rows).toHaveLength(1);
    expect(rows[0].weightLbs).toBe(214);
  });

  it("addresses rehab by the day and slug together", async () => {
    const payload = { completedOn: "2026-08-31", slug: "banded-external-rotation" };
    await applyOps(db, [
      op({ entity: "rehab", clientId: "2026-08-31|banded-external-rotation", payload }),
    ]);
    // A different slug on the same day is a different row.
    await applyOps(db, [
      op({
        entity: "rehab",
        clientId: "2026-08-31|scap-pushup",
        payload: { completedOn: "2026-08-31", slug: "scap-pushup" },
      }),
    ]);

    expect(await db.select().from(rehabCompletions)).toHaveLength(2);
  });

  it("un-ticks rehab without deleting the row", async () => {
    const payload = { completedOn: "2026-08-31", slug: "banded-external-rotation" };
    const clientId = "2026-08-31|banded-external-rotation";
    await applyOps(db, [op({ entity: "rehab", clientId, payload })]);
    await applyOps(db, [op({ entity: "rehab", clientId, payload, op: "delete" })]);

    const rows = await db.select().from(rehabCompletions);
    expect(rows).toHaveLength(1);
    expect(rows[0].deletedAt).not.toBeNull();
  });
});

describe("pulling changes", () => {
  it("returns nothing when the cursor is current", async () => {
    await applyOps(db, [op(entry(uuid(920)))]);
    const { cursor } = await pullChanges(db, 0);
    const second = await pullChanges(db, cursor);

    expect(second.changes).toEqual([]);
    expect(second.cursor).toBe(cursor);
    expect(second.hasMore).toBe(false);
  });

  it("orders changes from different tables by one cursor", async () => {
    await applyOps(db, [op(entry(uuid(921)))]);
    await db.insert(tasks).values({ title: "from the laptop" });
    await applyOps(db, [op(entry(uuid(922)))]);

    const { changes } = await pullChanges(db, 0);
    const seqs = changes.map((c) => c.serverSeq);
    expect(seqs).toEqual([...seqs].sort((a, b) => a - b));
    expect(changes.map((c) => c.entity)).toContain("task");
  });

  it("carries tombstones, which is how a delete reaches the other device", async () => {
    const clientId = uuid(923);
    await applyOps(db, [op(entry(clientId))]);
    const afterCreate = await pullChanges(db, 0);
    await applyOps(db, [op({ ...entry(clientId), op: "delete" })]);

    const { changes } = await pullChanges(db, afterCreate.cursor);
    expect(changes).toHaveLength(1);
    expect(changes[0].deletedAt).not.toBeNull();
  });

  it("never advances the cursor past a change it did not return", async () => {
    // The cursor is the only record of what has been seen. Advancing past a row that was
    // trimmed by the limit would lose it permanently.
    for (let i = 0; i < 5; i++) await applyOps(db, [op(entry(uuid(930 + i)))]);

    const page = await pullChanges(db, 0, 2);
    expect(page.changes).toHaveLength(2);
    expect(page.hasMore).toBe(true);
    expect(page.cursor).toBe(page.changes[1].serverSeq);

    const next = await pullChanges(db, page.cursor, 2);
    expect(next.changes[0].serverSeq).toBeGreaterThan(page.cursor);
  });

  it("pages through everything without skipping or repeating a row", async () => {
    for (let i = 0; i < 7; i++) await applyOps(db, [op(entry(uuid(940 + i)))]);
    await db.insert(tasks).values({ title: "one" });
    await db.insert(bodyweightEntries).values({ measuredOn: "2026-08-30", weightLbs: 210 });

    const seen: number[] = [];
    let cursor = 0;
    for (let page = 0; page < 20; page++) {
      const { changes, cursor: next, hasMore } = await pullChanges(db, cursor, 3);
      seen.push(...changes.map((c) => c.serverSeq));
      cursor = next;
      if (!hasMore) break;
    }

    expect(seen).toHaveLength(9);
    expect(new Set(seen).size).toBe(9);
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
  });

  it("hands back a row shape the client can merge", async () => {
    await applyOps(db, [op(entry(uuid(950), "shape"))]);
    const { changes } = await pullChanges(db, 0);

    expect(changes[0]).toMatchObject({ entity: "log_entry", deletedAt: null });
    expect(changes[0].row).toMatchObject({ clientId: uuid(950), note: "shape" });
    // The bookkeeping columns are lifted out of `row`, not left inside it, so the client's
    // mirror stores the row and its metadata separately.
    expect(changes[0].row).not.toHaveProperty("serverSeq");
    expect(changes[0].row).not.toHaveProperty("updatedHlc");
    expect(typeof changes[0].serverSeq).toBe("number");
  });
});

describe("the exercise name-collision bug (V4 Phase 2++ Stage 2)", () => {
  /**
   * `exercises` was unique on both `name` and `client_id`, but a create only conflicts on
   * `client_id`. Two devices adding the same name independently — different clientIds, same
   * string — raised a raw Postgres unique violation, which is not `UnknownParentError`, so it
   * was never caught: the route 500'd, the whole batch died, and everything else queued behind
   * it in that batch retried forever. This is the test that would have failed before the fix.
   */
  it("does not 500 when two different devices create the same name", async () => {
    const first = op({
      entity: "exercise",
      clientId: uuid(1001),
      payload: { clientId: uuid(1001), name: "Zercher Squat", source: "manual" },
    });
    const second = op({
      entity: "exercise",
      clientId: uuid(1002),
      payload: { clientId: uuid(1002), name: "Zercher Squat", source: "manual" },
    });

    const [r1] = await applyOps(db, [first]);
    expect(r1.status).toBe("applied");

    // Before the fix, this threw a raw unique-violation error rather than resolving.
    const [r2] = await applyOps(db, [second]);
    expect(r2.status).toBe("applied");
  });

  it("converges same-named live rows to the one with the highest updated_hlc", async () => {
    const older = op({
      entity: "exercise",
      clientId: uuid(1003),
      payload: { clientId: uuid(1003), name: "Zercher Squat", source: "manual" },
    });
    await applyOps(db, [older]);

    // A later stamp, from the same or a different device — either way, this is the create the
    // catalogue should end up with.
    const newer = op({
      entity: "exercise",
      clientId: uuid(1004),
      payload: { clientId: uuid(1004), name: "Zercher Squat", source: "manual" },
    });
    await applyOps(db, [newer]);

    const live = await db.select().from(exercises).where(isNull(exercises.deletedAt));
    const named = live.filter((r) => r.name === "Zercher Squat");
    expect(named).toHaveLength(1);
    expect(named[0].clientId).toBe(uuid(1004));

    const gone = await db
      .select()
      .from(exercises)
      .where(eq(exercises.clientId, uuid(1003)));
    expect(gone[0].deletedAt).not.toBeNull();
  });

  it("does not touch rows with different names", async () => {
    await applyOps(db, [
      op({
        entity: "exercise",
        clientId: uuid(1005),
        payload: { clientId: uuid(1005), name: "Zercher Squat", source: "manual" },
      }),
    ]);
    await applyOps(db, [
      op({
        entity: "exercise",
        clientId: uuid(1006),
        payload: { clientId: uuid(1006), name: "Front Squat", source: "manual" },
      }),
    ]);

    const live = await db.select().from(exercises).where(isNull(exercises.deletedAt));
    expect(live.map((r) => r.name).sort()).toEqual(["Front Squat", "Zercher Squat"]);
  });

  it("is case- and whitespace-insensitive, via the generated name_key", async () => {
    await applyOps(db, [
      op({
        entity: "exercise",
        clientId: uuid(1007),
        payload: { clientId: uuid(1007), name: "Zercher Squat", source: "manual" },
      }),
    ]);
    await applyOps(db, [
      op({
        entity: "exercise",
        clientId: uuid(1008),
        payload: { clientId: uuid(1008), name: "  zercher squat  ", source: "manual" },
      }),
    ]);

    const live = await db.select().from(exercises).where(isNull(exercises.deletedAt));
    const named = live.filter((r) => r.clientId === uuid(1007) || r.clientId === uuid(1008));
    expect(named).toHaveLength(1);
  });

  it("derives primary_group from primary_muscles server-side, ignoring anything sent for it", async () => {
    await applyOps(db, [
      op({
        entity: "exercise",
        clientId: uuid(1009),
        payload: {
          clientId: uuid(1009),
          name: "Bench Press",
          source: "manual",
          primaryMuscles: ["chest"],
        },
      }),
    ]);

    const [row] = await db
      .select()
      .from(exercises)
      .where(eq(exercises.clientId, uuid(1009)));
    expect(row.primaryGroup).toBe("Chest");
  });
});

describe("pullChanges covers every entity", () => {
  it("has a push() for every ENTITIES member, not just the ones with a test", () => {
    // `pullChanges` is eight (now ten) hand-written blocks with no compile-time check that a
    // new entity got one — unlike `_writableCovered` and the `storedStamps` switch, both
    // exhaustive by construction. This is the runtime stand-in: it reads the source rather than
    // trusting a fixture, so an entity added without a `push(...)` call fails here instead of
    // silently never reaching the phone.
    const source = pullChanges.toString();
    for (const entity of ENTITIES) {
      expect(source, `pullChanges has no push("${entity}", ...) call`).toContain(`"${entity}"`);
    }
  });
});

describe("two devices", () => {
  it("the later stamp wins regardless of which arrives first", async () => {
    const phone = new HlcClock("phone");
    const laptop = new HlcClock("laptop");
    const clientId = uuid(960);

    const early: WireOp = {
      ...entry(clientId, "phone"),
      opId: uuid(1),
      op: "create",
      hlc: phone.tick(),
    };
    // The laptop has seen the phone's change, so its stamp sorts after it.
    const late: WireOp = {
      ...entry(clientId, "laptop"),
      opId: uuid(2),
      op: "update",
      hlc: laptop.receive(early.hlc),
    };

    await applyOps(db, [late]);
    const [result] = await applyOps(db, [early]);

    expect(result.status).toBe("stale");
    const [row] = await db.select().from(logEntries);
    expect(row.note).toBe("laptop");
  });

  it("a create from the laptop is visible to the phone through the pull", async () => {
    await db.insert(tasks).values({ title: "typed on the laptop" });
    const { changes } = await pullChanges(db, 0);
    const task = changes.find((c) => c.entity === "task");

    expect(task?.row).toMatchObject({ title: "typed on the laptop" });
    // Every row has a client id, including ones the server made — which is what lets the phone
    // address it later without ever learning the serial id.
    expect(task?.row.clientId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("does not resurrect a row deleted on one device by an older edit from the other", async () => {
    const clientId = uuid(961);
    const created = op(entry(clientId, "alive"));
    await applyOps(db, [created]);

    const staleEdit = op({ ...entry(clientId, "edited"), op: "update" });
    const deletion = op({ ...entry(clientId, "alive"), op: "delete" });

    await applyOps(db, [deletion]);
    const [result] = await applyOps(db, [staleEdit]);

    expect(result.status).toBe("stale");
    const [row] = await db.select().from(logEntries).where(eq(logEntries.clientId, clientId));
    expect(row.deletedAt).not.toBeNull();
  });
});
