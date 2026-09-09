// @vitest-environment node
import { eq, isNull, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { exercises, workouts, workoutSets } from "@/lib/db/schema";
import { applyOps, pullChanges, type Db } from "@/lib/sync/apply";
import { HlcClock } from "@/lib/sync/hlc";
import type { WireOp } from "@/lib/sync/protocol";
import { resetTestDb } from "@/test/pg";

/**
 * The aggregate op, against real Postgres (V4 Phase 2.4, `SYNC_DESIGN.md` §4a).
 *
 * This is the piece the design deferred twice — on 2026-08-30 for cost, again on 2026-09-03
 * (D-159) — and the reason both times was the same: `workout_sets.workout_id` is an integer
 * foreign key to a `serial`, and offline that number does not exist yet. §4a's answer is to
 * send the session and its sets as **one operation** and let the server assign the key inside a
 * transaction.
 *
 * So the properties worth running against a real database are not "does it insert". They are:
 * the foreign key is resolved server-side, nothing partial can survive a failure, and a
 * re-sent create is an upsert rather than a second session. A mocked query builder would accept
 * every one of those going wrong.
 */

let db: Db;
let clock: HlcClock;
let ids = 0;

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

function op(partial: Partial<WireOp> & Pick<WireOp, "entity" | "clientId" | "payload">): WireOp {
  return { opId: uuid(++ids), op: "create", hlc: clock.tick(), ...partial } as WireOp;
}

const SESSION = uuid(500);
const SET_A = uuid(501);
const SET_B = uuid(502);

function session(
  clientId = SESSION,
  sets: Record<string, unknown>[] = [
    { clientId: SET_A, exercise: "Bench Press", setIndex: 0, weightLbs: 185, reps: 5 },
    { clientId: SET_B, exercise: "Bench Press", setIndex: 1, weightLbs: 175, reps: 8 },
  ],
) {
  return {
    entity: "workout" as const,
    clientId,
    payload: {
      clientId,
      performedAt: "2026-09-08T18:00:00.000Z",
      title: "Push A",
      notes: "",
      sets,
    },
  };
}

beforeEach(async () => {
  db = (await resetTestDb()) as unknown as Db;
  clock = new HlcClock("device-a");
  ids = 0;
});

describe("a session and its sets arrive as one op", () => {
  it("writes the session and every set, with the foreign key resolved by the server", async () => {
    const [result] = await applyOps(db, [op(session())]);
    expect(result.status).toBe("applied");

    const [parent] = await db.select().from(workouts);
    const sets = await db.select().from(workoutSets);

    expect(parent.clientId).toBe(SESSION);
    expect(sets).toHaveLength(2);
    // The point of the whole design: the phone never knew this number.
    for (const set of sets) expect(set.workoutId).toBe(parent.id);
  });

  it("records it as a phone session, not an import", async () => {
    // `external_id` must stay null. The index on it is unique and Postgres treats each null as
    // distinct, so this is what stops two hand-logged sessions colliding with each other or
    // with a Hevy import (D-026).
    await applyOps(db, [op(session())]);
    const [parent] = await db.select().from(workouts);

    expect(parent.externalId).toBeNull();
    expect(parent.source).toBe("phone");
  });

  it("is an upsert, so re-sending it does not create a second session", async () => {
    // Retrying is not optional — failed writes are held and retried (D-129) — and the op that
    // carries a whole gym session is the most expensive one to duplicate.
    const first = op(session());
    await applyOps(db, [first]);
    await applyOps(db, [{ ...first, opId: uuid(700), hlc: clock.tick() }]);

    expect(await db.select().from(workouts)).toHaveLength(1);
    expect(await db.select().from(workoutSets)).toHaveLength(2);
  });

  it("reports an exact re-send as a duplicate rather than applying it twice", async () => {
    const only = op(session());
    await applyOps(db, [only]);
    const [again] = await applyOps(db, [only]);

    expect(again.status).toBe("duplicate");
  });

  it("accepts a session with no sets", async () => {
    // A session you started and saved before logging anything is not an error.
    const [result] = await applyOps(db, [op(session(SESSION, []))]);

    expect(result.status).toBe("applied");
    expect(await db.select().from(workouts)).toHaveLength(1);
    expect(await db.select().from(workoutSets)).toHaveLength(0);
  });

  it("leaves nothing behind when a set fails halfway through", async () => {
    /**
     * The property the transaction exists for, and the reason §4a chose an aggregate op over
     * the two alternatives: **no partial session can exist.**
     *
     * Provoking it needs a real database error *after* the parent is already written, and the
     * validator is deliberately good enough that no payload can do that — every zod bound is
     * inside its column's. So the failure is staged with a temporary CHECK constraint, which
     * is a faithful stand-in for the thing actually being guarded against: a constraint added
     * later, a disk error, a connection dropped mid-aggregate.
     *
     * The first set is fine and the second violates the constraint, so the parent and one set
     * are on disk when it fires. If the two statements were not in one transaction, that is
     * exactly the state this would leave behind — a session whose sets are half there, or
     * sets counting toward a PR board under a session that never finished saving.
     */
    await db.execute(
      sql`ALTER TABLE workout_sets ADD CONSTRAINT tmp_no_boom CHECK (exercise <> 'BOOM')`,
    );

    const broken = op(
      session(SESSION, [
        { clientId: SET_A, exercise: "Bench Press", setIndex: 0, reps: 5 },
        { clientId: SET_B, exercise: "BOOM", setIndex: 1, reps: 5 },
      ]),
    );

    await expect(applyOps(db, [broken])).rejects.toThrow();

    expect(await db.select().from(workouts)).toHaveLength(0);
    expect(await db.select().from(workoutSets)).toHaveLength(0);

    await db.execute(sql`ALTER TABLE workout_sets DROP CONSTRAINT tmp_no_boom`);
  });

  it("would have left a half-written session without the transaction", async () => {
    // The positive control for the test above. Same constraint, same bad set — but the parent
    // written on its own first, which is what the two rejected designs in §4a amount to. This
    // is the state that must be impossible, demonstrated to be reachable, so the assertion
    // above is known to be testing something.
    await db.execute(
      sql`ALTER TABLE workout_sets ADD CONSTRAINT tmp_no_boom CHECK (exercise <> 'BOOM')`,
    );

    await applyOps(db, [op(session(SESSION, []))]);
    const [parent] = await db.select().from(workouts);

    await expect(
      db.insert(workoutSets).values({
        clientId: SET_A,
        workoutId: parent.id,
        exercise: "BOOM",
        setIndex: 0,
      }),
    ).rejects.toThrow();

    // A session on disk with none of its sets — precisely what the aggregate prevents.
    expect(await db.select().from(workouts)).toHaveLength(1);
    expect(await db.select().from(workoutSets)).toHaveLength(0);

    await db.execute(sql`ALTER TABLE workout_sets DROP CONSTRAINT tmp_no_boom`);
  });

  it("rejects a payload the schema does not accept, without touching the tables", async () => {
    const bad = op({
      entity: "workout",
      clientId: SESSION,
      payload: { clientId: SESSION, performedAt: "not a date", sets: [] },
    });
    const [result] = await applyOps(db, [bad]);

    expect(result.status).toBe("rejected");
    expect(await db.select().from(workouts)).toHaveLength(0);
  });
});

describe("editing a set after the session exists", () => {
  it("changes one set without resending the session", async () => {
    // §4a: "after creation, sets are independent". Fixing a typo in set three must not mean
    // re-uploading the whole gym session.
    await applyOps(db, [op(session())]);

    const edit = op({
      entity: "workout_set",
      clientId: SET_A,
      op: "update",
      payload: {
        clientId: SET_A,
        parentClientId: SESSION,
        exercise: "Bench Press",
        setIndex: 0,
        weightLbs: 190,
        reps: 5,
      },
    });
    const [result] = await applyOps(db, [edit]);

    expect(result.status).toBe("applied");
    const [set] = await db.select().from(workoutSets).where(eq(workoutSets.clientId, SET_A));
    expect(set.weightLbs).toBe(190);
    // Still one session, and the other set is untouched.
    expect(await db.select().from(workouts)).toHaveLength(1);
    const [other] = await db.select().from(workoutSets).where(eq(workoutSets.clientId, SET_B));
    expect(other.reps).toBe(8);
  });

  it("tombstones one set without touching the rest", async () => {
    await applyOps(db, [op(session())]);

    await applyOps(db, [
      op({
        entity: "workout_set",
        clientId: SET_B,
        op: "delete",
        payload: {
          clientId: SET_B,
          parentClientId: SESSION,
          exercise: "Bench Press",
          setIndex: 1,
        },
      }),
    ]);

    const live = await db.select().from(workoutSets).where(isNull(workoutSets.deletedAt));
    expect(live).toHaveLength(1);
    expect(live[0].clientId).toBe(SET_A);
  });

  it("refuses a set whose session it has never seen, permanently", async () => {
    // Cannot happen in normal operation — the create carries the parent — so this is the guard
    // for a client bug. `rejected`, not a 500: it will never succeed on a later attempt, and an
    // op that is retried forever is an outbox that never drains.
    const orphan = op({
      entity: "workout_set",
      clientId: SET_A,
      payload: {
        clientId: SET_A,
        parentClientId: uuid(999),
        exercise: "Bench Press",
        setIndex: 0,
      },
    });
    const [result] = await applyOps(db, [orphan]);

    expect(result.status).toBe("rejected");
    expect(result.reason).toContain(uuid(999));
    expect(await db.select().from(workoutSets)).toHaveLength(0);
  });
});

describe("deleting a session", () => {
  it("tombstones the parent and its sets together", async () => {
    // §4a says reads filter children by the parent's `deleted_at`. Writing both anyway is
    // belt and braces for the device that only ever pulled the child row — a set left live
    // under a deleted session is a set that still reaches the PR board.
    await applyOps(db, [op(session())]);

    await applyOps(db, [op({ ...session(), op: "delete" })]);

    const [parent] = await db.select().from(workouts);
    expect(parent.deletedAt).not.toBeNull();
    const live = await db.select().from(workoutSets).where(isNull(workoutSets.deletedAt));
    expect(live).toHaveLength(0);
  });
});

describe("the exercise catalogue", () => {
  const CATALOGUE_ID = uuid(600);

  it("accepts one the phone added", async () => {
    const [result] = await applyOps(db, [
      op({
        entity: "exercise",
        clientId: CATALOGUE_ID,
        payload: {
          clientId: CATALOGUE_ID,
          name: "Zercher Squat",
          modality: "lift",
          muscles: ["quads", "core"],
          equipment: "barbell",
          source: "manual",
        },
      }),
    ]);

    expect(result.status).toBe("applied");
    const [row] = await db.select().from(exercises);
    expect(row.name).toBe("Zercher Squat");
    expect(row.muscles).toEqual(["quads", "core"]);
  });

  it("is addressed by client id, so two devices adding the same name do not collide", async () => {
    // The catalogue's natural key is `name`, but the op is keyed by `clientId` — otherwise two
    // devices adding "Zercher Squat" on the same afternoon race on a unique index and one of
    // them is lost rather than merged.
    await applyOps(db, [
      op({
        entity: "exercise",
        clientId: CATALOGUE_ID,
        payload: { clientId: CATALOGUE_ID, name: "Zercher Squat", source: "manual" },
      }),
    ]);

    const [second] = await applyOps(db, [
      op({
        entity: "exercise",
        clientId: CATALOGUE_ID,
        op: "update",
        payload: {
          clientId: CATALOGUE_ID,
          name: "Zercher Squat",
          modality: "lift",
          equipment: "barbell",
          source: "manual",
        },
      }),
    ]);

    expect(second.status).toBe("applied");
    expect(await db.select().from(exercises)).toHaveLength(1);
  });
});

describe("what the phone pulls back", () => {
  it("sends sessions, sets and catalogue rows down the same cursor", async () => {
    await applyOps(db, [op(session())]);
    await applyOps(db, [
      op({
        entity: "exercise",
        clientId: uuid(601),
        payload: { clientId: uuid(601), name: "Zercher Squat", source: "manual" },
      }),
    ]);

    const { changes } = await pullChanges(db, 0);
    const kinds = new Set(changes.map((c) => c.entity));

    expect(kinds.has("workout")).toBe(true);
    expect(kinds.has("workout_set")).toBe(true);
    // Added in Phase 2 — a table that is mirrored but missing from `pullChanges` is a store
    // that silently never fills, which is exactly what happened to workouts before D-165.
    expect(kinds.has("exercise")).toBe(true);
  });

  it("gives every pulled row the client id the phone will address it by", async () => {
    await applyOps(db, [op(session())]);
    const { changes } = await pullChanges(db, 0);

    for (const change of changes) {
      if (change.entity !== "workout" && change.entity !== "workout_set") continue;
      expect(typeof (change.row as { clientId?: unknown }).clientId).toBe("string");
    }
  });
});
