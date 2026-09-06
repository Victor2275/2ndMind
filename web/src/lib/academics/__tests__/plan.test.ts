import { describe, expect, it } from "vitest";

import { checkPlan, parsePlan, renderPlan, termLoads, TERMS } from "@/lib/academics/plan";
import type { Requirement } from "@/lib/academics/requirements";

/**
 * §5.2's checker. The property worth the most here is that **a course counts once**.
 *
 * Double-counting is the whole failure mode of a plan written by hand: one elective quietly
 * satisfying three lines, and the total coming out four courses short in the term it matters —
 * which is the term you can no longer do anything about it.
 */

const requirement = (over: Partial<Requirement>): Requirement => ({
  id: "r",
  group: "g",
  name: "n",
  needsCourses: null,
  needsUnits: null,
  selectFrom: [],
  truncated: false,
  applied: [],
  ...over,
});

describe("the file round-trips", () => {
  it("reads back exactly what it wrote", () => {
    // Editing it by hand in the repo and editing it in the app have to be the same thing, which
    // is most of the reason it is a vault file at all.
    const plan = {
      ...Object.fromEntries(TERMS.map((t) => [t, []])),
      "Winter 2027": [
        { course: "COM SCI 111", units: 4 },
        { course: "ENGR 183EW", units: 4 },
      ],
      "Fall 2027": [{ course: "COM SCI 118", units: 4 }],
    };
    expect(parsePlan(renderPlan(plan))).toEqual(plan);
  });

  it("defaults an unbracketed course to four units", () => {
    const parsed = parsePlan("## Winter 2027\n\n- COM SCI 111\n");
    expect(parsed["Winter 2027"]).toEqual([{ course: "COM SCI 111", units: 4 }]);
  });

  it("ignores a term heading it does not know", () => {
    // A hand-edit with a typo, or a term outside the track. Silently filing those under the
    // previous heading would put courses in a term nobody chose.
    const parsed = parsePlan("## Summer 2027\n\n- COM SCI 111\n");
    expect(Object.values(parsed).flat()).toEqual([]);
  });

  it("takes a line with or without a bullet, so the textarea and the file are one format", () => {
    // The planner's textareas hold one course per line with no bullet; the committed file is
    // markdown and has them. This was a real bug: the first version required the bullet, so
    // everything typed into the planner parsed as nothing and the checker never moved.
    const text = `## Winter 2027

COM SCI 111 (4)`;
    expect(parsePlan(text)["Winter 2027"]).toEqual([{ course: "COM SCI 111", units: 4 }]);
  });

  it("does not read the empty-term placeholder as a course", () => {
    // The direct consequence of making the bullet optional.
    const text = `## Winter 2027

_Nothing planned yet._`;
    expect(parsePlan(text)["Winter 2027"]).toEqual([]);
  });

  it("normalises what was typed, so casing cannot split one course into two", () => {
    expect(parsePlan("## Winter 2027\n\n- com sci  111\n")["Winter 2027"][0].course).toBe(
      "COM SCI 111",
    );
  });
});

describe("counting a course once", () => {
  it("does not let one course satisfy two requirements", () => {
    const requirements = [
      requirement({ id: "a", needsCourses: 1, selectFrom: ["COM SCI 111"] }),
      requirement({ id: "b", needsCourses: 1, selectFrom: ["COM SCI 111"] }),
    ];
    const plan = {
      ...Object.fromEntries(TERMS.map((t) => [t, []])),
      "Winter 2027": [{ course: "COM SCI 111", units: 4 }],
    };

    const coverage = checkPlan(requirements, plan);
    expect(coverage[0].satisfied).toBe(true);
    expect(coverage[1].satisfied).toBe(false);
    expect(coverage[1].coursesShort).toBe(1);
  });

  it("gives a named course to the requirement that names it, not to one that might take it", () => {
    // A truncated list could match anything, so it must not eat a course another requirement
    // specifically asked for — otherwise the specific one reports short while the vague one
    // reports satisfied, which is exactly backwards.
    const requirements = [
      requirement({ id: "vague", needsCourses: 1, truncated: true, selectFrom: ["ART HIS 20"] }),
      requirement({ id: "named", needsCourses: 1, selectFrom: ["COM SCI 111"] }),
    ];
    const plan = {
      ...Object.fromEntries(TERMS.map((t) => [t, []])),
      "Winter 2027": [{ course: "COM SCI 111", units: 4 }],
    };

    const coverage = checkPlan(requirements, plan);
    expect(coverage.find((c) => c.requirement.id === "named")?.matched).toHaveLength(1);
    expect(coverage.find((c) => c.requirement.id === "vague")?.satisfied).toBe(false);
  });

  it("keeps a maybe separate from a match", () => {
    // "This counts" and "this might count" are different claims, and rendering them the same
    // would be the planner asserting something it cannot know.
    const requirements = [
      requirement({ id: "ge", needsUnits: 4, truncated: true, selectFrom: ["ART HIS 20"] }),
    ];
    const plan = {
      ...Object.fromEntries(TERMS.map((t) => [t, []])),
      "Winter 2027": [{ course: "ART HIS 55", units: 5 }],
    };

    const coverage = checkPlan(requirements, plan);
    expect(coverage[0].matched).toHaveLength(0);
    expect(coverage[0].unverifiable).toHaveLength(1);
  });
});

describe("counting down what is left", () => {
  it("subtracts courses and units as the plan fills", () => {
    const requirements = [
      requirement({ needsCourses: 3, needsUnits: 12, selectFrom: ["COM SCI 111", "COM SCI 118"] }),
    ];
    const plan = {
      ...Object.fromEntries(TERMS.map((t) => [t, []])),
      "Winter 2027": [{ course: "COM SCI 111", units: 4 }],
      "Spring 2027": [{ course: "COM SCI 118", units: 4 }],
    };

    const [coverage] = checkPlan(requirements, plan);
    expect(coverage.coursesShort).toBe(1);
    expect(coverage.unitsShort).toBe(4);
    expect(coverage.satisfied).toBe(false);
  });

  it("never reports a negative shortfall", () => {
    const requirements = [requirement({ needsCourses: 1, selectFrom: ["COM SCI 111"] })];
    const plan = {
      ...Object.fromEntries(TERMS.map((t) => [t, []])),
      "Winter 2027": [{ course: "COM SCI 111", units: 4 }],
      "Fall 2027": [{ course: "COM SCI 111", units: 4 }],
    };
    expect(checkPlan(requirements, plan)[0].coursesShort).toBe(0);
  });
});

describe("how heavy each term is", () => {
  it("calls an empty term neither light nor heavy", () => {
    // A warning on every term of a plan nobody has started is a warning that gets ignored.
    expect(termLoads(parsePlan("")).every((t) => t.verdict === "ok")).toBe(true);
  });

  it("flags a term below the full-time floor and one above the cap", () => {
    const plan = parsePlan(
      "## Winter 2027\n\n- COM SCI 111 (4)\n\n## Spring 2027\n\n- A 1 (8)\n- B 2 (8)\n- C 3 (8)\n",
    );
    const loads = termLoads(plan);
    expect(loads.find((t) => t.term === "Winter 2027")?.verdict).toBe("light");
    expect(loads.find((t) => t.term === "Spring 2027")?.verdict).toBe("heavy");
  });

  it("adds up the units it was given rather than assuming four", () => {
    const plan = parsePlan("## Winter 2027\n\n- ANTHRO 3 (5)\n- COM SCI 111 (4)\n");
    expect(termLoads(plan).find((t) => t.term === "Winter 2027")?.units).toBe(9);
  });
});
