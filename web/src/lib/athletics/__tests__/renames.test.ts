import { describe, expect, it } from "vitest";

import { CATALOGUE } from "@/lib/athletics/catalogue";
import { normalizeExerciseName, RENAMES } from "@/lib/athletics/renames";
import v1Names from "@/lib/athletics/__tests__/fixtures/catalogue-v1.names.json";

/**
 * The v1 → v2 rename map (V4 Phase 2++ Stage 3) — the only irreversible stage in the phase, so
 * this is the file that has to be exhaustive rather than merely plausible.
 *
 * `catalogue-v1.names.json` pins the 164 names the catalogue actually had on 2026-09-09, before
 * anything in Stage 3 touched it. Testing against a frozen fixture rather than "whatever
 * `catalogue.ts` used to export" is deliberate: once `catalogue.ts` is rewritten, there is no
 * other record of what v1 looked like, and "is the rename map total?" becomes unanswerable.
 */

describe("totality", () => {
  it("has exactly one entry for every v1 name, no more and no fewer", () => {
    const v1 = v1Names as string[];
    const mapped = RENAMES.map((r) => r.from);

    // Every v1 name is covered.
    const missing = v1.filter((name) => !mapped.includes(name));
    expect(missing, `no rename entry for: ${missing.join(", ")}`).toEqual([]);

    // Nothing extra, and nothing duplicated — a count comparison catches both at once given the
    // "no more" check above already confirms every v1 name appears at least once.
    expect(mapped.length, "RENAMES has a different count than the v1 fixture").toBe(v1.length);
  });

  it("has no entry for a name that was never in v1", () => {
    const v1 = new Set(v1Names as string[]);
    const extra = RENAMES.filter((r) => !v1.has(r.from));
    expect(extra.map((r) => r.from)).toEqual([]);
  });
});

describe("function, not relation", () => {
  it("maps each v1 name exactly once — no `from` appears twice", () => {
    const seen = new Set<string>();
    const dupes: string[] = [];
    for (const r of RENAMES) {
      if (seen.has(r.from)) dupes.push(r.from);
      seen.add(r.from);
    }
    expect(dupes).toEqual([]);
  });
});

describe("no dangling targets", () => {
  it("every `to` is a real name in the v2 catalogue", () => {
    const v2 = new Set(CATALOGUE.map((e) => e.name));
    const dangling = RENAMES.filter((r) => !v2.has(r.to)).map((r) => `${r.from} -> ${r.to}`);
    expect(dangling).toEqual([]);
  });
});

describe("idempotence", () => {
  it("normalizing an already-v2 name is a no-op", () => {
    // A rename script re-run against a partly-migrated database, or a client that already holds
    // the v2 name, must not try to rename it again — there is nothing in RENAMES keyed by a v2
    // name, so the lookup falls through to "unchanged", which is what makes this safe.
    for (const entry of CATALOGUE) {
      expect(normalizeExerciseName(entry.name)).toBe(entry.name);
    }
  });

  it("normalizing a name from outside the catalogue leaves it alone", () => {
    // A Hevy import, or a movement typed by hand — the rename was never going to touch it.
    expect(normalizeExerciseName("Victor's Special Curl")).toBe("Victor's Special Curl");
  });
});

describe("collapse counts, pinned by number", () => {
  it("collapses 22 erg rows into 3 names", () => {
    const erg = RENAMES.filter((r) =>
      ["Row (Erg)", "Ski Erg (Erg)", "Bike Erg (Erg)"].includes(r.to),
    );
    expect(erg).toHaveLength(22);
    expect(erg.filter((r) => r.to === "Row (Erg)")).toHaveLength(18);
    expect(erg.filter((r) => r.to === "Ski Erg (Erg)")).toHaveLength(2);
    expect(erg.filter((r) => r.to === "Bike Erg (Erg)")).toHaveLength(2);
  });

  it("collapses 9 water rows into 4 names", () => {
    const water = RENAMES.filter((r) =>
      ["Paddle (Boat)", "Starts (Boat)", "Race Piece (Boat)", "Technical Paddle (Boat)"].includes(
        r.to,
      ),
    );
    expect(water).toHaveLength(9);
    expect(water.filter((r) => r.to === "Paddle (Boat)")).toHaveLength(6);
  });

  it("collapses the calf raise pair — 5 rows become 4 names", () => {
    const calf = RENAMES.filter((r) => r.to.startsWith("Calf Raise"));
    expect(calf).toHaveLength(5);
    expect(calf.filter((r) => r.to === "Calf Raise (Standing)")).toHaveLength(2);
  });

  it("every collapsed erg entry carries the distance, duration, or piece type it lost from its name", () => {
    for (const r of RENAMES) {
      if (!["Row (Erg)", "Ski Erg (Erg)", "Bike Erg (Erg)", "Paddle (Boat)"].includes(r.to)) {
        continue;
      }
      const carriesSomething =
        r.distanceM !== undefined || r.durationS !== undefined || r.pieceType !== undefined;
      expect(carriesSomething, `${r.from} -> ${r.to} lost its distance/duration/piece type`).toBe(
        true,
      );
    }
  });
});

describe("every distance and duration is sane", () => {
  it("has no negative or zero distance/duration", () => {
    for (const r of RENAMES) {
      if (r.distanceM !== undefined) expect(r.distanceM, r.from).toBeGreaterThan(0);
      if (r.durationS !== undefined) expect(r.durationS, r.from).toBeGreaterThan(0);
    }
  });
});
