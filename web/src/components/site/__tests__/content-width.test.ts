import { describe, expect, it } from "vitest";

import { widthFor } from "@/components/site/content-width";

/**
 * Which column each private screen gets (V4 §4.1, Q149/Q363).
 *
 * The table is one decision in one place, and the only thing that can go wrong with it is
 * prefix matching — which is not hypothetical here: `/private/athletics` and
 * `/private/athletics/exercises` are both in the table, and source order decided the winner
 * until `widthFor` was written to take the longest match.
 */

describe("widthFor", () => {
  it("defaults to content, which is what every private page had before §4.1", () => {
    expect(widthFor("/private")).toBe("content");
    expect(widthFor("/private/log")).toBe("content");
    expect(widthFor("/private/settings")).toBe("content");
  });

  it("widens the boards and the two-column screens", () => {
    expect(widthFor("/private/academics")).toBe("wide");
    expect(widthFor("/private/work")).toBe("wide");
    expect(widthFor("/private/calendar")).toBe("wide");
  });

  it("gives the one document screen a reading column", () => {
    expect(widthFor("/private/now")).toBe("prose");
  });

  it("takes the longest matching prefix, not the first one listed", () => {
    // Both `/private/athletics` and `/private/athletics/exercises` are in the table. They
    // happen to agree today, which is exactly why this is asserted: the day they disagree,
    // source order would decide it silently.
    expect(widthFor("/private/athletics/exercises/bench-press")).toBe("wide");
    expect(widthFor("/private/athletics")).toBe("wide");
  });

  it("does not match a prefix that is only a string prefix", () => {
    // `/private/workshop` is not `/private/work`. The same trap `hasPublicChrome` was written
    // to avoid for `/privateer` (D-174).
    expect(widthFor("/private/workshop")).toBe("content");
  });
});
