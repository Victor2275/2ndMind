// @vitest-environment node
import { describe, expect, it } from "vitest";

import { ENTITIES, identityOf, isWritable, WRITABLE } from "@/lib/sync/entities";

/**
 * How a mirrored row is named.
 *
 * These are three lines of `switch`, which is exactly why they went wrong: `identityOf` was
 * written around one rule — "a UUID, unless the table has a natural key" — and `workout` and
 * `workout_set` matched neither branch. They fell through to the UUID case, which threw,
 * which the sync runner caught and discarded. The whole workout mirror had never populated
 * once and nothing said so until the dashboard grew an error panel (D-165).
 *
 * So the tests below check every entity, not the interesting ones. An entity added later
 * without a case here fails the last test in this file rather than failing silently on a
 * phone six weeks from now.
 */

const ROWS: Record<string, Record<string, unknown>> = {
  log_entry: { clientId: "6f1c2d8e-0000-4000-8000-000000000001", note: "x" },
  task: { clientId: "6f1c2d8e-0000-4000-8000-000000000002", title: "x" },
  bodyweight: { measuredOn: "2026-09-04", weightLbs: 171 },
  rehab: { completedOn: "2026-09-04", slug: "dead-bug" },
  workout: { id: 412, title: "Push A", performedAt: "2026-09-04T18:00:00Z" },
  workout_set: { id: 9081, workoutId: 412, exercise: "Bench Press", reps: 5 },
  ai_summary: { kind: "daily", periodStart: "2026-09-04" },
};

describe("identityOf", () => {
  it("names a row for every entity that is mirrored", () => {
    // The guard against the actual bug: not "does workout_set work" but "is there any
    // entity this function cannot name".
    for (const entity of ENTITIES) {
      expect(() => identityOf(entity, ROWS[entity]), entity).not.toThrow();
      expect(identityOf(entity, ROWS[entity]), entity).not.toBe("");
    }
  });

  it("addresses a workout by the server's id, because the phone never mints one", () => {
    // Safe only because workouts are pull-only. The moment they become writable this is a
    // duplicate-row generator, so the assertion below pins the assumption it rests on.
    expect(identityOf("workout", ROWS.workout)).toBe("412");
    expect(identityOf("workout_set", ROWS.workout_set)).toBe("9081");
    expect(isWritable("workout")).toBe(false);
    expect(isWritable("workout_set")).toBe(false);
  });

  it("refuses a workout row with no id rather than inventing one", () => {
    // A row with no identity must not quietly become the key "undefined", which is one
    // object-store slot that every such row would then overwrite in turn.
    expect(() => identityOf("workout_set", { exercise: "Bench Press" })).toThrow(/no id/);
  });

  it("still requires a client id where there is no natural key", () => {
    expect(() => identityOf("log_entry", { note: "x" })).toThrow(/clientId/);
    expect(() => identityOf("task", { clientId: "" })).toThrow(/clientId/);
  });

  it("gives two rows of the same entity different names", () => {
    expect(identityOf("workout_set", { id: 1 })).not.toBe(identityOf("workout_set", { id: 2 }));
    expect(identityOf("rehab", { completedOn: "2026-09-04", slug: "a" })).not.toBe(
      identityOf("rehab", { completedOn: "2026-09-04", slug: "b" }),
    );
  });

  it("is stable for the same row read twice", () => {
    for (const entity of ENTITIES) {
      expect(identityOf(entity, ROWS[entity])).toBe(identityOf(entity, { ...ROWS[entity] }));
    }
  });
});

describe("the fixtures above", () => {
  it("covers every entity, so adding one without a case here fails", () => {
    expect(Object.keys(ROWS).sort()).toEqual([...ENTITIES].sort());
  });

  it("keeps WRITABLE a subset of ENTITIES", () => {
    for (const entity of WRITABLE) expect(ENTITIES).toContain(entity);
  });
});
