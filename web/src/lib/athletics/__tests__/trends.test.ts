import { describe, expect, it } from "vitest";

import type { BodyweightReading } from "../adjusted";
import type { PlannedDay, SpmTarget } from "../protocol";
import type { Effort } from "../prs";
import {
  bodyweightSeries,
  chartableDistances,
  chartableLifts,
  e1rmSeries,
  flagSpm,
  isoDay,
  shiftDay,
  splitSeries,
  weeklyVolume,
  weekReview,
  weekStartOf,
} from "../trends";

/** 18:00 UTC is 11:00 in Los Angeles — the same calendar day in both, so a fixture date
 *  reads the way it looks. The 07:00 cases below are the ones that differ. */
const at = (iso: string, time = "18:00:00") => new Date(`${iso}T${time}Z`);

function effort(over: Partial<Effort> = {}): Effort {
  return {
    exercise: "Bench Press",
    performedAt: at("2026-08-03"),
    setType: "normal",
    weightLbs: 145,
    reps: 5,
    distanceM: null,
    durationS: null,
    spm: null,
    ...over,
  };
}

function piece(over: Partial<Effort> = {}): Effort {
  return effort({
    exercise: "Row (Erg)",
    weightLbs: null,
    reps: null,
    distanceM: 500,
    durationS: 137,
    ...over,
  });
}

describe("isoDay", () => {
  it("uses the Los Angeles day, not UTC", () => {
    // 02:00 UTC on the 4th is 19:00 on the 3rd in California — an evening session must not
    // be filed under tomorrow.
    expect(isoDay(at("2026-08-04", "02:00:00"))).toBe("2026-08-03");
  });

  it("handles a winter date, when Los Angeles is on standard time", () => {
    // The rest of this codebase hard-codes a 420-minute offset, which is only correct in
    // summer. This path goes through Intl, so it stays right in December.
    expect(isoDay(at("2026-12-04", "02:00:00"))).toBe("2026-12-03");
    expect(isoDay(at("2026-12-04", "09:00:00"))).toBe("2026-12-04");
  });
});

describe("shiftDay and weekStartOf", () => {
  it("moves whole days in both directions", () => {
    expect(shiftDay("2026-08-22", 1)).toBe("2026-08-23");
    expect(shiftDay("2026-08-22", -7)).toBe("2026-08-15");
    expect(shiftDay("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("finds the Monday of the week", () => {
    expect(weekStartOf("2026-08-22")).toBe("2026-08-17"); // a Saturday
    expect(weekStartOf("2026-08-17")).toBe("2026-08-17"); // the Monday itself
    expect(weekStartOf("2026-08-23")).toBe("2026-08-17"); // Sunday belongs to the week before
  });
});

describe("bodyweightSeries", () => {
  it("sorts oldest first regardless of input order", () => {
    const readings: BodyweightReading[] = [
      { measuredOn: "2026-08-03", weightLbs: 215 },
      { measuredOn: "2026-08-01", weightLbs: 213 },
    ];
    expect(bodyweightSeries(readings).map((p) => p.day)).toEqual([
      "2026-08-01",
      "2026-08-03",
    ]);
  });
});

describe("e1rmSeries", () => {
  it("takes the best set of each day, not a running maximum", () => {
    const points = e1rmSeries(
      [
        effort({ performedAt: at("2026-08-01"), weightLbs: 145, reps: 5 }),
        effort({ performedAt: at("2026-08-01"), weightLbs: 135, reps: 5 }),
        // A lighter day after a heavy one must show as a dip; a running max would flatten it.
        effort({ performedAt: at("2026-08-08"), weightLbs: 125, reps: 5 }),
      ],
      "Bench Press",
    );

    expect(points.map((p) => p.day)).toEqual(["2026-08-01", "2026-08-08"]);
    expect(points[0].value).toBeGreaterThan(points[1].value);
  });

  it("ignores warmups", () => {
    const points = e1rmSeries(
      [
        effort({ weightLbs: 95, reps: 5, setType: "warmup" }),
        effort({ weightLbs: 145, reps: 5 }),
      ],
      "Bench Press",
    );
    expect(points).toHaveLength(1);
    expect(points[0].value).toBe(169.2);
  });

  it("ignores other exercises", () => {
    expect(e1rmSeries([effort()], "Squat")).toEqual([]);
  });
});

describe("chartableLifts", () => {
  it("needs several separate days, not several sets on one day", () => {
    const sameDay = [effort(), effort(), effort(), effort()];
    expect(chartableLifts(sameDay)).toEqual([]);

    const spread = ["2026-08-01", "2026-08-03", "2026-08-05"].map((day) =>
      effort({ performedAt: at(day) }),
    );
    expect(chartableLifts(spread)).toEqual(["Bench Press"]);
  });
});

describe("splitSeries", () => {
  const readings: BodyweightReading[] = [{ measuredOn: "2026-08-01", weightLbs: 215 }];

  it("keeps the best split of each day and adjusts it", () => {
    const points = splitSeries(
      [
        piece({ performedAt: at("2026-08-03"), durationS: 140 }),
        piece({ performedAt: at("2026-08-03"), durationS: 137 }),
      ],
      500,
      readings,
    );

    expect(points).toHaveLength(1);
    expect(points[0].value).toBeCloseTo(137, 6);
    expect(points[0].adjusted).toBeCloseTo(130.2444, 3);
  });

  it("accepts a piece within tolerance of the nominal distance", () => {
    const points = splitSeries([piece({ distanceM: 1980, durationS: 500 })], 2000, readings);
    expect(points).toHaveLength(1);
  });

  it("rejects one outside it", () => {
    const points = splitSeries([piece({ distanceM: 500, durationS: 137 })], 2000, readings);
    expect(points).toHaveLength(0);
  });

  it("leaves adjusted null when no weight is on record", () => {
    const points = splitSeries([piece()], 500, []);
    expect(points[0].adjusted).toBeNull();
  });
});

describe("chartableDistances", () => {
  it("buckets to 100 m so a 4,998 m piece joins the 5 k", () => {
    const days = ["2026-08-01", "2026-08-03", "2026-08-05"];
    const efforts = days.map((day, i) =>
      piece({ performedAt: at(day), distanceM: 4998 + i, durationS: 1130 }),
    );
    expect(chartableDistances(efforts)).toEqual([5000]);
  });
});

describe("weeklyVolume", () => {
  it("includes warmup sets, which is what Victor asked for", () => {
    const volume = weeklyVolume([
      effort({ weightLbs: 100, reps: 10, setType: "warmup" }),
      effort({ weightLbs: 200, reps: 5 }),
    ]);
    // 1,000 from the warmup plus 1,000 from the working set. Excluding warmups would halve it.
    expect(volume[0].volumeLbs).toBe(2000);
  });

  it("counts distinct days as sessions, not sets", () => {
    const volume = weeklyVolume([
      effort({ performedAt: at("2026-08-03") }),
      effort({ performedAt: at("2026-08-03") }),
      effort({ performedAt: at("2026-08-05") }),
    ]);
    expect(volume).toHaveLength(1);
    expect(volume[0].sessions).toBe(2);
    expect(volume[0].weekStart).toBe("2026-08-03");
  });

  it("sums erg metres separately from pounds", () => {
    const volume = weeklyVolume([piece({ distanceM: 2000, durationS: 480 })]);
    expect(volume[0].metres).toBe(2000);
    expect(volume[0].volumeLbs).toBe(0);
  });

  it("keeps only the most recent weeks", () => {
    const efforts = Array.from({ length: 20 }, (_, i) =>
      effort({ performedAt: at(shiftDay("2026-01-05", i * 7)) }),
    );
    expect(weeklyVolume(efforts, 4)).toHaveLength(4);
  });
});

describe("flagSpm", () => {
  const targets: SpmTarget[] = [
    { label: "200m Sprints", distanceM: 200, minSpm: 80, maxSpm: 85, intent: "" },
    { label: "500m Race Pace", distanceM: 500, minSpm: 72, maxSpm: 76, intent: "" },
    { label: "2000m Head Race", distanceM: 2000, minSpm: 62, maxSpm: 66, intent: "" },
  ];

  it("matches a piece to the target for its own distance", () => {
    const [flag] = flagSpm([piece({ distanceM: 500, spm: 74 })], targets);
    expect(flag.target.distanceM).toBe(500);
    expect(flag.status).toBe("in range");
  });

  it("flags a rate below the band", () => {
    const [flag] = flagSpm([piece({ distanceM: 500, spm: 68 })], targets);
    expect(flag.status).toBe("under");
  });

  it("flags a rate above the band, because that means a short stroke", () => {
    const [flag] = flagSpm([piece({ distanceM: 2000, durationS: 480, spm: 74 })], targets);
    expect(flag.target.distanceM).toBe(2000);
    expect(flag.status).toBe("over");
  });

  it("picks the nearest target on a ratio scale", () => {
    // 1,000 m is numerically closer to 2,000 than to 500, but on a ratio scale it is exactly
    // between them and the 2 k target is the right call for a piece of that length.
    const [flag] = flagSpm([piece({ distanceM: 1000, durationS: 240, spm: 70 })], targets);
    expect([500, 2000]).toContain(flag.target.distanceM);
    // 300 m, however, must go to the 200 m target rather than the 500.
    const [sprint] = flagSpm([piece({ distanceM: 300, durationS: 70, spm: 82 })], targets);
    expect(sprint.target.distanceM).toBe(200);
  });

  it("skips pieces without a stroke rate", () => {
    expect(flagSpm([piece({ spm: null })], targets)).toEqual([]);
  });

  it("returns nothing when the vault has no targets", () => {
    expect(flagSpm([piece({ spm: 74 })], [])).toEqual([]);
  });

  it("skips warmups", () => {
    expect(flagSpm([piece({ spm: 60, setType: "warmup" })], targets)).toEqual([]);
  });
});

describe("weekReview", () => {
  const plan: PlannedDay[] = [
    { weekday: 1, name: "Monday", items: ["Solo PERG", "Lower Body"] },
    { weekday: 2, name: "Tuesday", items: ["Team Land Practice"] },
    { weekday: 3, name: "Wednesday", items: [] },
  ];

  // Week of Monday 2026-08-17, viewed on the Wednesday.
  const days = weekReview(plan, ["2026-08-17"], "2026-08-17", "2026-08-19");

  it("returns the whole week starting on Monday", () => {
    expect(days).toHaveLength(7);
    expect(days[0].day).toBe("2026-08-17");
    expect(days[6].day).toBe("2026-08-23");
  });

  it("marks a day with a logged session", () => {
    expect(days[0].logged).toBe(1);
    expect(days[0].missed).toBe(false);
  });

  it("marks a past planned day with nothing logged as missed", () => {
    expect(days[1].name).toBe("Tuesday");
    expect(days[1].missed).toBe(true);
  });

  it("never marks a future day as missed", () => {
    const future = days.filter((d) => d.isFuture);
    expect(future.length).toBeGreaterThan(0);
    expect(future.every((d) => !d.missed)).toBe(true);
  });

  it("does not call a day with no planned work missed", () => {
    expect(days[2].name).toBe("Wednesday");
    expect(days[2].planned).toEqual([]);
    expect(days[2].missed).toBe(false);
  });

  it("marks today", () => {
    expect(days.filter((d) => d.isToday)).toHaveLength(1);
    expect(days[2].isToday).toBe(true);
  });

  it("still names every day when the vault has no plan", () => {
    const bare = weekReview([], [], "2026-08-17", "2026-08-19");
    expect(bare.map((d) => d.name)).toEqual([
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ]);
    expect(bare.every((d) => !d.missed)).toBe(true);
  });
});
