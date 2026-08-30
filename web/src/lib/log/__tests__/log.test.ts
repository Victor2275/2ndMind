// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";

import { resetTestDb } from "@/test/pg";
import { CATEGORIES, categoryByKey, searchTextFor, summarise } from "../categories";
import {
  categoriesLoggedBetween,
  countEntries,
  createEntry,
  deleteEntry,
  entriesBetween,
  listEntries,
  restoreEntry,
  searchEntries,
  type Db,
} from "../queries";

let db: Db;

beforeEach(async () => {
  db = (await resetTestDb()) as unknown as Db;
});

const at = (iso: string) => new Date(iso);

describe("category definitions", () => {
  it("covers the six things Victor said he logs", () => {
    expect(CATEGORIES.map((c) => c.key)).toEqual([
      "athletics",
      "academics",
      "work",
      "reading",
      "people",
      "day",
    ]);
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

  it("has no mood or energy scale, which Victor deferred to V3", () => {
    const names = CATEGORIES.flatMap((c) => c.fields.map((f) => f.name.toLowerCase()));
    expect(names).not.toContain("mood");
    expect(names).not.toContain("energy");
  });

  it("resolves a category by key and returns undefined for junk", () => {
    expect(categoryByKey("athletics")?.label).toBe("Training");
    expect(categoryByKey("nope")).toBeUndefined();
  });
});

describe("summarise", () => {
  it("reads in the order the form was filled in", () => {
    const line = summarise(
      "athletics",
      { kind: "lift", exercise: "Bench Press", weightLbs: 145, reps: 5 },
      "",
    );
    expect(line).toBe("lift · Bench Press · 145 · 5");
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
