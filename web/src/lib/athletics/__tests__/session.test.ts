// @vitest-environment jsdom
import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  addExercise,
  deleteSession,
  deleteSet,
  emptySet,
  hasContent,
  saveSession,
  updateSession,
  updateSet,
} from "@/lib/athletics/session";
import { allOps, DB_NAME, openSyncDb, type SyncDb } from "@/lib/sync/store";

/**
 * Writing a session from the phone (V4 Phase 2.5).
 *
 * The property that matters most is not that it saves — it is that **it always takes the same
 * path**. Every other write in this app has two, a Server Action and a local writer, and
 * `lib/offline/write.ts` exists to keep them in step. A session has one, because the aggregate
 * op carries its own identity and the server assigns the foreign key, so writing locally and
 * letting the ordinary flush deliver it is the same result a moment later rather than a degraded
 * mode. Nothing here mocks a network, because nothing here touches one.
 */

let db: SyncDb;

const SESSION = "aaaaaaaa-0000-4000-8000-000000000001";

const lift = (over: Partial<ReturnType<typeof emptySet>> = {}) => ({
  ...emptySet("Bench Press", 0),
  weightLbs: 185,
  reps: 5,
  ...over,
});

const input = (over: Record<string, unknown> = {}) => ({
  performedAt: new Date("2026-09-08T18:00:00.000Z"),
  title: "Push A",
  notes: "",
  sets: [lift()],
  ...over,
});

beforeEach(async () => {
  db = await openSyncDb(DB_NAME);
  const tx = db.transaction(
    ["outbox", "workouts", "workout_sets", "bodyweight_entries", "exercises"],
    "readwrite",
  );
  await Promise.all([
    tx.objectStore("outbox").clear(),
    tx.objectStore("workouts").clear(),
    tx.objectStore("workout_sets").clear(),
    tx.objectStore("bodyweight_entries").clear(),
    tx.objectStore("exercises").clear(),
  ]);
  await tx.done;
});

afterEach(() => db?.close());

describe("saving a session", () => {
  it("queues one op carrying every set", async () => {
    // The aggregate op. One outbox entry, not one per set — which is what lets the server apply
    // it in a single transaction and assign the foreign key itself.
    const result = await saveSession(
      input({ sets: [lift(), lift({ setIndex: 1, reps: 8 })] }),
      SESSION,
    );
    expect(result.ok).toBe(true);

    const ops = await allOps(db);
    expect(ops).toHaveLength(1);
    expect(ops[0].entity).toBe("workout");
    expect(ops[0].clientId).toBe(SESSION);
    expect((ops[0].payload as { sets: unknown[] }).sets).toHaveLength(2);
  });

  it("gives every set its own identity, so one can be edited later", async () => {
    // §4a: "after creation, sets are independent". A set with no client id of its own could
    // only ever be changed by resending the whole session.
    await saveSession(input({ sets: [lift(), lift({ reps: 8 })] }), SESSION);

    const [op] = await allOps(db);
    const sets = (op.payload as { sets: { clientId: string }[] }).sets;
    expect(new Set(sets.map((s) => s.clientId)).size).toBe(2);
  });

  it("renumbers sets so deleting the middle one leaves no gap", async () => {
    // The index is what "Set 3" on screen counts from, so it has to be positional rather than
    // whatever the form happened to hold.
    await saveSession(
      input({ sets: [lift({ setIndex: 0 }), lift({ setIndex: 7 }), lift({ setIndex: 9 })] }),
      SESSION,
    );

    const [op] = await allOps(db);
    const sets = (op.payload as { sets: { setIndex: number }[] }).sets;
    expect(sets.map((s) => s.setIndex)).toEqual([0, 1, 2]);
  });

  it("drops rows that were added and never filled in", async () => {
    // What makes "add set" free: a row with a name and no numbers is one you tapped and did not
    // use, and saving it would put an empty set on the board.
    await saveSession(input({ sets: [lift(), emptySet("Bench Press", 1)] }), SESSION);

    const [op] = await allOps(db);
    expect((op.payload as { sets: unknown[] }).sets).toHaveLength(1);
  });

  it("refuses a submit with nothing in it", async () => {
    const result = await saveSession(input({ sets: [], title: "" }), SESSION);

    expect(result.ok).toBe(false);
    expect(await allOps(db)).toHaveLength(0);
  });

  it("writes the same session twice when saved twice, not two sessions", async () => {
    // The identity is passed in rather than generated inside precisely so a retry is idempotent.
    // Minting it per call would turn a second tap of Save into a second gym session.
    await saveSession(input(), SESSION);
    await saveSession(input(), SESSION);

    const ops = await allOps(db);
    expect(new Set(ops.map((op) => op.clientId)).size).toBe(1);
  });
});

describe("the weigh-in", () => {
  /**
   * These moved here from `lib/offline/__tests__/write.test.ts` in Phase 2.7.
   *
   * `bodyweightLbs` was a field on the quick log's `athletics` category, and retiring that
   * category removed the only way to record a weight from the phone. The two tests that used to
   * live there are what caught it — they suddenly had no field to read — so the field followed
   * the feature onto the session screen and its tests followed it here.
   */
  it("goes to its own table, never onto the session", async () => {
    // Bodyweight is the second input to every adjusted split, so there is one copy of it and a
    // training row is not where it lives (D-159).
    await saveSession(input({ bodyweightLbs: 178.3 }), SESSION);

    const ops = await allOps(db);
    const session = ops.find((op) => op.entity === "workout");
    const weight = ops.find((op) => op.entity === "bodyweight");

    expect(session?.payload).not.toHaveProperty("bodyweightLbs");
    expect(weight?.payload).toMatchObject({ weightLbs: 178.3 });
  });

  it("gives each op a distinct, increasing stamp", async () => {
    // Both ops come from one submit. Sharing a stamp would leave last-write-wins with a tie to
    // break on a device id it cannot tell apart from itself.
    await saveSession(input({ bodyweightLbs: 178 }), SESSION);

    const stamps = (await allOps(db)).map((op) => op.hlc);
    expect(new Set(stamps).size).toBe(2);
    expect([...stamps].sort()).toEqual(stamps.slice().sort());
  });

  it("can be recorded on its own, without a session", async () => {
    // You stepped on the scale and did not train. Requiring a session to log a weight is how a
    // fold like this quietly loses a daily habit.
    const result = await saveSession(input({ sets: [], title: "", bodyweightLbs: 176 }), SESSION);

    expect(result.ok).toBe(true);
    const ops = await allOps(db);
    expect(ops).toHaveLength(1);
    expect(ops[0].entity).toBe("bodyweight");
  });

  it("ignores a blank or nonsense weight rather than queueing one", async () => {
    await saveSession(input({ bodyweightLbs: 0 }), SESSION);
    expect((await allOps(db)).some((op) => op.entity === "bodyweight")).toBe(false);
  });
});

describe("adding to the catalogue", () => {
  it("queues an exercise op of its own", async () => {
    // Separate from the session on purpose: a movement you invent mid-session should survive
    // even if you abandon the session.
    const result = await addExercise({
      name: "Zercher Squat",
      modality: "lift",
      muscles: ["quads"],
      equipment: "barbell",
      source: "manual",
    });

    expect(result.ok).toBe(true);
    const [op] = await allOps(db);
    expect(op.entity).toBe("exercise");
    expect(op.payload).toMatchObject({ name: "Zercher Squat", source: "manual" });
  });

  it("refuses a nameless one", async () => {
    const result = await addExercise({
      name: "   ",
      modality: "lift",
      muscles: [],
      equipment: "",
      source: "manual",
    });

    expect(result.ok).toBe(false);
    expect(await allOps(db)).toHaveLength(0);
  });
});

describe("hasContent", () => {
  it("is what decides an empty row, in one place", () => {
    expect(hasContent(emptySet("Bench Press", 0))).toBe(false);
    expect(hasContent({ ...emptySet("Bench Press", 0), reps: 5 })).toBe(true);
    // A set type on its own is not content — it is the default the row was created with.
    expect(hasContent({ ...emptySet("Bench Press", 0), setType: "warmup" })).toBe(false);
  });
});

describe("changing a session after it is saved (Q402)", () => {
  /**
   * §4a: *"after creation, sets are independent"*. The property under test is that a correction
   * is **one op keyed by the set's own client id** — not a re-send of the session.
   *
   * That distinction is not an optimisation. A session re-sent as a create would carry whatever
   * the screen happened to hold for every other set, and would overwrite an edit made on the
   * laptop in between with stale values, silently.
   */
  const SET = "bbbbbbbb-0000-4000-8000-000000000001";

  const storedSet = {
    clientId: SET,
    exercise: "Bench Press",
    setIndex: 0,
    setType: "normal",
    weightLbs: 185,
    reps: 5,
    distanceM: null,
    durationS: null,
    spm: null,
    rpe: null,
  };

  it("edits one set without touching the session", async () => {
    const result = await updateSet(SESSION, { ...storedSet, weightLbs: 190 });

    expect(result.ok).toBe(true);
    const ops = await allOps(db);
    expect(ops).toHaveLength(1);
    expect(ops[0].entity).toBe("workout_set");
    expect(ops[0].op).toBe("update");
    expect(ops[0].clientId).toBe(SET);
    expect(ops[0].payload).toMatchObject({ weightLbs: 190, parentClientId: SESSION });
  });

  it("names the parent by client id, because the phone has never seen the serial", async () => {
    // The server refuses a set whose parent it does not know, and the client id is the only name
    // both sides share — which is the whole reason §4a exists.
    await updateSet(SESSION, storedSet);
    const [op] = await allOps(db);
    expect(op.payload.parentClientId).toBe(SESSION);
  });

  it("deletes one set as a tombstone", async () => {
    const result = await deleteSet(SESSION, storedSet);

    expect(result.ok).toBe(true);
    const [op] = await allOps(db);
    expect(op.op).toBe("delete");
    expect(op.entity).toBe("workout_set");
  });

  it("edits the session itself without resending its sets", async () => {
    // `sets: []` is deliberate. An update carries no sets — they are independent rows now, and
    // sending the ones this screen holds would overwrite an edit made elsewhere in between.
    const result = await updateSession({
      clientId: SESSION,
      performedAt: new Date("2026-09-08T18:00:00.000Z"),
      title: "Push B",
      notes: "felt heavy",
    });

    expect(result.ok).toBe(true);
    const [op] = await allOps(db);
    expect(op.entity).toBe("workout");
    expect(op.op).toBe("update");
    expect(op.payload).toMatchObject({ title: "Push B", notes: "felt heavy" });
    expect(op.payload.sets).toEqual([]);
  });

  it("deletes a whole session", async () => {
    const result = await deleteSession(SESSION);

    expect(result.ok).toBe(true);
    const [op] = await allOps(db);
    expect(op.entity).toBe("workout");
    expect(op.op).toBe("delete");
    expect(op.clientId).toBe(SESSION);
  });
});
