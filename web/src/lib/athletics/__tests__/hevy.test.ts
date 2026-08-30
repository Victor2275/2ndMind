import { describe, expect, it } from "vitest";

import { detectUnits, parseHevyCsv, parseHevyDate, workoutExternalId } from "../hevy";

const HEADER =
  "title,start_time,end_time,description,exercise_title,superset_id,exercise_notes," +
  "set_index,set_type,weight_lbs,reps,distance_miles,duration_seconds,rpe";

function csv(...rows: string[]) {
  return [HEADER, ...rows].join("\n");
}

const ROW = (over: Partial<Record<string, string>> = {}) => {
  const base: Record<string, string> = {
    title: "Push Day",
    start_time: "2026-08-01 10:00:00",
    end_time: "2026-08-01 11:00:00",
    description: "",
    exercise_title: "Bench Press",
    superset_id: "",
    exercise_notes: "",
    set_index: "0",
    set_type: "normal",
    weight_lbs: "145",
    reps: "5",
    distance_miles: "",
    duration_seconds: "",
    rpe: "",
    ...over,
  };
  return HEADER.split(",")
    .map((h) => base[h] ?? "")
    .join(",");
};

describe("parseHevyDate", () => {
  it("reads the space-separated form Hevy emits", () => {
    expect(parseHevyDate("2026-08-01 10:00:00")?.toISOString()).toBe("2026-08-01T10:00:00.000Z");
  });

  it("reads ISO", () => {
    expect(parseHevyDate("2026-08-01T10:00:00Z")?.toISOString()).toBe("2026-08-01T10:00:00.000Z");
  });

  it("reads the long form used by older exports", () => {
    expect(parseHevyDate("1 Aug 2026, 10:00")?.toISOString()).toBe("2026-08-01T10:00:00.000Z");
  });

  it("refuses ambiguous or junk dates instead of guessing", () => {
    // 01/08/2026 is either 1 August or 8 January depending on locale. Guessing would
    // silently reorder a training history, so it is rejected.
    expect(parseHevyDate("01/08/2026 10:00")).toBeNull();
    expect(parseHevyDate("yesterday")).toBeNull();
    expect(parseHevyDate("")).toBeNull();
  });
});

describe("detectUnits", () => {
  it("reads weight units from the column name", () => {
    expect(detectUnits(["weight_kg", "reps"]).weight).toBe("kg");
    expect(detectUnits(["weight_lbs", "reps"]).weight).toBe("lbs");
  });
});

describe("parseHevyCsv", () => {
  it("groups sets into one workout", () => {
    const plan = parseHevyCsv(
      csv(ROW({ set_index: "0" }), ROW({ set_index: "1" }), ROW({ set_index: "2" })),
    );
    expect(plan.workouts).toHaveLength(1);
    expect(plan.workouts[0].sets).toHaveLength(3);
    expect(plan.errors).toEqual([]);
  });

  it("separates workouts recorded at different times", () => {
    const plan = parseHevyCsv(
      csv(ROW(), ROW({ start_time: "2026-08-03 10:00:00", title: "Pull Day" })),
    );
    expect(plan.workouts).toHaveLength(2);
    // Sorted oldest first so an import reads as a timeline.
    expect(plan.workouts[0].title).toBe("Push Day");
  });

  it("produces a stable external id, so re-importing the same export is a no-op", () => {
    const first = parseHevyCsv(csv(ROW()));
    const second = parseHevyCsv(csv(ROW(), ROW({ start_time: "2026-08-09 09:00:00" })));
    // The cumulative re-export contains the original session unchanged; its id must match.
    expect(second.workouts[0].externalId).toBe(first.workouts[0].externalId);
  });

  it("converts kilograms to pounds rather than reading them as pounds", () => {
    const kgHeader = HEADER.replace("weight_lbs", "weight_kg");
    const row = ROW({ weight_lbs: "100" }); // same column position, now labelled kg
    const plan = parseHevyCsv([kgHeader, row].join("\n"));
    expect(plan.workouts[0].sets[0].weightLbs).toBeCloseTo(220.46, 1);
  });

  it("converts miles to metres", () => {
    const plan = parseHevyCsv(
      csv(ROW({ exercise_title: "Row (Erg)", distance_miles: "1", duration_seconds: "480" })),
    );
    expect(plan.workouts[0].sets[0].distanceM).toBeCloseTo(1609.34, 1);
  });

  it("keeps warmup sets but preserves their type", () => {
    const plan = parseHevyCsv(csv(ROW({ set_type: "warmup" }), ROW({ set_index: "1" })));
    expect(plan.workouts[0].sets.map((s) => s.setType)).toEqual(["warmup", "normal"]);
  });

  it("turns blank cells into null instead of NaN or zero", () => {
    const plan = parseHevyCsv(csv(ROW({ weight_lbs: "", reps: "", rpe: "" })));
    const set = plan.workouts[0].sets[0];
    expect(set.weightLbs).toBeNull();
    expect(set.reps).toBeNull();
    expect(set.rpe).toBeNull();
  });

  it("treats a dash as absent, which is how Hevy writes bodyweight sets", () => {
    const plan = parseHevyCsv(csv(ROW({ weight_lbs: "-" })));
    expect(plan.workouts[0].sets[0].weightLbs).toBeNull();
  });

  it("rejects part-numeric junk rather than silently truncating it", () => {
    const plan = parseHevyCsv(csv(ROW({ weight_lbs: "145lbs" })));
    expect(plan.workouts[0].sets[0].weightLbs).toBeNull();
  });

  it("skips an unreadable row and names the spreadsheet line number", () => {
    const plan = parseHevyCsv(csv(ROW(), ROW({ start_time: "nonsense" })));
    expect(plan.workouts).toHaveLength(1);
    expect(plan.rowsSkipped).toBe(1);
    // Row 1 is the header, so the second data row is line 3 in a spreadsheet.
    expect(plan.errors[0]).toContain("Row 3");
  });

  it("survives a UTF-8 BOM, which Excel adds on save", () => {
    const plan = parseHevyCsv("﻿" + csv(ROW()));
    expect(plan.workouts).toHaveLength(1);
    expect(plan.workouts[0].title).toBe("Push Day");
  });

  it("explains itself when handed a file that is not a Hevy export", () => {
    const plan = parseHevyCsv("name,age\nVictor,20");
    expect(plan.workouts).toEqual([]);
    expect(plan.errors[0]).toContain("exercise_title");
  });

  it("does not throw on an empty file", () => {
    expect(() => parseHevyCsv("")).not.toThrow();
    expect(parseHevyCsv("").workouts).toEqual([]);
  });

  it("falls back to a title rather than producing an empty external id", () => {
    const plan = parseHevyCsv(csv(ROW({ title: "" })));
    expect(plan.workouts[0].title).toBe("Workout");
    expect(plan.workouts[0].externalId).toContain("workout");
  });
});

describe("workoutExternalId", () => {
  it("is stable and namespaced", () => {
    const id = workoutExternalId(new Date("2026-08-01T10:00:00Z"), "Push Day");
    expect(id).toBe("hevy:2026-08-01T10:00:00.000Z:push-day");
  });

  it("does not collide between different titles at the same instant", () => {
    const at = new Date("2026-08-01T10:00:00Z");
    expect(workoutExternalId(at, "Push Day")).not.toBe(workoutExternalId(at, "Pull Day"));
  });
});
