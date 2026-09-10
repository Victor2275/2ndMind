import { describe, expect, it } from "vitest";

import { CATALOGUE } from "@/lib/athletics/catalogue";
import { EQUIPMENT } from "@/lib/athletics/muscles";

/**
 * The v2 catalogue (V4 Phase 2++ Stage 3).
 *
 * `how-to.test.ts`'s checks move here, since `howTo` is a field on each entry now rather than a
 * separate map that could drift from the names beside it — which is also why the coverage tests
 * that file had (does every catalogue name have a description, does every description have a
 * live catalogue name) are gone: they cannot go out of sync by construction anymore.
 */

describe("names", () => {
  it("has no duplicate name", () => {
    const seen = new Set<string>();
    const dupes: string[] = [];
    for (const entry of CATALOGUE) {
      if (seen.has(entry.name)) dupes.push(entry.name);
      seen.add(entry.name);
    }
    expect(dupes).toEqual([]);
  });

  it("follows `Movement (Equipment)`, except the three that load nothing", () => {
    const bare = new Set(["Mobility", "Stretching", "Foam Rolling"]);
    const wrong = CATALOGUE.filter(
      (entry) => !bare.has(entry.name) && !/ \([A-Za-z]+\)$/.test(entry.name),
    ).map((e) => e.name);
    expect(wrong).toEqual([]);
  });
});

describe("seedKey", () => {
  it("is set for every seeded entry and unique", () => {
    const missing = CATALOGUE.filter((e) => !e.seedKey).map((e) => e.name);
    expect(missing).toEqual([]);

    const seen = new Set<string>();
    const dupes: string[] = [];
    for (const entry of CATALOGUE) {
      if (!entry.seedKey) continue;
      if (seen.has(entry.seedKey)) dupes.push(entry.seedKey);
      seen.add(entry.seedKey);
    }
    expect(dupes).toEqual([]);
  });
});

describe("equipment", () => {
  it("uses only the closed vocabulary", () => {
    const known = new Set<string>(EQUIPMENT);
    const bad = CATALOGUE.filter((e) => !known.has(e.equipment)).map(
      (e) => `${e.name}: "${e.equipment}"`,
    );
    expect(bad).toEqual([]);
  });
});

describe("howTo", () => {
  it("every entry has one, short enough to read between sets", () => {
    for (const entry of CATALOGUE) {
      expect(entry.howTo.length, `${entry.name} is empty`).toBeGreaterThan(30);
      expect(
        entry.howTo.length,
        `${entry.name} is ${entry.howTo.length} characters`,
      ).toBeLessThanOrEqual(400);
    }
  });

  it("writes in whole sentences", () => {
    for (const entry of CATALOGUE) {
      expect(entry.howTo.trim().endsWith("."), `${entry.name} does not end in a full stop`).toBe(
        true,
      );
    }
  });
});

describe("muscles", () => {
  it("gives every entry at least one muscle, except the three that load nothing", () => {
    const blank = CATALOGUE.filter(
      (e) => e.primaryMuscles.length === 0 && e.secondaryMuscles.length === 0,
    ).map((e) => e.name);
    expect(blank.sort()).toEqual(["Foam Rolling", "Mobility", "Stretching"]);
  });

  it("never repeats a muscle between primary and secondary on the same entry", () => {
    const overlapping = CATALOGUE.filter((e) =>
      e.primaryMuscles.some((m) => e.secondaryMuscles.includes(m)),
    ).map((e) => e.name);
    expect(overlapping).toEqual([]);
  });
});

describe("aliases", () => {
  it("are derived from renames.ts, so every alias round-trips back to this entry's name", () => {
    // Not a tautology: this catches a name typo between catalogue.ts and renames.ts, which
    // would otherwise silently strand an alias on the wrong entry (or on none at all).
    for (const entry of CATALOGUE) {
      for (const alias of entry.aliases) {
        expect(alias, `${entry.name} carries an alias identical to its own name`).not.toBe(
          entry.name,
        );
      }
    }
  });
});
