// @vitest-environment node
import { isNull } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { routineExercises, routines } from "@/lib/db/schema";
import { applyOps, pullChanges, type Db } from "@/lib/sync/apply";
import { HlcClock } from "@/lib/sync/hlc";
import type { WireOp } from "@/lib/sync/protocol";
import { resetTestDb } from "@/test/pg";

/**
 * The routine aggregate op, against real Postgres (V4 Phase 2++ Stage 2).
 *
 * Same shape as `workouts.db.test.ts` — a routine and its lines travel as one operation, and the
 * server assigns `routine_exercises.routine_id` inside a transaction — with one property that
 * file does not have to check: **replace-all.** A workout's aggregate upserts into whatever sets
 * exist; a routine's replaces the whole line list, because reordering and removing lines is the
 * normal edit for a template.
 */

let db: Db;
let clock: HlcClock;
let ids = 0;

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

function op(partial: Partial<WireOp> & Pick<WireOp, "entity" | "clientId" | "payload">): WireOp {
  return { opId: uuid(++ids), op: "create", hlc: clock.tick(), ...partial } as WireOp;
}

const ROUTINE = uuid(500);
const LINE_A = uuid(501);
const LINE_B = uuid(502);

function routine(
  clientId = ROUTINE,
  exercisesIn: Record<string, unknown>[] = [
    { clientId: LINE_A, exercise: "Bench Press", position: 0, targetSets: 3, targetReps: 5 },
    { clientId: LINE_B, exercise: "Barbell Row", position: 1, targetSets: 3, targetReps: 8 },
  ],
) {
  return {
    entity: "routine" as const,
    clientId,
    payload: { clientId, name: "Push A", notes: "", exercises: exercisesIn },
  };
}

beforeEach(async () => {
  db = (await resetTestDb()) as unknown as Db;
  clock = new HlcClock("device-a");
  ids = 0;
});

describe("a routine and its lines arrive as one op", () => {
  it("writes the routine and every line, with the foreign key resolved by the server", async () => {
    const [result] = await applyOps(db, [op(routine())]);
    expect(result.status).toBe("applied");

    const [parent] = await db.select().from(routines);
    const lines = await db.select().from(routineExercises);

    expect(parent.clientId).toBe(ROUTINE);
    expect(lines).toHaveLength(2);
    for (const line of lines) expect(line.routineId).toBe(parent.id);
  });

  it("is an upsert, so re-sending it does not create a second routine", async () => {
    const first = op(routine());
    await applyOps(db, [first]);
    await applyOps(db, [{ ...first, opId: uuid(700), hlc: clock.tick() }]);

    expect(await db.select().from(routines)).toHaveLength(1);
    expect(await db.select().from(routineExercises)).toHaveLength(2);
  });

  it("accepts a routine with no lines yet", async () => {
    const [result] = await applyOps(db, [op(routine(ROUTINE, []))]);
    expect(result.status).toBe("applied");
    expect(await db.select().from(routineExercises)).toHaveLength(0);
  });
});

describe("saving again replaces the line list rather than adding to it", () => {
  it("removes a line that is no longer sent", async () => {
    await applyOps(db, [op(routine())]);

    // Save again with only the first line — B was removed.
    await applyOps(db, [
      op({
        ...routine(ROUTINE, [
          { clientId: LINE_A, exercise: "Bench Press", position: 0, targetSets: 3, targetReps: 5 },
        ]),
        op: "update",
      }),
    ]);

    const live = await db.select().from(routineExercises).where(isNull(routineExercises.deletedAt));
    expect(live).toHaveLength(1);
    expect(live[0].clientId).toBe(LINE_A);
  });

  it("tombstones every old line when the routine is saved as empty", async () => {
    await applyOps(db, [op(routine())]);
    await applyOps(db, [op({ ...routine(ROUTINE, []), op: "update" })]);

    const live = await db.select().from(routineExercises).where(isNull(routineExercises.deletedAt));
    expect(live).toHaveLength(0);
    // The rows still exist, tombstoned — that is what lets the pull tell a device that had
    // them that they are gone, rather than the device never learning at all.
    expect(await db.select().from(routineExercises)).toHaveLength(2);
  });

  it("adds a new line and reorders the existing ones in one save", async () => {
    await applyOps(db, [op(routine())]);

    const LINE_C = uuid(503);
    await applyOps(db, [
      op({
        ...routine(ROUTINE, [
          // B now comes first, a new line C is added, A is dropped.
          { clientId: LINE_B, exercise: "Barbell Row", position: 0, targetSets: 4, targetReps: 6 },
          {
            clientId: LINE_C,
            exercise: "Overhead Press",
            position: 1,
            targetSets: 3,
            targetReps: 8,
          },
        ]),
        op: "update",
      }),
    ]);

    const live = await db.select().from(routineExercises).where(isNull(routineExercises.deletedAt));
    expect(live.map((l) => l.clientId).sort()).toEqual([LINE_B, LINE_C].sort());
    const b = live.find((l) => l.clientId === LINE_B);
    expect(b?.position).toBe(0);
    expect(b?.targetSets).toBe(4);
  });

  it("re-running the same save twice is idempotent", async () => {
    await applyOps(db, [op(routine())]);
    const update = op({ ...routine(), op: "update" });
    await applyOps(db, [update]);
    await applyOps(db, [{ ...update, opId: uuid(701), hlc: clock.tick() }]);

    const live = await db.select().from(routineExercises).where(isNull(routineExercises.deletedAt));
    expect(live).toHaveLength(2);
  });
});

describe("deleting a routine", () => {
  it("tombstones the parent and every line", async () => {
    await applyOps(db, [op(routine())]);
    await applyOps(db, [op({ ...routine(), op: "delete" })]);

    const [parent] = await db.select().from(routines);
    expect(parent.deletedAt).not.toBeNull();
    const live = await db.select().from(routineExercises).where(isNull(routineExercises.deletedAt));
    expect(live).toHaveLength(0);
  });
});

describe("what the phone pulls back", () => {
  it("sends routines and their lines down the same cursor", async () => {
    await applyOps(db, [op(routine())]);
    const { changes } = await pullChanges(db, 0);
    const kinds = new Set(changes.map((c) => c.entity));

    expect(kinds.has("routine")).toBe(true);
    expect(kinds.has("routine_exercise")).toBe(true);
  });
});
