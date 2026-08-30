import { describe, expect, it } from "vitest";

import { isCaseStudy, roleFor, splitCaseStudy } from "../case-study";

/**
 * The states that matter here are the *partial* ones. `solenoid-bit-reader` is the only
 * project with real content in more than one section, and it is one section from complete, so
 * building the design against it alone would leave the half-written cases — which is most of
 * the portfolio until the write-ups land — unverified. These are those cases.
 */

const FULL = [
  "## The problem",
  "",
  "Faraday induction gives a voltage proportional to the rate of change of flux.",
  "",
  "## Architecture",
  "",
  "A 387-turn coil into an LM358N at 20x gain.",
  "",
  "## What did not work",
  "",
  "Polarity encoding put half the signal below the ADC floor.",
  "",
  "## Measured results",
  "",
  "Four sequences decoded at 100% accuracy, with a 40 mm resolution limit.",
].join("\n");

describe("roleFor", () => {
  it("maps both names for the two sections that have them", () => {
    // D-073 kept solenoid-bit-reader's own wording rather than giving it duplicate sections.
    expect(roleFor("Architecture")).toBe("architecture");
    expect(roleFor("Design decisions")).toBe("architecture");
    expect(roleFor("Measured results")).toBe("results");
    expect(roleFor("Results")).toBe("results");
  });

  it("is case- and whitespace-insensitive", () => {
    expect(roleFor("  THE PROBLEM  ")).toBe("problem");
  });

  it("returns null for headings outside the skeleton", () => {
    // Must fall through to plain prose, not be forced into a treatment.
    expect(roleFor("Post-mortem")).toBeNull();
    expect(roleFor("Notes")).toBeNull();
  });
});

describe("splitCaseStudy", () => {
  it("splits a complete case study into its four sections, in file order", () => {
    const sections = splitCaseStudy(FULL);
    expect(sections.map((s) => s.role)).toEqual(["problem", "architecture", "failure", "results"]);
    expect(sections[3].body).toContain("100% accuracy");
  });

  it("keeps each section's own heading rather than a canonical one", () => {
    const sections = splitCaseStudy("## Design decisions\n\nPresence-based encoding.");
    expect(sections[0].role).toBe("architecture");
    expect(sections[0].heading).toBe("Design decisions");
  });

  it("handles CRLF, which half the vault uses", () => {
    const crlf = "## The problem\r\n\r\nA constraint.\r\n\r\n## Results\r\n\r\n100% accuracy.";
    const sections = splitCaseStudy(crlf);
    expect(sections.map((s) => s.role)).toEqual(["problem", "results"]);
    expect(sections[1].body).toBe("100% accuracy.");
  });

  it("returns the preamble as a roleless section", () => {
    const sections = splitCaseStudy("An opening line.\n\n## The problem\n\nA constraint.");
    expect(sections[0]).toMatchObject({ role: null, heading: null, body: "An opening line." });
    expect(sections[1].role).toBe("problem");
  });

  it("drops an empty preamble but never an empty heading", () => {
    const sections = splitCaseStudy("\n\n## The problem\n\nA constraint.");
    expect(sections).toHaveLength(1);
    expect(sections[0].role).toBe("problem");
  });

  it("does not treat a ### subheading as a section boundary", () => {
    const sections = splitCaseStudy("## Architecture\n\n### The coil\n\nWound by hand.");
    expect(sections).toHaveLength(1);
    expect(sections[0].body).toContain("### The coil");
  });

  it("keeps an unrecognised heading in place, with a null role", () => {
    const sections = splitCaseStudy(
      "## The problem\n\nA.\n\n## Post-mortem\n\nB.\n\n## Measured results\n\n1 ms.",
    );
    expect(sections.map((s) => s.role)).toEqual(["problem", null, "results"]);
    expect(sections[1].heading).toBe("Post-mortem");
  });
});

describe("isCaseStudy", () => {
  it("is true for a single written section", () => {
    // Most of the portfolio is in this state until the write-ups land, and it has to read as
    // deliberate rather than as a page that gave up.
    expect(isCaseStudy(splitCaseStudy("## The problem\n\nA constraint."))).toBe(true);
  });

  it("is false for a body with no skeleton headings at all", () => {
    // An older entry must render exactly as it always has.
    expect(isCaseStudy(splitCaseStudy("Just a paragraph.\n\n## Notes\n\nInternal."))).toBe(false);
  });
});
