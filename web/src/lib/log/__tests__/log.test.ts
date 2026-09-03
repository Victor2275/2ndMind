// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";

import { resetTestDb } from "@/test/pg";
import {
  CATEGORIES,
  categoryByKey,
  searchTextFor,
  summarise,
  writableCategoryByKey,
} from "../categories";
import { readField, readRows, takeBodyweight } from "../form";
import {
  categoriesLoggedBetween,
  countEntries,
  createEntry,
  deleteEntry,
  entriesBetween,
  listEntries,
  recentForChips,
  restoreEntry,
  searchEntries,
  type Db,
} from "../queries";
import { allChipSets } from "../chips";

let db: Db;

beforeEach(async () => {
  db = (await resetTestDb()) as unknown as Db;
});

const at = (iso: string) => new Date(iso);

describe("category definitions", () => {
  it("covers the five things Victor still logs here", () => {
    // Was six. `work` was retired on 2026-09-03 (D-159) because applications are tracked in a
    // Google Sheet, and logging them in two places meant neither was complete.
    expect(CATEGORIES.map((c) => c.key)).toEqual([
      "athletics",
      "academics",
      "reading",
      "people",
      "day",
    ]);
  });

  it("keeps a retired category readable without offering it", () => {
    // The failure this guards against is quiet: with no definition, `summarise` falls back to
    // the bare note and every application ever logged loses its company and status from the
    // timeline and from search.
    expect(CATEGORIES.some((c) => c.key === "work")).toBe(false);
    expect(categoryByKey("work")?.label).toBe("Applications");
    expect(summarise("work", { company: "Anthropic", action: "submitted" }, "")).toBe(
      "Anthropic · submitted",
    );
  });

  it("refuses to write to a retired category", () => {
    // A Server Action is a POST endpoint with a guessable id, so this is the door the category
    // would come back through.
    expect(writableCategoryByKey("work")).toBeUndefined();
    expect(writableCategoryByKey("athletics")?.label).toBe("Training");
  });

  it("gives every field a unique name within its category", () => {
    for (const category of CATEGORIES) {
      const names = category.fields.map((f) => f.name);
      expect(new Set(names).size, `${category.key} has duplicate field names`).toBe(names.length);
    }
  });

  it("gives every select field its options", () => {
    for (const category of CATEGORIES) {
      for (const field of category.fields) {
        if (field.type === "select") {
          expect(field.options, `${category.key}.${field.name}`).toBeTruthy();
          expect(field.options!.length).toBeGreaterThan(1);
        }
      }
    }
  });

  it("keeps every category short enough to fill in fifteen seconds", () => {
    // The design constraint from Q16. A category that grows past this stops being logged.
    for (const category of CATEGORIES) {
      expect(category.fields.length, `${category.key} is too long`).toBeLessThanOrEqual(8);
    }
  });

  // Was: "has no mood or energy scale, which Victor deferred to V3" — this test asserted the
  // absence, and V3 §0.4 is where that deferral ends (D-134). Inverted rather than deleted:
  // the pair is now load-bearing, and a silent disappearance should fail.
  it("has the mood and energy scales V3 added", () => {
    const names = CATEGORIES.flatMap((c) => c.fields.map((f) => f.name.toLowerCase()));
    expect(names).toContain("mood");
    expect(names).toContain("energy");
  });

  it("resolves a category by key and returns undefined for junk", () => {
    expect(categoryByKey("athletics")?.label).toBe("Training");
    expect(categoryByKey("nope")).toBeUndefined();
  });
});

describe("summarise", () => {
  it("reads in the order the form was filled in", () => {
    const line = summarise("academics", { course: "M51A", hours: 2 }, "");
    expect(line).toBe("M51A · 2");
  });

  it("reads a training entry as its sets, not as loose numbers", () => {
    // The shape D-159 introduced. Before it, one entry held one weight and one reps, so three
    // sets of bench press were three entries or a third of the truth.
    const line = summarise(
      "athletics",
      {
        kind: "lift",
        exercise: "Bench Press",
        sets: [
          { weightLbs: 185, reps: 5 },
          { weightLbs: 185, reps: 5 },
          { weightLbs: 175, reps: 5, setType: "drop" },
        ],
      },
      "",
    );
    expect(line).toBe("lift · Bench Press · 185 × 5, 185 × 5, 175 × 5 drop");
  });

  it("does not multiply an erg piece, because 2000m × 7:12 is not a thing", () => {
    const line = summarise(
      "athletics",
      { kind: "erg", exercise: "2k", sets: [{ distance: 2000, duration: 432, spm: 28 }] },
      "",
    );
    expect(line).toBe("erg · 2k · 2000m 432 28");
  });

  it("survives rows that are not rows, because data is JSON from a column", () => {
    expect(summarise("athletics", { exercise: "Row", sets: "nope" }, "")).toBe("Row");
    expect(summarise("athletics", { exercise: "Row", sets: [null, 3] }, "")).toBe("Row");
  });

  it("appends the note after an em dash", () => {
    const line = summarise("athletics", { exercise: "Row (Erg)" }, "felt heavy");
    expect(line).toBe("Row (Erg) — felt heavy");
  });

  it("skips empty, null and false values rather than printing them", () => {
    const line = summarise("people", { who: "Ethan", where: "", about: null, followUp: false }, "");
    expect(line).toBe("Ethan");
  });

  it("renders a ticked boolean as its label", () => {
    const line = summarise("people", { who: "Ethan", followUp: true }, "");
    expect(line).toBe("Ethan · follow up");
  });

  it("falls back to the note when there are no fields", () => {
    expect(summarise("day", {}, "long one")).toBe("long one");
  });

  it("does not throw on an unknown category", () => {
    expect(summarise("nope", { a: 1 }, "note")).toBe("note");
  });
});

describe("searchTextFor", () => {
  it("includes the category label, the values and the note", () => {
    const text = searchTextFor("work", { company: "Anthropic", action: "submitted" }, "tailored");
    expect(text).toContain("Applications");
    expect(text).toContain("Anthropic");
    expect(text).toContain("submitted");
    expect(text).toContain("tailored");
  });

  it("drops empty values so they cannot pollute a match", () => {
    expect(searchTextFor("day", { carryOver: "" }, "")).not.toMatch(/\s\s/);
  });
});

describe("createEntry and listEntries", () => {
  it("stores an entry with its structured fields", async () => {
    await createEntry(db, {
      category: "athletics",
      data: { kind: "erg", exercise: "Row (Erg)", distance: 5000, duration: 1130, spm: 24 },
      note: "steady",
    });

    const [entry] = await listEntries(db);
    expect(entry.category).toBe("athletics");
    expect(entry.data.spm).toBe(24);
    expect(entry.note).toBe("steady");
  });

  it("returns JSON fields as real types, not strings", async () => {
    await createEntry(db, { category: "athletics", data: { reps: 5, ok: true } });
    const [entry] = await listEntries(db);
    expect(typeof entry.data.reps).toBe("number");
    expect(entry.data.ok).toBe(true);
  });

  it("defaults occurredAt to now when not given", async () => {
    await createEntry(db, { category: "day", note: "fine" });
    const [entry] = await listEntries(db);
    expect(Date.now() - entry.occurredAt.getTime()).toBeLessThan(60_000);
  });

  it("accepts a backdated entry, since logging is not always immediate", async () => {
    await createEntry(db, {
      category: "day",
      note: "yesterday",
      occurredAt: at("2026-08-20T20:00:00Z"),
    });
    const [entry] = await listEntries(db);
    expect(entry.occurredAt.toISOString()).toBe("2026-08-20T20:00:00.000Z");
  });

  it("lists newest first", async () => {
    await createEntry(db, {
      category: "day",
      note: "older",
      occurredAt: at("2026-08-19T10:00:00Z"),
    });
    await createEntry(db, {
      category: "day",
      note: "newer",
      occurredAt: at("2026-08-21T10:00:00Z"),
    });
    expect((await listEntries(db)).map((e) => e.note)).toEqual(["newer", "older"]);
  });

  it("filters by category", async () => {
    await createEntry(db, { category: "athletics", note: "lift" });
    await createEntry(db, { category: "reading", note: "book" });
    expect((await listEntries(db, { category: "reading" })).map((e) => e.note)).toEqual(["book"]);
  });

  it("stores an entry with no fields at all", async () => {
    await createEntry(db, { category: "day" });
    expect(await countEntries(db)).toBe(1);
  });
});

describe("searchEntries", () => {
  beforeEach(async () => {
    await createEntry(db, {
      category: "work",
      data: { company: "Anthropic", role: "Robotics Intern", action: "submitted" },
      note: "tailored cover letter",
    });
    await createEntry(db, {
      category: "reading",
      data: { title: "Attention Is All You Need", kind: "paper" },
      note: "transformer architecture",
    });
    await createEntry(db, {
      category: "athletics",
      data: { kind: "erg", exercise: "Row (Erg)" },
      note: "felt strong",
    });
  });

  it("finds an entry by a field value", async () => {
    const hits = await searchEntries(db, "Anthropic");
    expect(hits).toHaveLength(1);
    expect(hits[0].category).toBe("work");
  });

  it("finds an entry by its note", async () => {
    const hits = await searchEntries(db, "transformer");
    expect(hits.map((h) => h.category)).toEqual(["reading"]);
  });

  it("stems, so a different word form still matches", async () => {
    // English stemming: "felt" and "feeling" reduce differently, but "architectures" should
    // still find "architecture".
    const hits = await searchEntries(db, "architectures");
    expect(hits).toHaveLength(1);
  });

  it("is case-insensitive", async () => {
    expect(await searchEntries(db, "anthropic")).toHaveLength(1);
  });

  it("returns nothing for a blank query rather than everything", async () => {
    expect(await searchEntries(db, "   ")).toEqual([]);
  });

  it("does not throw on punctuation", async () => {
    // plainto_tsquery tolerates this; to_tsquery would raise a syntax error and 500 the page.
    await expect(searchEntries(db, "a & b | c :*")).resolves.toBeInstanceOf(Array);
    await expect(searchEntries(db, "!!!")).resolves.toEqual([]);
  });

  it("does not return deleted entries", async () => {
    const [entry] = await searchEntries(db, "Anthropic");
    await deleteEntry(db, entry.id);
    expect(await searchEntries(db, "Anthropic")).toEqual([]);
  });
});

describe("delete and restore", () => {
  it("soft-deletes and brings back", async () => {
    const entry = await createEntry(db, { category: "day", note: "mistake" });

    await deleteEntry(db, entry.id);
    expect(await listEntries(db)).toEqual([]);

    const restored = await restoreEntry(db, entry.id);
    expect(restored?.note).toBe("mistake");
    expect(await listEntries(db)).toHaveLength(1);
  });

  it("reports null when there is nothing to delete", async () => {
    expect(await deleteEntry(db, 9999)).toBeNull();
  });

  it("will not delete twice", async () => {
    const entry = await createEntry(db, { category: "day" });
    expect(await deleteEntry(db, entry.id)).not.toBeNull();
    expect(await deleteEntry(db, entry.id)).toBeNull();
  });
});

describe("entriesBetween and the daily prompt", () => {
  it("returns only entries inside the window", async () => {
    await createEntry(db, { category: "day", note: "in", occurredAt: at("2026-08-21T12:00:00Z") });
    await createEntry(db, { category: "day", note: "out", occurredAt: at("2026-08-19T12:00:00Z") });

    const inside = await entriesBetween(db, at("2026-08-21T00:00:00Z"), at("2026-08-22T00:00:00Z"));
    expect(inside.map((e) => e.note)).toEqual(["in"]);
  });

  it("reports which categories have been logged today", async () => {
    await createEntry(db, { category: "athletics", occurredAt: at("2026-08-21T09:00:00Z") });
    await createEntry(db, { category: "athletics", occurredAt: at("2026-08-21T18:00:00Z") });
    await createEntry(db, { category: "reading", occurredAt: at("2026-08-21T20:00:00Z") });

    const logged = await categoriesLoggedBetween(
      db,
      at("2026-08-21T00:00:00Z"),
      at("2026-08-22T00:00:00Z"),
    );
    expect(logged.sort()).toEqual(["athletics", "reading"]);
  });

  it("ignores deleted entries when deciding what has been logged", async () => {
    const entry = await createEntry(db, {
      category: "athletics",
      occurredAt: at("2026-08-21T09:00:00Z"),
    });
    await deleteEntry(db, entry.id);

    const logged = await categoriesLoggedBetween(
      db,
      at("2026-08-21T00:00:00Z"),
      at("2026-08-22T00:00:00Z"),
    );
    expect(logged).toEqual([]);
  });
});

describe("1-5 scales (D-134)", () => {
  const day = categoryByKey("day")!;
  const mood = day.fields.find((f) => f.name === "mood")!;
  const energy = day.fields.find((f) => f.name === "energy")!;

  const form = (name: string, value: string) => {
    const fd = new FormData();
    fd.set(name, value);
    return fd;
  };

  it("puts both scales on End of day, with anchored ends", () => {
    expect(mood.type).toBe("scale");
    expect(energy.type).toBe("scale");
    // Ends are anchored so a tap is a choice, not a reflex. The middle is deliberately bare.
    expect(mood.anchors).toEqual(["wrecked", "great"]);
    expect(energy.anchors).toEqual(["empty", "wired"]);
  });

  it("gives every scale field anchors", () => {
    for (const category of CATEGORIES) {
      for (const field of category.fields) {
        if (field.type === "scale") {
          expect(field.anchors, `${category.key}.${field.name}`).toHaveLength(2);
        }
      }
    }
  });

  it("accepts every value in range", () => {
    for (const n of [1, 2, 3, 4, 5]) {
      expect(readField(form("mood", String(n)), mood)).toBe(n);
    }
  });

  it("drops out-of-range values rather than clamping them", () => {
    // Clamping a 9 to a 5 would put a point in the series that nobody chose, and these fields
    // exist to be plotted. A fabricated point is worse than a missing one.
    for (const bad of ["0", "6", "9", "-1", "999"]) {
      expect(readField(form("mood", bad), mood), bad).toBeNull();
    }
  });

  it("rejects non-integers and junk", () => {
    for (const bad of ["3.5", "4abc", "abc", "NaN", "Infinity", " "]) {
      expect(readField(form("mood", bad), mood), bad).toBeNull();
    }
  });

  it("treats an unanswered scale as absent, not as zero", () => {
    // Every field in this form is optional; a skipped scale must not become a 0 in the series.
    expect(readField(new FormData(), mood)).toBeNull();
  });

  it("carries the label into the timeline summary", () => {
    // A bare "4 · 2" gives no way to tell mood from energy.
    expect(summarise("day", { mood: 4, energy: 2 }, "")).toBe("mood 4 · energy 2");
    expect(summarise("day", { mood: 1 }, "rough one")).toBe("mood 1 — rough one");
  });

  it("makes scale values searchable", () => {
    expect(searchTextFor("day", { mood: 5, energy: 4 }, "good day")).toContain("5");
    expect(searchTextFor("day", { mood: 5, energy: 4 }, "good day")).toContain("good day");
  });
});

describe("sets, read out of the form (D-159)", () => {
  const training = categoryByKey("athletics")!;
  const group = training.rows!;

  const posted = (values: Record<string, string>) => {
    const data = new FormData();
    for (const [name, value] of Object.entries(values)) data.append(name, value);
    return data;
  };

  it("reads a row per set, in order", () => {
    const rows = readRows(
      posted({
        "sets.0.weightLbs": "185",
        "sets.0.reps": "5",
        "sets.1.weightLbs": "175",
        "sets.1.reps": "8",
      }),
      group,
    );

    expect(rows).toEqual([
      { weightLbs: 185, reps: 5 },
      { weightLbs: 175, reps: 8 },
    ]);
  });

  it("keeps the rows in numeric order, not the order the keys arrived in", () => {
    const rows = readRows(
      posted({ "sets.10.reps": "10", "sets.2.reps": "2", "sets.0.reps": "0.5" }),
      group,
    );
    expect(rows.map((r) => r.reps)).toEqual([0.5, 2, 10]);
  });

  it("does not stop at a gap, which is what removing a middle row leaves", () => {
    // Rows are keyed by a generated id, so deleting the second of three posts 0 and 2. A
    // reader that counted upward from zero would silently drop the last set of every session
    // a row was ever removed from.
    const rows = readRows(posted({ "sets.0.reps": "5", "sets.2.reps": "3" }), group);
    expect(rows.map((r) => r.reps)).toEqual([5, 3]);
  });

  it("drops a blank row, so a spare row costs nothing", () => {
    const rows = readRows(
      posted({ "sets.0.reps": "5", "sets.1.reps": "", "sets.2.reps": "3" }),
      group,
    );
    expect(rows).toHaveLength(2);
  });

  it("drops a row holding only its set-type default", () => {
    const rows = readRows(posted({ "sets.0.reps": "5", "sets.1.setType": "normal" }), group);
    expect(rows).toEqual([{ reps: 5 }]);
  });

  it("reads each row's own distance unit", () => {
    // The bug this exists for: a unit select found under the un-prefixed name would give every
    // row the first one's unit, and 500 metres would silently become 500 miles.
    const rows = readRows(
      posted({
        "sets.0.distance": "500",
        "sets.0.distanceUnit": "m",
        "sets.1.distance": "2",
        "sets.1.distanceUnit": "km",
      }),
      group,
    );

    expect(rows.map((r) => r.distance)).toEqual([500, 2000]);
  });

  it("parses a time the way an erg monitor prints it", () => {
    const rows = readRows(posted({ "sets.0.duration": "7:12" }), group);
    expect(rows[0].duration).toBe(432);
  });

  it("refuses more rows than the category allows", () => {
    const many: Record<string, string> = {};
    for (let i = 0; i < 50; i += 1) many[`sets.${i}.reps`] = "5";

    // A Server Action is a POST endpoint with a guessable id, so the cap is enforced here
    // rather than left to the form declining to render a button.
    expect(readRows(posted(many), group)).toHaveLength(group.max);
  });

  it("reads nothing from a form with no rows in it", () => {
    expect(readRows(posted({ exercise: "Squat" }), group)).toEqual([]);
  });
});

describe("the weigh-in on a training entry (D-159)", () => {
  it("takes the weight off the entry, so there is one copy of it", () => {
    // Bodyweight is the second input to every adjusted erg split. A copy in a log entry's
    // JSON is a number that can disagree with the chart, and nothing would reconcile them.
    const data: Record<string, unknown> = { exercise: "Squat", bodyweightLbs: 178.3 };
    expect(takeBodyweight(data)).toEqual({ weight: 178.3, problem: null });
    expect(data).toEqual({ exercise: "Squat" });
  });

  it("rounds to two places rather than storing a floating-point artefact", () => {
    expect(takeBodyweight({ bodyweightLbs: 178.30000000000001 }).weight).toBe(178.3);
  });

  it("reports an impossible weight instead of recording it", () => {
    for (const bad of [4, 2150, -170]) {
      const { weight, problem } = takeBodyweight({ bodyweightLbs: bad });
      expect(weight, String(bad)).toBeNull();
      expect(problem, String(bad)).toContain("between");
    }
  });

  it("says nothing when there was no weigh-in", () => {
    expect(takeBodyweight({ exercise: "Squat" })).toEqual({ weight: null, problem: null });
  });
});

describe("recent values for the chips (§1.6)", () => {
  it("hands back newest first, so the chip row is in the order he last used them", async () => {
    await createEntry(db, {
      category: "athletics",
      data: { exercise: "Squat" },
      occurredAt: at("2026-08-01T18:00:00Z"),
    });
    await createEntry(db, {
      category: "athletics",
      data: { exercise: "Bench Press" },
      occurredAt: at("2026-08-30T18:00:00Z"),
    });

    const recent = await recentForChips(db);
    expect(recent.map((r) => r.data.exercise)).toEqual(["Bench Press", "Squat"]);
  });

  it("leaves out a deleted entry, so removing a mistake removes its chip", async () => {
    const gone = await createEntry(db, { category: "athletics", data: { exercise: "Typo Lift" } });
    await createEntry(db, { category: "athletics", data: { exercise: "Squat" } });

    await deleteEntry(db, gone.id);

    const recent = await recentForChips(db);
    expect(recent.map((r) => r.data.exercise)).toEqual(["Squat"]);
  });

  it("brings the numbers with it, which is the point of the chip", async () => {
    await createEntry(db, {
      category: "athletics",
      data: {
        kind: "lift",
        exercise: "Bench Press",
        sets: [{ weightLbs: 185, reps: 5 }],
      },
    });

    // Since D-159 the numbers live in the first set row, and the chip has to fill the input
    // that actually exists — `sets.0.weightLbs`, not a top-level `weightLbs` that would be
    // read as nothing and posted as nothing.
    const sets = allChipSets(await recentForChips(db));
    expect(sets.athletics.exercise[0]).toMatchObject({
      label: "Bench Press · 185 × 5",
      fills: { exercise: "Bench Press", "sets.0.weightLbs": "185", "sets.0.reps": "5" },
    });
  });

  it("covers every category in one query rather than one query each", async () => {
    await createEntry(db, { category: "athletics", data: { exercise: "Squat" } });
    await createEntry(db, { category: "reading", data: { title: "Wagenmakers" } });
    await createEntry(db, { category: "people", data: { who: "Coach" } });

    const sets = allChipSets(await recentForChips(db));
    expect(Object.keys(sets).sort()).toEqual(["athletics", "people", "reading"]);
  });

  it("respects its limit, so a long history cannot make the log page slow", async () => {
    for (let i = 0; i < 12; i += 1) {
      await createEntry(db, { category: "athletics", data: { exercise: `Lift ${i}` } });
    }

    expect(await recentForChips(db, 5)).toHaveLength(5);
  });
});
