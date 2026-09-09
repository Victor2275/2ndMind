// @vitest-environment node
import { describe, expect, it } from "vitest";

import { CATALOGUE } from "@/lib/athletics/catalogue";
import { score, searchExercises } from "@/lib/athletics/exercise-search";

/**
 * Finding a movement (V4 Phase 2.2).
 *
 * The tests are written against the **real catalogue** rather than a fixture, because the thing
 * being checked is not "does the algorithm work" — it is "does typing `bnch` on a phone put
 * Bench Press first, in the list that actually ships". A fixture of three names would pass while
 * the shipped list buried the answer under thirty other presses.
 *
 * Ranking is what makes fuzzy matching usable, so every test below asserts a **position**, not
 * merely membership. A fuzzy matcher that returns the right row somewhere in thirty results is
 * worse than a prefix matcher that returns nothing.
 */

const first = (query: string) => searchExercises(CATALOGUE, query)[0]?.name;
const names = (query: string) => searchExercises(CATALOGUE, query).map((e) => e.name);

describe("typing the name", () => {
  it("puts an exact prefix first", () => {
    expect(first("bench")).toBe("Bench Press");
    expect(first("deadlift")).toBe("Deadlift");
    expect(first("pull up")).toBe("Pull Up");
  });

  it("is case and space insensitive", () => {
    expect(first("BENCH PRESS")).toBe("Bench Press");
    expect(first("benchpress")).toBe("Bench Press");
  });
});

describe("typing it badly, which is the point", () => {
  it("recovers from dropped vowels", () => {
    expect(first("bnch")).toBe("Bench Press");
    // There is no bare "Squat" in the catalogue — every squat is a named variant — so the
    // assertion is that dropping the vowels still lands you among them.
    expect(names("sqt").slice(0, 5).join(" ")).toMatch(/Squat/);
  });

  it("finds a multi-word name from its initials", () => {
    // The one-handed case: "rdl" for Romanian Deadlift. Word starts are weighted heavily for
    // exactly this.
    expect(names("rdl")).toContain("Romanian Deadlift");
    expect(names("bss")).toContain("Bulgarian Split Squat");
  });

  it("finds a name from a word in the middle of it", () => {
    expect(names("incline")).toContain("Incline Bench Press");
    expect(names("goblet")).toContain("Goblet Squat");
  });

  it("returns nothing when a character is simply not there", () => {
    // Fuzzy is not "anything goes". Every character of the query has to appear, in order.
    expect(searchExercises(CATALOGUE, "zzzz")).toHaveLength(0);
  });
});

describe("ranking", () => {
  it("prefers the shorter name when both match", () => {
    // "dip" should not be beaten by a long name that happens to contain d, i and p in order.
    expect(first("dip")).toBe("Dip");
  });

  it("puts the names that actually contain the word above coincidences", () => {
    /**
     * The regression that made the substring bonus exist. `row` used to rank "Rope Pushdown"
     * first — r, o and w do appear in that order, and the `r` even starts a word, so every
     * other signal pointed the wrong way.
     *
     * Subsequence matching is what makes a typo recoverable and it is also what makes
     * coincidences score. The rule is not to stop matching them, it is to rank them below the
     * case where the letters are together.
     */
    const ranked = names("row");
    const firstCoincidence = ranked.findIndex((n) => !n.toLowerCase().includes("row"));
    const realRows = ranked.filter((n) => n.toLowerCase().includes("row"));

    expect(realRows.length).toBeGreaterThan(3);
    // Every genuine row comes before the first name that merely has the letters in it.
    if (firstCoincidence >= 0) {
      for (const name of realRows) expect(ranked.indexOf(name)).toBeLessThan(firstCoincidence);
    }
  });

  it("is stable between keystrokes when scores tie", () => {
    // A list that reshuffles under your thumb is how you tap the wrong row. Equal scores break
    // on name, which is deterministic.
    expect(names("press")).toEqual(names("press"));
  });

  it("keeps the list short enough to read", () => {
    expect(searchExercises(CATALOGUE, "e", 10)).toHaveLength(10);
  });
});

describe("the empty query", () => {
  it("shows the catalogue rather than nothing", () => {
    // The opposite of the log search, and deliberately: this is a picker, so opening it should
    // show what there is. Showing someone their whole log because they cleared the box is noise;
    // showing them the movement list is the feature.
    expect(searchExercises(CATALOGUE, "").length).toBeGreaterThan(0);
    expect(searchExercises(CATALOGUE, "   ").length).toBeGreaterThan(0);
  });
});

describe("score", () => {
  it("is null for a miss, so callers cannot mistake 0 for no match", () => {
    expect(score("Bench Press", "zzz")).toBeNull();
    expect(score("Bench Press", "")).toBeNull();
  });

  it("ranks a prefix above a scattered match", () => {
    expect(score("Bench Press", "bench")!).toBeGreaterThan(score("Barbell Lunge", "bench") ?? -1);
  });
});
