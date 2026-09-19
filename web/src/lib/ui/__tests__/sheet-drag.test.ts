import { describe, expect, it } from "vitest";

import { FLICK_VELOCITY, settle, Velocity } from "@/lib/ui/sheet-drag";

/**
 * Where a dragged sheet lands (V4 §4.3, Q172).
 *
 * The interaction is entirely this function, which is why it is a function: every case below
 * is a gesture someone actually makes, and none of them needs a browser to state.
 */

const HEIGHT = 400;

describe("settle", () => {
  it("leaves a tap that wobbled exactly where it was", () => {
    // Fingers are not still. A few pixels with no speed behind them is a tap on the grabber,
    // and a sheet that changes height when you touch it is a sheet that feels broken.
    expect(settle({ dy: 4, velocity: 0.02, height: HEIGHT, from: "partial" })).toBe("partial");
    expect(settle({ dy: -5, velocity: -0.01, height: HEIGHT, from: "full" })).toBe("full");
  });

  it("ignores a slow drag that did not go far enough", () => {
    // A quarter of the sheet. Below that the gesture is ambiguous, and the safe reading of an
    // ambiguous gesture is "nothing".
    expect(settle({ dy: 60, velocity: 0.1, height: HEIGHT, from: "partial" })).toBe("partial");
  });

  it("dismisses a partial sheet dragged well down", () => {
    expect(settle({ dy: 150, velocity: 0.1, height: HEIGHT, from: "partial" })).toBe("closed");
  });

  it("steps a full sheet down to partial rather than closing it", () => {
    // The one case worth stating twice: from `full`, a downward gesture shrinks. A sheet that
    // vanishes when you meant to make it smaller has thrown away whatever you were about to
    // tap, and the only way back is to reopen it and find your place again.
    expect(settle({ dy: 150, velocity: 0.1, height: HEIGHT, from: "full" })).toBe("partial");
  });

  it("opens fully on a drag up", () => {
    expect(settle({ dy: -150, velocity: -0.1, height: HEIGHT, from: "partial" })).toBe("full");
  });

  it("takes a flick over a distance, in both directions", () => {
    // The gesture people actually make to dismiss a sheet is short and fast. Requiring a
    // quarter of the sheet's height would reject exactly that.
    expect(settle({ dy: 20, velocity: FLICK_VELOCITY, height: HEIGHT, from: "partial" })).toBe(
      "closed",
    );
    expect(settle({ dy: -20, velocity: -FLICK_VELOCITY, height: HEIGHT, from: "partial" })).toBe(
      "full",
    );
  });

  it("scales with the sheet, not with a fixed number of pixels", () => {
    // 90px is well past a quarter of a short sheet and well short of a quarter of a tall one.
    expect(settle({ dy: 90, velocity: 0.1, height: 200, from: "partial" })).toBe("closed");
    expect(settle({ dy: 90, velocity: 0.1, height: 800, from: "partial" })).toBe("partial");
  });
});

describe("Velocity", () => {
  it("measures over a window rather than between the last two events", () => {
    // Two pointer moves can arrive a fraction of a millisecond apart. Measured between just
    // those two, any drag is a flick, and `FLICK_VELOCITY` stops meaning anything.
    const v = new Velocity();
    v.push(0, 0);
    v.push(30, 60);
    v.push(31, 60.2);

    // 31px over 60.2ms ≈ 0.51, not the 5px/ms the last pair alone would suggest.
    expect(v.get()).toBeCloseTo(31 / 60.2, 3);
  });

  it("reports nothing when there is nothing to measure", () => {
    const v = new Velocity();
    expect(v.get()).toBe(0);
    v.push(10, 5);
    expect(v.get()).toBe(0);
  });

  it("is signed, because direction is the whole question", () => {
    const v = new Velocity();
    v.push(100, 0);
    v.push(40, 50);
    expect(v.get()).toBeLessThan(0);
  });

  it("drops samples older than the window", () => {
    const v = new Velocity(80);
    v.push(0, 0);
    v.push(10, 200);
    v.push(20, 240);
    // The sample at t=0 is long gone, so this is 10px over 40ms rather than 20 over 240.
    expect(v.get()).toBeCloseTo(0.25, 3);
  });
});
