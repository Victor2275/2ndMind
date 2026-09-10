import { describe, expect, it } from "vitest";

import { EQUIPMENT, GROUPS, GROUP_FOR, MUSCLES, REGIONS } from "@/lib/athletics/muscles";

/**
 * The muscle vocabulary (V4 Phase 2++ Stage 1). See `muscles.ts` for why this moved out of
 * `catalogue.ts` and why the list grew from 15 to 21 drawable regions.
 */

describe("REGIONS", () => {
  it("excludes the `full body` sentinel and the legacy `core` synonym", () => {
    expect(REGIONS).not.toContain("full body");
    expect(REGIONS).not.toContain("core");
  });

  it("is everything else in MUSCLES", () => {
    expect(REGIONS.length).toBe(MUSCLES.length - 2);
  });

  it("has no duplicates", () => {
    expect(new Set(REGIONS).size).toBe(REGIONS.length);
  });
});

describe("GROUP_FOR", () => {
  it("is total: every region has a group, and every group is one of GROUPS", () => {
    for (const region of REGIONS) {
      const group = GROUP_FOR[region];
      expect(group, `${region} has no group`).toBeDefined();
      expect(
        GROUPS as readonly string[],
        `${region}'s group "${group}" is not in GROUPS`,
      ).toContain(group);
    }
  });

  it("has no entries for names outside REGIONS", () => {
    const known = new Set<string>(REGIONS);
    for (const key of Object.keys(GROUP_FOR)) {
      expect(known.has(key), `GROUP_FOR has an entry for "${key}", which is not a region`).toBe(
        true,
      );
    }
  });
});

describe("EQUIPMENT", () => {
  it("is a closed, non-empty vocabulary with no blank entry", () => {
    expect(EQUIPMENT.length).toBeGreaterThan(0);
    expect(EQUIPMENT).not.toContain("");
  });

  it("has no duplicates", () => {
    expect(new Set(EQUIPMENT).size).toBe(EQUIPMENT.length);
  });
});
