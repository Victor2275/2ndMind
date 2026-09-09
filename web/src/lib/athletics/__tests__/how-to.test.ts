import { describe, expect, it } from "vitest";

import { CATALOGUE } from "@/lib/athletics/catalogue";
import { HOW_TO, howTo } from "@/lib/athletics/how-to";

/**
 * The written descriptions that replaced the demonstration clips (V4 Phase 2.10).
 *
 * The failure this file exists to prevent is drift. The map is keyed by exercise name and the
 * catalogue is the list of names, so renaming "Skullcrusher" to "Lying Triceps Extension" in one
 * file and not the other produces an exercise with no description — and nothing on screen says
 * so, because a missing description renders as a sentence explaining that there is none. That is
 * correct behaviour for a movement Victor typed in himself and wrong for one that ships.
 */

describe("how-to coverage", () => {
  it("has a description for every seeded exercise", () => {
    const missing = CATALOGUE.filter((entry) => howTo(entry.name) === null).map((e) => e.name);
    expect(missing, `no description for: ${missing.join(", ")}`).toEqual([]);
  });

  it("has no description for an exercise that is not in the catalogue", () => {
    // The other direction. An orphan entry is a rename that was done in `how-to.ts` and not in
    // the catalogue, which leaves the *real* name uncovered — and the test above would catch
    // that, but this one says which stale key caused it.
    const names = new Set(CATALOGUE.map((entry) => entry.name));
    const orphans = Object.keys(HOW_TO).filter((name) => !names.has(name));
    expect(orphans, `these are not catalogue names: ${orphans.join(", ")}`).toEqual([]);
  });

  it("returns null for a movement nobody has written about", () => {
    // An exercise added on the phone. Rendering "no description" is the honest answer; inventing
    // one would be the model writing training advice into the app unasked.
    expect(howTo("Victor's Special Curl")).toBeNull();
  });

  it("keeps every description short enough to read between sets", () => {
    // The cap is the feature. This is read standing at a rack with a bar in your hands, and a
    // paragraph there is the same as no text at all.
    for (const [name, text] of Object.entries(HOW_TO)) {
      expect(text.length, `${name} is ${text.length} characters`).toBeLessThanOrEqual(320);
      expect(text.trim().length, `${name} is empty`).toBeGreaterThan(30);
    }
  });

  it("writes in whole sentences", () => {
    for (const [name, text] of Object.entries(HOW_TO)) {
      expect(text.trim().endsWith("."), `${name} does not end in a full stop`).toBe(true);
    }
  });
});
