import { describe, expect, it } from "vitest";

import { parseDistanceToMetres, parseTimeToSeconds, readSetsFromForm } from "../forms";

describe("parseTimeToSeconds", () => {
  it("reads the m:ss an erg monitor displays", () => {
    expect(parseTimeToSeconds("2:17")).toBe(137);
    expect(parseTimeToSeconds("18:50")).toBe(1130);
  });

  it("reads h:mm:ss", () => {
    expect(parseTimeToSeconds("1:02:05")).toBe(3725);
  });

  it("reads bare seconds", () => {
    expect(parseTimeToSeconds("137")).toBe(137);
  });

  it("keeps tenths, rounded to the second", () => {
    expect(parseTimeToSeconds("2:17.4")).toBe(137);
    expect(parseTimeToSeconds("2:17.6")).toBe(138);
  });

  it("rejects junk instead of storing zero", () => {
    // Number("1a") is NaN; a laxer parse would store 0 and silently invent a PR.
    expect(parseTimeToSeconds("2:1a")).toBeNull();
    expect(parseTimeToSeconds("abc")).toBeNull();
    expect(parseTimeToSeconds("1:2:3:4")).toBeNull();
  });

  it("treats blank as absent", () => {
    expect(parseTimeToSeconds("")).toBeNull();
    expect(parseTimeToSeconds("   ")).toBeNull();
  });

  it("rejects zero, which is not a time anyone rowed", () => {
    expect(parseTimeToSeconds("0")).toBeNull();
  });
});

describe("parseDistanceToMetres", () => {
  it("passes metres through", () => {
    expect(parseDistanceToMetres("500", "m")).toBe(500);
  });

  it("converts km and miles", () => {
    expect(parseDistanceToMetres("5", "km")).toBe(5000);
    expect(parseDistanceToMetres("1", "mi")).toBeCloseTo(1609.34, 1);
  });

  it("rejects blank, zero, and junk", () => {
    expect(parseDistanceToMetres("", "m")).toBeNull();
    expect(parseDistanceToMetres("0", "m")).toBeNull();
    expect(parseDistanceToMetres("far", "m")).toBeNull();
  });
});

function form(rows: Record<string, string>[]): FormData {
  const data = new FormData();
  for (const row of rows) {
    // Every row must append to every key, or the parallel arrays fall out of alignment and
    // one row's weight lands on another row's exercise.
    for (const key of ["exercise", "weight", "reps", "distance", "distanceUnit", "duration", "spm", "setType"]) {
      data.append(key, row[key] ?? "");
    }
  }
  return data;
}

describe("readSetsFromForm", () => {
  it("reads a lift", () => {
    const sets = readSetsFromForm(
      form([{ exercise: "Bench Press", weight: "145", reps: "5", setType: "normal" }]),
    );
    expect(sets).toEqual([
      {
        exercise: "Bench Press",
        weightLbs: 145,
        reps: 5,
        distanceM: null,
        durationS: null,
        spm: null,
        setType: "normal",
      },
    ]);
  });

  it("reads an erg piece", () => {
    const [set] = readSetsFromForm(
      form([
        {
          exercise: "Row (Erg)",
          distance: "5",
          distanceUnit: "km",
          duration: "18:50",
          setType: "normal",
        },
      ]),
    );
    expect(set.distanceM).toBe(5000);
    expect(set.durationS).toBe(1130);
    expect(set.weightLbs).toBeNull();
  });

  it("reads a stroke rate, which is what the vault SPM targets are checked against", () => {
    const [set] = readSetsFromForm(
      form([{ exercise: "Row (Erg)", distance: "500", duration: "2:17", spm: "74" }]),
    );
    expect(set.spm).toBe(74);
  });

  it("leaves the stroke rate null when the field is blank", () => {
    const [set] = readSetsFromForm(form([{ exercise: "Squat", weight: "225", reps: "3" }]));
    expect(set.spm).toBeNull();
  });

  it("drops blank rows, so spare rows cost nothing", () => {
    const sets = readSetsFromForm(
      form([
        { exercise: "Squat", weight: "225", reps: "3" },
        {},
        {},
      ]),
    );
    expect(sets).toHaveLength(1);
    expect(sets[0].exercise).toBe("Squat");
  });

  it("keeps rows aligned when an earlier row is blank", () => {
    // The alignment bug: skipping a blank row without indexing by position would shift
    // every later row's numbers onto the wrong exercise.
    const sets = readSetsFromForm(
      form([
        {},
        { exercise: "Deadlift", weight: "315", reps: "1" },
      ]),
    );
    expect(sets).toEqual([
      {
        exercise: "Deadlift",
        weightLbs: 315,
        reps: 1,
        distanceM: null,
        durationS: null,
        spm: null,
        setType: "normal",
      },
    ]);
  });

  it("defaults a missing set type rather than storing an empty string", () => {
    const [set] = readSetsFromForm(form([{ exercise: "Row", weight: "100", reps: "5" }]));
    expect(set.setType).toBe("normal");
  });

  it("preserves a warmup marking", () => {
    const [set] = readSetsFromForm(
      form([{ exercise: "Bench Press", weight: "95", reps: "8", setType: "warmup" }]),
    );
    expect(set.setType).toBe("warmup");
  });

  it("returns nothing for an empty form", () => {
    expect(readSetsFromForm(new FormData())).toEqual([]);
  });
});
