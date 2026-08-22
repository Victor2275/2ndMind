import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  parseRehabProtocol,
  parseSpmTargets,
  parseSplitGoal,
  parseVaultBodyweight,
  parseWeeklyPlan,
  slugify,
} from "../protocol";

/**
 * Two kinds of test here.
 *
 * The fixture tests pin the parsing rules. The vault tests read Victor's actual files and
 * assert the sections are still found — which is the failure that actually matters, because
 * a reformat in the vault silently empties a panel on the site and nothing else would catch
 * it. If one of those fails, the vault changed shape; the fix is usually in this parser, not
 * in the markdown.
 */

const VAULT = path.join(process.cwd(), "..", "context", "02_physical_performance");

function read(name: string): string {
  return fs.readFileSync(path.join(VAULT, name), "utf8");
}

/** The vault is CRLF. Building fixtures that way keeps the tests honest about it. */
function crlf(lines: string[]): string {
  return lines.join("\r\n");
}

describe("slugify", () => {
  it("makes a stable key from a protocol name", () => {
    expect(slugify("Couch Stretch / Psoas Release")).toBe("couch-stretch-psoas-release");
    expect(slugify("Glute Bridges")).toBe("glute-bridges");
  });
});

describe("parseSpmTargets", () => {
  const markdown = crlf([
    "### SPM (Stroke Per Minute) Targets",
    "- **200m Sprints:** 80 - 85+ SPM (Maximal explosive power).",
    "- **500m Race Pace:** 72 - 76 SPM (Sustained threshold).",
    "- **2000m Head Race:** 62 - 66 SPM (Aerobic power, maximum length/reach).",
    "",
    "## 3. Nutrition",
    "- **Protein:** 170g - 200g daily.",
  ]);

  it("reads distance and range from each bullet", () => {
    const targets = parseSpmTargets(markdown);
    expect(targets).toHaveLength(3);
    expect(targets[0]).toMatchObject({ distanceM: 200, minSpm: 80, maxSpm: 85 });
    expect(targets[1]).toMatchObject({ distanceM: 500, minSpm: 72, maxSpm: 76 });
    expect(targets[2]).toMatchObject({ distanceM: 2000, minSpm: 62, maxSpm: 66 });
  });

  it("stops at the next heading rather than absorbing the nutrition bullets", () => {
    // "170g - 200g" is a range next to no distance, so it must not become a target.
    expect(parseSpmTargets(markdown).some((t) => t.minSpm === 170)).toBe(false);
  });

  it("keeps the parenthetical as the intent", () => {
    expect(parseSpmTargets(markdown)[0].intent).toBe("Maximal explosive power");
  });

  it("returns nothing when the heading is absent", () => {
    expect(parseSpmTargets("# Nothing here")).toEqual([]);
  });
});

describe("parseRehabProtocol", () => {
  const markdown = crlf([
    "**Daily Habits:**",
    "- **Protein**: 170g daily.",
    "",
    "**Lower Back Rehab Protocol:**",
    "*(Perform these daily or post-practice.)*",
    "- **Pallof Presses**: 3x10 per side (Anti-rotation stiffening).",
    "- **Glute Bridges**: 3x15 (Activates glutes during the leg drive).",
  ]);

  it("reads only the rehab block, not the habits above it", () => {
    const items = parseRehabProtocol(markdown);
    expect(items.map((i) => i.name)).toEqual(["Pallof Presses", "Glute Bridges"]);
  });

  it("splits the prescription from its rationale", () => {
    const [pallof] = parseRehabProtocol(markdown);
    expect(pallof.prescription).toBe("3x10 per side");
    expect(pallof.rationale).toBe("Anti-rotation stiffening");
    expect(pallof.slug).toBe("pallof-presses");
  });

  it("drops a duplicate name rather than letting two rows share a completion key", () => {
    const doubled = crlf([
      "**Lower Back Rehab Protocol:**",
      "- **Glute Bridges**: 3x15.",
      "- **Glute Bridges**: 3x20.",
    ]);
    expect(parseRehabProtocol(doubled)).toHaveLength(1);
  });
});

describe("parseWeeklyPlan", () => {
  const markdown = crlf([
    "### Weekly Layout",
    "- **Monday**: ",
    "  - Solo PERG (High Intensity)",
    "  - Lower Body & Core Strength",
    "- **Tuesday**: ",
    "  - Team Land Practice",
    "- **Sunday**: ",
    "  - 1-hour Water Practice",
    "",
    "## 2. Strength",
  ]);

  it("maps day names onto getDay() indices", () => {
    const plan = parseWeeklyPlan(markdown);
    expect(plan.map((d) => d.weekday)).toEqual([1, 2, 0]);
  });

  it("collects the indented items under each day", () => {
    const [monday] = parseWeeklyPlan(markdown);
    expect(monday.items).toEqual(["Solo PERG (High Intensity)", "Lower Body & Core Strength"]);
  });

  it("tolerates the trailing space the vault leaves after the colon", () => {
    expect(parseWeeklyPlan(markdown)).toHaveLength(3);
  });

  it("ignores a bold bullet that is not a weekday", () => {
    const odd = crlf(["### Weekly Layout", "- **Rest Rule**: ", "  - not a day"]);
    expect(parseWeeklyPlan(odd)).toEqual([]);
  });
});

describe("parseSplitGoal", () => {
  it("reads the target time, distance and whether it is weight-adjusted", () => {
    const goal = parseSplitGoal(
      crlf([
        "- **Target:** Sub-2:00 weight-adjusted 500m split in Dragon Boat.",
        "- **Milestone Date:** May 2027.",
      ]),
    );

    expect(goal).toEqual({
      targetSplitS: 120,
      distanceM: 500,
      weightAdjusted: true,
      milestone: "May 2027",
    });
  });

  it("marks a raw target as not weight-adjusted", () => {
    const goal = parseSplitGoal("- **Target:** Sub-1:50 500m split.");
    expect(goal?.weightAdjusted).toBe(false);
  });

  it("returns null when there is no parseable time", () => {
    expect(parseSplitGoal("- **Target:** Get faster.")).toBeNull();
  });
});

describe("parseVaultBodyweight", () => {
  it("reads the italicised current weight line", () => {
    expect(parseVaultBodyweight("*Current Weight: 215 lbs. Drag Factor: 1.*")).toBe(215);
  });

  it("returns null when it is not stated", () => {
    expect(parseVaultBodyweight("no weight here")).toBeNull();
  });
});

describe("against the real vault", () => {
  const benchmarks = read("benchmarks_and_logs.md");
  const training = read("training_blocks.md");

  it("finds the SPM targets", () => {
    const targets = parseSpmTargets(benchmarks);
    expect(targets.length).toBeGreaterThanOrEqual(3);
    for (const target of targets) {
      expect(target.distanceM).toBeGreaterThan(0);
      expect(target.maxSpm).toBeGreaterThanOrEqual(target.minSpm);
    }
  });

  it("finds the rehab protocol", () => {
    const items = parseRehabProtocol(benchmarks);
    expect(items.length).toBeGreaterThanOrEqual(4);
    expect(new Set(items.map((i) => i.slug)).size).toBe(items.length);
  });

  it("finds the split goal", () => {
    const goal = parseSplitGoal(benchmarks);
    expect(goal).not.toBeNull();
    expect(goal?.weightAdjusted).toBe(true);
    expect(goal?.distanceM).toBeGreaterThan(0);
  });

  it("finds a full week of programming", () => {
    const plan = parseWeeklyPlan(training);
    expect(plan).toHaveLength(7);
    expect(new Set(plan.map((d) => d.weekday)).size).toBe(7);
    for (const day of plan) expect(day.items.length).toBeGreaterThan(0);
  });

  it("finds a fallback bodyweight", () => {
    expect(parseVaultBodyweight(benchmarks)).toBeGreaterThan(0);
  });
});
