// @vitest-environment node
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  THRESHOLDS,
  ageInDays,
  assessFreshness,
  loadFreshness,
  readVaultFiles,
} from "../freshness";

const TODAY = new Date("2026-08-21T18:00:00Z");

function file(name: string, front: Record<string, string> | null, eol = "\n") {
  if (!front) return { path: name, raw: `# No frontmatter here${eol}` };
  const block = Object.entries(front)
    .map(([k, v]) => `${k}: ${v}`)
    .join(eol);
  return { path: name, raw: `---${eol}${block}${eol}---${eol}${eol}# Body${eol}` };
}

describe("ageInDays", () => {
  it("floors both sides to UTC midnight", () => {
    // Rendered late in the day; the file was written this morning. Still zero days old.
    expect(ageInDays("2026-08-21", TODAY)).toBe(0);
    expect(ageInDays("2026-08-20", TODAY)).toBe(1);
  });

  it("returns null rather than NaN for junk", () => {
    expect(ageInDays("not-a-date", TODAY)).toBeNull();
    expect(ageInDays("2026-13-45", TODAY)).toBeNull();
  });

  it("reports future dates as negative rather than stale", () => {
    expect(ageInDays("2026-08-25", TODAY)).toBe(-4);
  });
});

describe("assessFreshness", () => {
  it("applies the volatile threshold at the boundary, not one day early", () => {
    const at = file("a.md", { stability: "volatile", updated: "2026-08-07" }); // exactly 14d
    const over = file("b.md", { stability: "volatile", updated: "2026-08-06" }); // 15d
    const report = assessFreshness([at, over], TODAY);

    expect(report.rows[0].verdict).toBe("fresh");
    expect(report.rows[1].verdict).toBe("stale");
  });

  it("holds stable files to the laxer limit", () => {
    const report = assessFreshness(
      [file("a.md", { stability: "stable", updated: "2026-08-01" })],
      TODAY,
    );
    expect(report.rows[0].limitDays).toBe(180);
    expect(report.rows[0].verdict).toBe("fresh");
  });

  it("defaults a missing stability to stable", () => {
    const report = assessFreshness([file("a.md", { updated: "2026-08-01" })], TODAY);
    expect(report.rows[0].stability).toBe("stable");
    expect(report.rows[0].limitDays).toBe(180);
  });

  it("treats an unknown stability as the laxest limit instead of crashing", () => {
    const report = assessFreshness(
      [file("a.md", { stability: "evergreen", updated: "2026-08-01" })],
      TODAY,
    );
    expect(report.rows[0].limitDays).toBe(180);
  });

  it("counts missing frontmatter as unknown, never as fresh", () => {
    const report = assessFreshness([file("a.md", null)], TODAY);
    expect(report.rows[0].verdict).toBe("unknown");
    expect(report.unknown).toHaveLength(1);
    // The dangerous bug would be silently passing a file that cannot vouch for itself.
    expect(report.rows[0].verdict).not.toBe("fresh");
  });

  it("counts an unparseable updated: as unknown", () => {
    const report = assessFreshness(
      [file("a.md", { stability: "volatile", updated: "last tuesday" })],
      TODAY,
    );
    expect(report.rows[0].verdict).toBe("unknown");
  });

  it("reads CRLF frontmatter, which is what Windows actually writes", () => {
    const report = assessFreshness([file("a.md", { updated: "2026-08-01" }, "\r\n")], TODAY);
    expect(report.rows[0].updated).toBe("2026-08-01");
    expect(report.rows[0].verdict).toBe("fresh");
  });

  it("does not leave a stray carriage return on the parsed date", () => {
    const report = assessFreshness([file("a.md", { updated: "2026-08-01" }, "\r\n")], TODAY);
    expect(report.rows[0].updated).not.toMatch(/\r/);
    expect(report.rows[0].ageDays).toBe(20);
  });

  it("sorts the stale list worst-first", () => {
    const report = assessFreshness(
      [
        file("mild.md", { stability: "volatile", updated: "2026-08-01" }),
        file("worst.md", { stability: "volatile", updated: "2026-01-01" }),
      ],
      TODAY,
    );
    expect(report.stale.map((r) => r.path)).toEqual(["worst.md", "mild.md"]);
  });
});

describe("readVaultFiles", () => {
  it("never reaches 99_archive or assets", () => {
    const paths = readVaultFiles().map((f) => f.path);
    expect(paths.length).toBeGreaterThan(0);
    expect(paths.some((p) => p.includes("99_archive"))).toBe(false);
    expect(paths.some((p) => p.includes("assets"))).toBe(false);
  });

  it("finds the nested canonical entries, not just top-level files", () => {
    const paths = readVaultFiles().map((f) => f.path);
    expect(paths.some((p) => p.startsWith("01_engineering/projects/"))).toBe(true);
  });
});

describe("parity with scripts/audit_freshness.py", () => {
  // The two implementations are a deliberate duplication: the CLI must work without Node,
  // the dashboard must work without Python. A drift in the thresholds would make the site
  // and the pre-commit hook disagree about what counts as stale.
  it("uses the same thresholds as the Python script", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "..", "scripts", "audit_freshness.py"),
      "utf8",
    );
    const literal = source.match(/THRESHOLDS\s*=\s*\{([^}]*)\}/);
    expect(literal, "THRESHOLDS not found in audit_freshness.py").not.toBeNull();

    const parsed: Record<string, number> = {};
    for (const [, key, value] of literal![1].matchAll(/"(\w+)":\s*(\d+)/g)) {
      parsed[key] = Number(value);
    }
    expect(parsed).toEqual(THRESHOLDS);
  });

  it("agrees with the real vault about how many files are stale", () => {
    // Not asserting zero — that would fail whenever a file legitimately ages out. Asserting
    // the report is well-formed and self-consistent.
    const report = loadFreshness(TODAY);
    expect(report.checked).toBeGreaterThan(10);
    expect(report.rows.filter((r) => r.verdict === "stale")).toHaveLength(report.stale.length);
    expect(report.rows.filter((r) => r.verdict === "unknown")).toHaveLength(
      report.unknown.length,
    );
  });
});
