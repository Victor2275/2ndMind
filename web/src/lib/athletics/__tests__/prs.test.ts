import { describe, expect, it } from "vitest";

import {
  E1RM_REP_CAP,
  estimateOneRepMax,
  ergRecords,
  formatDuration,
  formatSplit,
  isWorkingSet,
  strengthRecords,
  type Effort,
} from "../prs";

const at = (iso: string) => new Date(`${iso}T10:00:00Z`);

function lift(over: Partial<Effort> = {}): Effort {
  return {
    exercise: "Bench Press",
    performedAt: at("2026-08-01"),
    setType: "normal",
    weightLbs: 145,
    reps: 5,
    distanceM: null,
    durationS: null,
    spm: null,
    pieceType: null,
    ...over,
  };
}

function piece(over: Partial<Effort> = {}): Effort {
  return {
    exercise: "Row (Erg)",
    performedAt: at("2026-08-01"),
    setType: "normal",
    weightLbs: null,
    reps: null,
    distanceM: 500,
    durationS: 137,
    spm: null,
    pieceType: null,
    ...over,
  };
}

describe("estimateOneRepMax", () => {
  it("matches Epley", () => {
    expect(estimateOneRepMax(145, 5)).toBeCloseTo(169.2, 1);
    expect(estimateOneRepMax(200, 1)).toBeCloseTo(206.7, 1);
  });

  it("refuses high-rep sets instead of extrapolating", () => {
    expect(estimateOneRepMax(95, E1RM_REP_CAP + 1)).toBeNull();
    // The bug this prevents: a set of 20 light reps outranking a genuine heavy single.
    expect(estimateOneRepMax(95, 20)).toBeNull();
  });

  it("refuses nonsense input", () => {
    expect(estimateOneRepMax(0, 5)).toBeNull();
    expect(estimateOneRepMax(145, 0)).toBeNull();
    expect(estimateOneRepMax(-10, 5)).toBeNull();
  });
});

describe("isWorkingSet", () => {
  it("excludes warmups and drops, case-insensitively", () => {
    expect(isWorkingSet(lift({ setType: "warmup" }))).toBe(false);
    expect(isWorkingSet(lift({ setType: "WarmUp" }))).toBe(false);
    expect(isWorkingSet(lift({ setType: "drop" }))).toBe(false);
    expect(isWorkingSet(lift({ setType: "normal" }))).toBe(true);
    expect(isWorkingSet(lift({ setType: "failure" }))).toBe(true);
  });
});

describe("strengthRecords", () => {
  it("finds the heaviest working set", () => {
    const [record] = strengthRecords([
      lift({ weightLbs: 135 }),
      lift({ weightLbs: 155 }),
      lift({ weightLbs: 145 }),
    ]);
    expect(record.heaviest?.weightLbs).toBe(155);
  });

  it("never lets a warmup become the record", () => {
    const [record] = strengthRecords([
      lift({ weightLbs: 135 }),
      lift({ weightLbs: 500, setType: "warmup" }), // a mistyped warmup entry
    ]);
    expect(record.heaviest?.weightLbs).toBe(135);
    expect(record.workingSets).toBe(1);
  });

  it("keeps the first date a weight was hit, not the latest repeat", () => {
    const [record] = strengthRecords([
      lift({ weightLbs: 155, performedAt: at("2026-08-01") }),
      lift({ weightLbs: 155, performedAt: at("2026-08-15") }),
    ]);
    expect(record.heaviest?.performedAt).toEqual(at("2026-08-01"));
  });

  it("ranks estimated max separately from raw weight", () => {
    // 135x10 estimates higher than 155x1, and both are legitimate answers to different
    // questions, so the record carries each.
    const [record] = strengthRecords([
      lift({ weightLbs: 155, reps: 1 }),
      lift({ weightLbs: 135, reps: 10 }),
    ]);
    expect(record.heaviest?.weightLbs).toBe(155);
    expect(record.bestE1rm?.weightLbs).toBe(135);
  });

  it("tracks a best per rep count", () => {
    const [record] = strengthRecords([
      lift({ weightLbs: 145, reps: 5 }),
      lift({ weightLbs: 155, reps: 5 }),
      lift({ weightLbs: 185, reps: 1 }),
    ]);
    expect(record.byReps).toEqual([
      { reps: 1, weightLbs: 185, performedAt: at("2026-08-01") },
      { reps: 5, weightLbs: 155, performedAt: at("2026-08-01") },
    ]);
  });

  it("separates exercises", () => {
    const records = strengthRecords([lift(), lift({ exercise: "Squat", weightLbs: 225 })]);
    expect(records.map((r) => r.exercise).sort()).toEqual(["Bench Press", "Squat"]);
  });

  it("ignores erg pieces and bodyweight sets", () => {
    expect(strengthRecords([piece()])).toEqual([]);
    expect(strengthRecords([lift({ weightLbs: null })])).toEqual([]);
  });

  it("orders by most recently trained", () => {
    const records = strengthRecords([
      lift({ exercise: "Squat", performedAt: at("2026-08-01") }),
      lift({ exercise: "Bench Press", performedAt: at("2026-08-10") }),
    ]);
    expect(records[0].exercise).toBe("Bench Press");
  });

  it("returns nothing for no input rather than throwing", () => {
    expect(strengthRecords([])).toEqual([]);
  });
});

describe("ergRecords", () => {
  it("ranks by split, so a fast short piece does not beat a fast long one", () => {
    const records = ergRecords([
      piece({ distanceM: 500, durationS: 137 }),
      piece({ distanceM: 5000, durationS: 1130 }),
    ]);
    // Two distances, two separate records — the 500 does not shadow the 5k.
    expect(records).toHaveLength(2);
    expect(records.map((r) => r.distanceM)).toEqual([500, 5000]);
  });

  it("keeps the better split at the same distance", () => {
    const [record] = ergRecords([
      piece({ durationS: 140 }),
      piece({ durationS: 137, performedAt: at("2026-08-20") }),
    ]);
    expect(record.durationS).toBe(137);
    expect(record.performedAt).toEqual(at("2026-08-20"));
  });

  it("buckets near-identical distances together", () => {
    const records = ergRecords([
      piece({ distanceM: 4998, durationS: 1130 }),
      piece({ distanceM: 5000, durationS: 1125 }),
    ]);
    expect(records).toHaveLength(1);
    expect(records[0].durationS).toBe(1125);
  });

  it("computes the 500m split", () => {
    const [record] = ergRecords([piece({ distanceM: 5000, durationS: 1130 })]);
    expect(record.splitPer500S).toBeCloseTo(113, 0);
  });

  it("excludes warmup pieces", () => {
    expect(ergRecords([piece({ setType: "warmup" })])).toEqual([]);
  });

  it("ignores a piece with distance but no time", () => {
    expect(ergRecords([piece({ durationS: null })])).toEqual([]);
  });
});

describe("formatting", () => {
  it("formats a split the way an erg monitor does", () => {
    expect(formatSplit(113)).toBe("1:53.0");
    expect(formatSplit(137)).toBe("2:17.0");
    // The padding bug: 1:05 must not render as 1:5.0
    expect(formatSplit(65)).toBe("1:05.0");
  });

  it("formats elapsed time, with hours only when needed", () => {
    expect(formatDuration(1130)).toBe("18:50");
    expect(formatDuration(3725)).toBe("1:02:05");
    expect(formatDuration(65)).toBe("1:05");
  });

  it("returns a dash rather than NaN for bad input", () => {
    expect(formatSplit(Number.NaN)).toBe("—");
    expect(formatDuration(-1)).toBe("—");
  });
});
