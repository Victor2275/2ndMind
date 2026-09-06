import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  listNames,
  parseAudit,
  parseSelectFrom,
  type Requirement,
} from "@/lib/academics/requirements";

/**
 * §5.2 reads the real audit rather than a fixture, because the file is regenerated from a fresh
 * DARS whenever Victor saves one — and the failure worth catching is the parser quietly
 * returning nothing after a regeneration changes the shape.
 */
const audit = readFileSync(
  path.join(process.cwd(), "..", "context", "01_engineering", "degree_audit.md"),
  "utf8",
);

const find = (requirements: Requirement[], fragment: string) =>
  requirements.find((r) => r.name.includes(fragment));

describe("reading the real audit", () => {
  const requirements = parseAudit(audit);

  it("finds the outstanding requirements and nothing that is already met", () => {
    // The frontmatter says 14 unfulfilled. This will not match exactly — some of those are
    // sub-requirements the generator flattens — but zero, or forty, means the shape changed.
    expect(requirements.length).toBeGreaterThan(5);
    expect(requirements.length).toBeLessThan(30);
    for (const requirement of requirements) {
      expect(
        requirement.needsCourses !== null || requirement.needsUnits !== null,
        requirement.name,
      ).toBe(true);
    }
  });

  it("reads a count of courses", () => {
    expect(find(requirements, "TWELVE COM SCI")?.needsCourses).toBe(8);
  });

  it("reads units and courses together where the audit gives both", () => {
    const electives = find(requirements, "3 COMPUTER SCIENCE ELECTIVES");
    expect(electives?.needsUnits).toBe(12);
    expect(electives?.needsCourses).toBe(3);
  });

  it("carries what already counts, with its term and grade", () => {
    const applied = find(requirements, "TWELVE COM SCI")?.applied ?? [];
    expect(applied.map((a) => a.course)).toContain("COM SCI 131");
    expect(applied.find((a) => a.course === "EC ENGR 102")?.grade).toBe("IP");
  });

  it("skips the sections that are history rather than something to plan", () => {
    // Latin honours and advanced-standing credit are both listed with "Applied:" lines and
    // would otherwise parse as requirements to satisfy.
    expect(requirements.some((r) => r.group.includes("LATIN HONORS"))).toBe(false);
    expect(requirements.some((r) => r.group.includes("ADVANCED STANDING"))).toBe(false);
  });
});

describe("the course lists", () => {
  it("carries a department across the numbers that follow it", () => {
    // "COM SCI 111 , 118" means COM SCI 118, not a course called 118 — and the department has
    // to *stop* at the next one, or "EC ENGR 100" becomes "COM SCI EC ENGR 100". The first
    // version did exactly that.
    const { codes } = parseSelectFrom("COM SCI 111 , 118 , M151B EC ENGR 100 , 115C");
    expect(codes).toContain("COM SCI 111");
    expect(codes).toContain("COM SCI 118");
    expect(codes).toContain("COM SCI M151B");
    expect(codes).toContain("EC ENGR 100");
    expect(codes).toContain("EC ENGR 115C");
    expect(codes.every((c) => !c.includes("COM SCI EC"))).toBe(true);
  });

  it("keeps a single-letter department word, which the first version dropped", () => {
    // "AN N EA 10" is a real department. A rule that needs two letters turns it into "AN EA 10".
    const { codes } = parseSelectFrom("AN N EA 10 , 12W");
    expect(codes).toContain("AN N EA 10");
  });

  it("keeps a range whole rather than inventing the numbers inside it", () => {
    // Expanding "111 TO 187" would assert that COM SCI 143 exists. It might not.
    const { codes } = parseSelectFrom("COM SCI 111 TO 187 , 188");
    expect(codes.some((c) => c.includes("TO"))).toBe(true);
    expect(codes).not.toContain("COM SCI 143");
  });

  it("notices when the generator truncated the list", () => {
    const { truncated } = parseSelectFrom("ART HIS 20 , 22 , 23, … and ~235 more (see the audit)");
    expect(truncated).toBe(true);
  });
});

describe("what it admits it cannot check", () => {
  /**
   * The GE lists run past two hundred courses and are cut short in the generated file. A checker
   * that rejects a valid course because the parser dropped it is worse than one that says it
   * cannot tell — Victor's call, and the reason `listNames` has three answers rather than two.
   */
  const base: Requirement = {
    id: "x",
    group: "g",
    name: "n",
    needsCourses: 1,
    needsUnits: null,
    selectFrom: ["COM SCI 111", "COM SCI 118"],
    truncated: false,
    applied: [],
  };

  it("says yes for a course the list names", () => {
    expect(listNames(base, "com sci 118")).toBe(true);
    expect(listNames(base, "COM SCI 118")).toBe(true);
  });

  it("says no for one it does not, when the list is complete", () => {
    expect(listNames(base, "COM SCI 130")).toBe(false);
  });

  it("says it cannot tell when the list was truncated", () => {
    expect(listNames({ ...base, truncated: true }, "ART HIS 23")).toBeNull();
  });

  it("says it cannot tell when the list contains a range", () => {
    expect(listNames({ ...base, selectFrom: ["COM SCI 111 TO 187"] }, "COM SCI 143")).toBeNull();
  });

  it("says it cannot tell when there is no list at all", () => {
    expect(listNames({ ...base, selectFrom: [] }, "ENGR 183EW")).toBeNull();
  });
});
