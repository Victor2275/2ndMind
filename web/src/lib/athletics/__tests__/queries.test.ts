// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";

import { resetTestDb } from "@/test/pg";
import { parseHevyCsv } from "../hevy";
import { ergRecords, strengthRecords } from "../prs";
import {
  allEfforts,
  countWorkouts,
  deleteWorkout,
  importWorkouts,
  logWorkout,
  recentWorkouts,
  type Db,
} from "../queries";

/**
 * These run against real Postgres — PGlite is the actual engine compiled to WASM — using the
 * committed migration SQL. A mocked query builder would have happily accepted the string
 * comparison bug that `numeric({ mode: "number" })` exists to prevent.
 */

let db: Db;

beforeEach(async () => {
  db = (await resetTestDb()) as unknown as Db;
});

const HEADER =
  "title,start_time,exercise_title,set_index,set_type,weight_lbs,reps," +
  "distance_miles,duration_seconds,rpe";

function exportCsv(rows: string[][]) {
  return [HEADER, ...rows.map((r) => r.join(","))].join("\n");
}

const PUSH_DAY = [
  ["Push Day", "2026-08-01 10:00:00", "Bench Press", "0", "warmup", "95", "8", "", "", ""],
  ["Push Day", "2026-08-01 10:00:00", "Bench Press", "1", "normal", "145", "5", "", "", ""],
  ["Push Day", "2026-08-01 10:00:00", "Bench Press", "2", "normal", "155", "3", "", "", ""],
];

const PULL_DAY = [
  ["Pull Day", "2026-08-03 10:00:00", "Row (Erg)", "0", "normal", "", "", "3.10686", "1130", ""],
];

describe("importWorkouts", () => {
  it("stores a parsed export", async () => {
    const plan = parseHevyCsv(exportCsv(PUSH_DAY));
    const result = await importWorkouts(db, plan.workouts);

    expect(result.insertedWorkouts).toBe(1);
    expect(result.insertedSets).toBe(3);
    expect(await countWorkouts(db)).toBe(1);
  });

  it("is a no-op when the same export is imported twice", async () => {
    const plan = parseHevyCsv(exportCsv(PUSH_DAY));
    await importWorkouts(db, plan.workouts);
    const second = await importWorkouts(db, plan.workouts);

    expect(second.insertedWorkouts).toBe(0);
    expect(second.skippedWorkouts).toBe(1);
    // The subtle half: sets must not be appended to the workout that already existed.
    expect(second.insertedSets).toBe(0);
    expect(await countWorkouts(db)).toBe(1);
    expect(await allEfforts(db)).toHaveLength(3);
  });

  it("adds only the new sessions from a later, larger export", async () => {
    await importWorkouts(db, parseHevyCsv(exportCsv(PUSH_DAY)).workouts);
    const grown = parseHevyCsv(exportCsv([...PUSH_DAY, ...PULL_DAY]));
    const result = await importWorkouts(db, grown.workouts);

    expect(result.insertedWorkouts).toBe(1);
    expect(result.skippedWorkouts).toBe(1);
    expect(await countWorkouts(db)).toBe(2);
    expect(await allEfforts(db)).toHaveLength(4);
  });

  it("does not corrupt PRs across a re-import", async () => {
    const plan = parseHevyCsv(exportCsv(PUSH_DAY));
    await importWorkouts(db, plan.workouts);
    const before = strengthRecords(await allEfforts(db));

    await importWorkouts(db, plan.workouts);
    const after = strengthRecords(await allEfforts(db));

    expect(after).toEqual(before);
    expect(after[0].workingSets).toBe(2); // the warmup is still excluded
  });

  it("accepts an empty plan", async () => {
    const result = await importWorkouts(db, []);
    expect(result).toEqual({ insertedWorkouts: 0, skippedWorkouts: 0, insertedSets: 0 });
  });

  it("writes more rows than a single statement can bind", async () => {
    // Exercises the chunking path: 1200 sets across one session.
    const rows = Array.from({ length: 1200 }, (_, i) => [
      "Volume Day",
      "2026-08-05 10:00:00",
      "Bench Press",
      String(i),
      "normal",
      "135",
      "5",
      "",
      "",
      "",
    ]);
    const plan = parseHevyCsv(exportCsv(rows));
    const result = await importWorkouts(db, plan.workouts);

    expect(result.insertedSets).toBe(1200);
    expect(await allEfforts(db)).toHaveLength(1200);
  });
});

describe("numeric handling", () => {
  it("returns weights as numbers, so comparisons are numeric not lexical", async () => {
    await importWorkouts(db, parseHevyCsv(exportCsv(PUSH_DAY)).workouts);
    const efforts = await allEfforts(db);
    const weights = efforts.map((e) => e.weightLbs);

    for (const w of weights) expect(typeof w).toBe("number");
    // The bug this guards: as strings, "95" > "155" is true and the warmup outranks
    // every working set.
    expect(Math.max(...(weights as number[]))).toBe(155);
  });

  it("round-trips a fractional weight without drift", async () => {
    const id = await logWorkout(db, {
      performedAt: new Date("2026-08-10T10:00:00Z"),
      title: "Kg plates",
      notes: "",
      sets: [{ exercise: "Squat", setIndex: 0, setType: "normal", weightLbs: 220.46, reps: 3 }],
    });
    expect(id).toBeGreaterThan(0);
    const [effort] = await allEfforts(db);
    expect(effort.weightLbs).toBeCloseTo(220.46, 2);
  });
});

describe("logWorkout", () => {
  it("allows several manual sessions, which all have a null external id", async () => {
    for (const day of ["2026-08-10", "2026-08-11", "2026-08-12"]) {
      await logWorkout(db, {
        performedAt: new Date(`${day}T10:00:00Z`),
        title: "Erg",
        notes: "",
        sets: [],
      });
    }
    // If the unique index treated nulls as equal, the second insert would have thrown.
    expect(await countWorkouts(db)).toBe(3);
  });

  it("stores a session with no sets", async () => {
    await logWorkout(db, {
      performedAt: new Date("2026-08-10T10:00:00Z"),
      title: "Rest day walk",
      notes: "easy",
      sets: [],
    });
    expect(await countWorkouts(db)).toBe(1);
    expect(await allEfforts(db)).toEqual([]);
  });
});

describe("recentWorkouts", () => {
  it("summarises volume and set count, newest first", async () => {
    await importWorkouts(db, parseHevyCsv(exportCsv([...PUSH_DAY, ...PULL_DAY])).workouts);
    const summaries = await recentWorkouts(db);

    expect(summaries.map((s) => s.title)).toEqual(["Pull Day", "Push Day"]);
    const push = summaries.find((s) => s.title === "Push Day")!;
    expect(push.setCount).toBe(3);
    // 95*8 + 145*5 + 155*3 = 760 + 725 + 465
    expect(push.volumeLbs).toBeCloseTo(1950, 0);
  });

  it("reports zero volume rather than null for a bodyweight-only session", async () => {
    await logWorkout(db, {
      performedAt: new Date("2026-08-10T10:00:00Z"),
      title: "Pull-ups",
      notes: "",
      sets: [{ exercise: "Pull Up", setIndex: 0, setType: "normal", reps: 10 }],
    });
    const [summary] = await recentWorkouts(db);
    expect(summary.volumeLbs).toBe(0);
    expect(summary.setCount).toBe(1);
  });

  it("reports zero volume for a session with no sets at all", async () => {
    await logWorkout(db, {
      performedAt: new Date("2026-08-10T10:00:00Z"),
      title: "Empty",
      notes: "",
      sets: [],
    });
    const [summary] = await recentWorkouts(db);
    expect(summary.setCount).toBe(0);
    expect(summary.volumeLbs).toBe(0);
  });
});

describe("erg records through the database", () => {
  it("computes a 5k split from stored metres and seconds", async () => {
    await importWorkouts(db, parseHevyCsv(exportCsv(PULL_DAY)).workouts);
    const [record] = ergRecords(await allEfforts(db));

    expect(record.distanceM).toBe(5000);
    // 1130s over 5000m is a 1:53 split, matching the 5k PR the vault records.
    expect(record.splitPer500S).toBeCloseTo(113, 0);
  });
});

describe("deleteWorkout", () => {
  it("takes the sets with it", async () => {
    await importWorkouts(db, parseHevyCsv(exportCsv(PUSH_DAY)).workouts);
    const [summary] = await recentWorkouts(db);
    await deleteWorkout(db, summary.id);

    expect(await countWorkouts(db)).toBe(0);
    // Orphaned sets would keep inflating PRs invisibly.
    expect(await allEfforts(db)).toEqual([]);
  });
});
