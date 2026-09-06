import { describe, expect, it } from "vitest";

import { parseSpoken } from "@/lib/voice/parse";

/**
 * §4.3's grammar. What is asserted here is not that it parses — it is **where it gives up**.
 *
 * The whole argument for rules ahead of a model is that a grammar is wrong the same way every
 * time, so you learn it once and phrase around it. That only holds if the failures are known
 * and stated, which is what the second half of this file is.
 */

describe("lifting", () => {
  it("reads the sentence Victor actually says", () => {
    expect(parseSpoken("bench press 185 for 5")).toEqual({
      kind: "lift",
      exercise: "Bench Press",
      rpe: null,
      sets: [{ weightLbs: 185, reps: 5 }],
    });
  });

  it("takes the joining word several ways, because recognition renders it several ways", () => {
    for (const said of [
      "squat 225 for 3",
      "squat 225 by 3",
      "squat 225 x 3",
      "squat 225 times 3",
    ]) {
      expect(parseSpoken(said)?.sets, said).toEqual([{ weightLbs: 225, reps: 3 }]);
    }
  });

  it("reads an RPE without mistaking it for reps", () => {
    // The failure this prevents: "rpe 8" is a perfectly good candidate for a rep count, so it
    // has to be taken out of the sentence before anything else reads a number.
    const parsed = parseSpoken("bench press 185 for 5 rpe 8");
    expect(parsed?.rpe).toBe(8);
    expect(parsed?.sets).toEqual([{ weightLbs: 185, reps: 5 }]);
  });

  it("repeats the set when a count is given, in digits or in words", () => {
    // "three sets" is the single most common phrase in a lifting session and recognition
    // renders small counts as words far more often than as digits.
    expect(parseSpoken("bench press 185 for 5, three sets")?.sets).toHaveLength(3);
    expect(parseSpoken("bench press 185 for 5, 3 sets")?.sets).toHaveLength(3);
  });

  it("does not read the set count as reps", () => {
    const parsed = parseSpoken("squat 225 for 3, four sets");
    expect(parsed?.sets).toHaveLength(4);
    expect(parsed?.sets[0]).toEqual({ weightLbs: 225, reps: 3 });
  });

  it("accepts a bodyweight movement, which has reps and no weight", () => {
    expect(parseSpoken("pull ups 10 reps")?.sets).toEqual([{ reps: 10 }]);
  });
});

describe("erging and everything measured by distance", () => {
  it("reads a piece as the monitor shows it", () => {
    expect(parseSpoken("2000 metre erg in 7:12")).toEqual({
      kind: "erg",
      exercise: "Erg",
      rpe: null,
      sets: [{ distance: 2000, duration: "7:12" }],
    });
  });

  it("turns kilometres into metres, because the field is metres", () => {
    expect(parseSpoken("5k erg in 20:30")?.sets[0]?.distance).toBe(5000);
  });

  it("reads a stroke rate", () => {
    expect(parseSpoken("2000 metre erg in 7:12 at 24 spm")?.sets[0]?.spm).toBe(24);
  });

  it("reads spoken minutes as a clock, because a run is described that way", () => {
    const parsed = parseSpoken("20 minute run");
    expect(parsed?.kind).toBe("conditioning");
    expect(parsed?.sets[0]?.duration).toBe("20:00");
  });

  it("falls back to naming the kind when no exercise was said", () => {
    // "2000 metres in 7:12" names no piece, and an entry with no name at all is unreadable in
    // a list. The kind is the honest stand-in.
    expect(parseSpoken("rowed 2000 metres in 7:12")?.exercise).toBe("Rowed");
    expect(parseSpoken("2000 metres in 7:12")?.exercise).toBe("Conditioning");
  });

  it("reads the kind off the numbers when no word gives it away", () => {
    // The first version gave up here: no rowing word meant it tried to read a lift, found no
    // weight-for-reps, and sent a sentence to the model that the grammar can read perfectly
    // well. `conditioning` rather than `erg`, because a distance and a time is all that was
    // said — inferring the machine from habit would put a fact in the form nobody stated.
    const parsed = parseSpoken("2000 metres in 7:12");
    expect(parsed?.kind).toBe("conditioning");
    expect(parsed?.sets[0]).toEqual({ distance: 2000, duration: "7:12" });
  });
});

describe("where it gives up, on purpose", () => {
  /**
   * `null` rather than a half-filled shape. A partial parse that looks like success is the
   * worst outcome available: it puts a wrong number in a form that is about to be confirmed by
   * someone who trusts it. Returning nothing is what lets the caller offer the sentence to the
   * model instead.
   */
  it("gives up on a sentence with no numbers in it", () => {
    expect(parseSpoken("did some bench press today")).toBeNull();
  });

  it("gives up on a phrasing it has never seen", () => {
    expect(parseSpoken("worked up to a heavy single on squat")).toBeNull();
  });

  it("gives up on nothing at all", () => {
    expect(parseSpoken("")).toBeNull();
    expect(parseSpoken("   ")).toBeNull();
  });

  it("gives up on a weight with no reps, rather than inventing one", () => {
    // "bench press 185" is genuinely ambiguous — one rep, or a set he did not finish saying.
    // Guessing either would be a fabricated number in a training log.
    expect(parseSpoken("bench press 185")).toBeNull();
  });
});
