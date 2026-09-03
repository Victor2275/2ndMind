// @vitest-environment node
import { describe, expect, it } from "vitest";

import { allChipSets, chipsFor, chipSetsFor, MAX_CHIPS, type ChipSource } from "@/lib/log/chips";
import { categoryByKey, type Category, type Field } from "@/lib/log/categories";

/**
 * Recent values as one-tap chips.
 *
 * Two things matter here and the rest is presentation. **A chip fills values in the shape the
 * input expects** — a duration stored as 432 seconds has to go back in as `7:12`, because the
 * form re-parses what it finds and `432` would be read as seven minutes twelve on the way out.
 * And **a chip prints what it is about to fill in**, which is the entire justification for
 * letting measurements travel this way when they may not be sticky.
 */

const athletics = categoryByKey("athletics") as Category;
const reading = categoryByKey("reading") as Category;

const exercise = athletics.fields.find((f) => f.name === "exercise") as Field;
const title = reading.fields.find((f) => f.name === "title") as Field;

/**
 * A training entry, in the shape D-159 stores it: the numbers live in the set rows, not on
 * the entry. `sets` is passed through untouched so a test can hand in a malformed one.
 */
const lift = (data: Record<string, unknown>): ChipSource => ({ category: "athletics", data });

/** One exercise with one set — what a chip is built from and what a repeat starts with. */
const oneSet = (exercise: string, set: Record<string, unknown>): ChipSource =>
  lift({ exercise, sets: [set] });

describe("building chips", () => {
  it("offers recent values newest first", () => {
    const chips = chipsFor(athletics, exercise, [
      lift({ exercise: "Squat" }),
      lift({ exercise: "Bench Press" }),
    ]);

    expect(chips.map((c) => c.value)).toEqual(["Squat", "Bench Press"]);
  });

  it("carries last time's numbers, and prints them on the chip", () => {
    // The one that saves the time: tap it and the weight and reps come too, visibly.
    const [chip] = chipsFor(athletics, exercise, [
      oneSet("Bench Press", { weightLbs: 185, reps: 5 }),
    ]);

    expect(chip.label).toBe("Bench Press · 185 × 5");
    // Into the first set's inputs, which are the ones the form actually renders.
    expect(chip.fills).toEqual({
      exercise: "Bench Press",
      "sets.0.weightLbs": "185",
      "sets.0.reps": "5",
    });
  });

  it("fills a duration back in as m:ss, not as seconds", () => {
    // `432` in that field would be re-parsed as 7:12 → 432 on the way in, so it survives one
    // round trip and then silently means something else the moment anyone edits it.
    const [chip] = chipsFor(athletics, exercise, [oneSet("2k", { distance: 2000, duration: 432 })]);

    expect(chip.fills["sets.0.duration"]).toBe("7:12");
    expect(chip.fills["sets.0.distance"]).toBe("2000");
    expect(chip.label).toBe("2k · 2000m · 7:12");
  });

  it("pads the seconds, so 7:05 does not come back as 7:5", () => {
    const [chip] = chipsFor(athletics, exercise, [oneSet("1k", { duration: 425 })]);
    expect(chip.fills["sets.0.duration"]).toBe("7:05");
  });

  it("keeps only the most recent spelling of a repeated value", () => {
    const chips = chipsFor(athletics, exercise, [
      oneSet("Bench Press", { weightLbs: 190 }),
      oneSet("bench press", { weightLbs: 185 }),
    ]);

    expect(chips).toHaveLength(1);
    expect(chips[0].value).toBe("Bench Press");
    // And the numbers come from the entry the chip came from, not from an older one.
    expect(chips[0].fills["sets.0.weightLbs"]).toBe("190");
  });

  it("leaves out a carried field the entry did not have", () => {
    const [chip] = chipsFor(athletics, exercise, [oneSet("Row", { reps: 8 })]);

    expect(chip.fills).toEqual({ exercise: "Row", "sets.0.reps": "8" });
    expect(chip.label).toBe("Row · 8");
  });

  it("carries nothing from an entry with no sets, rather than throwing", () => {
    // `data` is JSON out of a column. A chip that crashed the log page on one malformed row
    // would take the whole form with it.
    for (const broken of [{}, { sets: "nope" }, { sets: [] }, { sets: [null] }]) {
      const [chip] = chipsFor(athletics, exercise, [lift({ exercise: "Row", ...broken })]);
      expect(chip.fills).toEqual({ exercise: "Row" });
      expect(chip.label).toBe("Row");
    }
  });

  it("stops at the row that fits on a phone", () => {
    const many = Array.from({ length: 20 }, (_, i) => lift({ exercise: `Lift ${i}` }));
    expect(chipsFor(athletics, exercise, many)).toHaveLength(MAX_CHIPS);
  });

  it("ignores entries from other categories", () => {
    const chips = chipsFor(athletics, exercise, [
      { category: "reading", data: { exercise: "not a lift" } },
      lift({ exercise: "Squat" }),
    ]);

    expect(chips.map((c) => c.value)).toEqual(["Squat"]);
  });

  it("ignores blank and non-string values", () => {
    const chips = chipsFor(athletics, exercise, [
      lift({ exercise: "  " }),
      lift({ exercise: 42 }),
      lift({}),
      lift({ exercise: "Squat" }),
    ]);

    expect(chips.map((c) => c.value)).toEqual(["Squat"]);
  });

  it("trims what it stores, so a stray space is not a second chip", () => {
    const chips = chipsFor(athletics, exercise, [
      lift({ exercise: " Squat " }),
      lift({ exercise: "Squat" }),
    ]);

    expect(chips).toHaveLength(1);
    expect(chips[0].fills.exercise).toBe("Squat");
  });
});

describe("per category", () => {
  it("builds a set for every field that asked for chips", () => {
    const sets = chipSetsFor(reading, [
      { category: "reading", data: { title: "Thinking in Systems", kind: "book" } },
    ]);

    expect(Object.keys(sets)).toEqual(["title"]);
    expect(sets.title[0].fills).toEqual({ title: "Thinking in Systems", kind: "book" });
  });

  it("carries a select's value, so a book logged twice keeps its kind", () => {
    const [chip] = chipsFor(reading, title, [
      { category: "reading", data: { title: "Thinking in Systems", kind: "book" } },
    ]);

    expect(chip.fills).toEqual({ title: "Thinking in Systems", kind: "book" });
  });

  it("omits a field with nothing to offer, rather than rendering an empty row", () => {
    expect(chipSetsFor(reading, [{ category: "reading", data: { kind: "book" } }])).toEqual({});
  });

  it("splits a mixed history by category in one pass", () => {
    const sets = allChipSets([
      lift({ exercise: "Squat" }),
      { category: "reading", data: { title: "Thinking in Systems" } },
      { category: "day", data: { mood: 4 } },
    ]);

    expect(Object.keys(sets).sort()).toEqual(["athletics", "reading"]);
    expect(sets.athletics.exercise[0].value).toBe("Squat");
  });

  it("ignores a category this build no longer has", () => {
    expect(allChipSets([{ category: "retired", data: { who: "someone" } }])).toEqual({});
  });
});

describe("the label", () => {
  it("uses × only for the weight-and-reps pair", () => {
    // "185 × 5" reads as a set. Anything else joined with × would read as a multiplication
    // that means nothing.
    const [book] = chipsFor(reading, title, [
      { category: "reading", data: { title: "Thinking in Systems", kind: "book" } },
    ]);
    expect(book.label).toBe("Thinking in Systems · book");

    // The bug this replaced a passing test to catch: keying the × off the *declared* carries
    // rendered an erg piece as "2000m × 7:12", which is not a multiplication of anything.
    const [erg] = chipsFor(athletics, exercise, [oneSet("2k", { distance: 2000, duration: 432 })]);
    expect(erg.label).toBe("2k · 2000m · 7:12");
  });

  it("is just the value when there is nothing to carry", () => {
    const chips = chipsFor(athletics, exercise, [lift({ exercise: "Squat" })]);
    expect(chips[0].label).toBe("Squat");
  });
});
