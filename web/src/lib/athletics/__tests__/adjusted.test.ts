import { describe, expect, it } from "vitest";

import {
  REFERENCE_WEIGHT_LBS,
  adjustSeconds,
  goalProgress,
  rawSplitForAdjustedTarget,
  weightAdjustmentFactor,
  weightOn,
  type BodyweightReading,
} from "../adjusted";

const readings: BodyweightReading[] = [
  { measuredOn: "2026-06-01", weightLbs: 210 },
  { measuredOn: "2026-07-01", weightLbs: 213 },
  { measuredOn: "2026-08-01", weightLbs: 215 },
];

describe("weightAdjustmentFactor", () => {
  it("is exactly 1 at the reference weight", () => {
    expect(weightAdjustmentFactor(REFERENCE_WEIGHT_LBS)).toBeCloseTo(1, 12);
  });

  it("matches Concept2's published factor", () => {
    // (215/270)^0.222 — the number the site prints next to the goal, so it is pinned.
    expect(weightAdjustmentFactor(215)).toBeCloseTo(0.9506892, 7);
  });

  it("discounts a lighter athlete more than a heavier one", () => {
    const light = weightAdjustmentFactor(150)!;
    const heavy = weightAdjustmentFactor(250)!;
    expect(light).toBeLessThan(heavy);
  });

  it("penalises weight gain — the direction that matters for the vault's goal", () => {
    // Same raw split, ten pounds heavier, is a *worse* adjusted split. If this ever inverts,
    // the site would be telling Victor that eating more is progress toward a sub-2:00.
    const before = adjustSeconds(137, 215)!;
    const after = adjustSeconds(137, 225)!;
    expect(after).toBeGreaterThan(before);
  });

  it("rejects nonsense rather than returning NaN", () => {
    expect(weightAdjustmentFactor(0)).toBeNull();
    expect(weightAdjustmentFactor(-5)).toBeNull();
    expect(weightAdjustmentFactor(Number.NaN)).toBeNull();
  });
});

describe("adjustSeconds", () => {
  it("shortens a 2:17 500m to about 2:10 at 215 lb", () => {
    expect(adjustSeconds(137, 215)).toBeCloseTo(130.2444, 4);
  });

  it("returns null for a non-time", () => {
    expect(adjustSeconds(0, 215)).toBeNull();
    expect(adjustSeconds(-1, 215)).toBeNull();
  });
});

describe("rawSplitForAdjustedTarget", () => {
  it("inverts the adjustment", () => {
    const required = rawSplitForAdjustedTarget(120, 215)!;
    expect(required).toBeCloseTo(126.2242, 4);
    expect(adjustSeconds(required, 215)).toBeCloseTo(120, 6);
  });

  it("is the identity at the reference weight", () => {
    expect(rawSplitForAdjustedTarget(120, REFERENCE_WEIGHT_LBS)).toBeCloseTo(120, 9);
  });
});

describe("weightOn", () => {
  it("takes the most recent reading on or before the day", () => {
    expect(weightOn(readings, "2026-07-15")).toBe(213);
    expect(weightOn(readings, "2026-08-01")).toBe(215);
    expect(weightOn(readings, "2026-12-25")).toBe(215);
  });

  it("falls back forward for a piece older than every reading", () => {
    expect(weightOn(readings, "2026-01-01")).toBe(210);
  });

  it("is null with nothing recorded", () => {
    expect(weightOn([], "2026-08-01")).toBeNull();
  });

  it("does not depend on the input order", () => {
    const shuffled = [readings[2], readings[0], readings[1]];
    expect(weightOn(shuffled, "2026-07-15")).toBe(213);
  });
});

describe("goalProgress", () => {
  it("reports the gap still to find", () => {
    const progress = goalProgress({ targetAdjustedS: 120, bodyweightLbs: 215, bestRawS: 137 })!;
    expect(progress.requiredRawS).toBeCloseTo(126.2242, 4);
    expect(progress.bestAdjustedS).toBeCloseTo(130.2444, 4);
    expect(progress.gapS).toBeCloseTo(10.2444, 4);
  });

  it("goes negative once the goal is beaten", () => {
    const progress = goalProgress({ targetAdjustedS: 120, bodyweightLbs: 215, bestRawS: 120 })!;
    expect(progress.gapS).toBeLessThan(0);
  });

  it("keeps the required raw split even with no piece logged", () => {
    const progress = goalProgress({ targetAdjustedS: 120, bodyweightLbs: 215, bestRawS: null })!;
    expect(progress.requiredRawS).toBeCloseTo(126.2242, 4);
    expect(progress.bestAdjustedS).toBeNull();
    expect(progress.gapS).toBeNull();
  });

  it("returns null rather than a confident zero when the weight is unusable", () => {
    expect(goalProgress({ targetAdjustedS: 120, bodyweightLbs: 0, bestRawS: 137 })).toBeNull();
  });
});
