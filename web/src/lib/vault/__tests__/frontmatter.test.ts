import { describe, expect, it } from "vitest";

import {
  appendToSection,
  getLabelledBullet,
  setLabelledBullet,
  bumpUpdated,
  getFrontmatterField,
  replaceSection,
  setFrontmatterField,
  splitFrontmatter,
} from "../frontmatter";

/**
 * The write path's sharp edges. Every case here corresponds to a way a vault file could be
 * quietly corrupted by an edit made through the private site.
 */

const LF = [
  "---",
  "updated: 2026-01-01",
  "domain: operations",
  "title: A note about updated: fields",
  "---",
  "",
  "# Title",
  "",
  "## Goals",
  "",
  "- old goal",
  "",
  "## Rules",
  "",
  "- keep this",
  "",
].join("\n");

const CRLF = LF.replace(/\n/g, "\r\n");

describe("splitFrontmatter", () => {
  it("splits an LF file", () => {
    const parts = splitFrontmatter(LF);
    expect(parts?.eol).toBe("\n");
    expect(parts?.frontmatter).toContain("domain: operations");
    expect(parts?.body).toContain("# Title");
  });

  it("splits a CRLF file and reports the right line ending", () => {
    const parts = splitFrontmatter(CRLF);
    expect(parts?.eol).toBe("\r\n");
    expect(parts?.body).toContain("# Title");
  });

  it("returns null when there is no frontmatter", () => {
    expect(splitFrontmatter("# Just a heading")).toBeNull();
  });
});

describe("bumpUpdated", () => {
  it("replaces the updated field", () => {
    const out = bumpUpdated(LF, "2026-08-21");
    expect(getFrontmatterField(out, "updated")).toBe("2026-08-21");
  });

  it("works on CRLF files", () => {
    // A bare LF pattern silently matches nothing against a CRLF file. This is the exact
    // bug that shipped once already in stripInternalSections.
    const out = bumpUpdated(CRLF, "2026-08-21");
    expect(getFrontmatterField(out, "updated")).toBe("2026-08-21");
    expect(out).toContain("\r\n");
  });

  it("does not touch a colon-bearing value on another key", () => {
    const out = bumpUpdated(LF, "2026-08-21");
    expect(out).toContain("title: A note about updated: fields");
  });

  it("leaves the body untouched", () => {
    const out = bumpUpdated(LF, "2026-08-21");
    expect(out).toContain("- old goal");
    expect(out).toContain("- keep this");
  });

  it("adds the field when it is missing", () => {
    const noUpdated = LF.replace("updated: 2026-01-01\n", "");
    const out = bumpUpdated(noUpdated, "2026-08-21");
    expect(getFrontmatterField(out, "updated")).toBe("2026-08-21");
  });

  it("throws rather than corrupting a file with no frontmatter", () => {
    expect(() => bumpUpdated("# Nothing here")).toThrow(/no frontmatter/);
  });
});

describe("setFrontmatterField", () => {
  it("round-trips through getFrontmatterField", () => {
    const out = setFrontmatterField(LF, "domain", "physical");
    expect(getFrontmatterField(out, "domain")).toBe("physical");
  });

  it("keeps the file parseable after an edit", () => {
    const out = setFrontmatterField(LF, "domain", "physical");
    expect(splitFrontmatter(out)).not.toBeNull();
  });
});

describe("replaceSection", () => {
  it("replaces only the named section", () => {
    const out = replaceSection(LF, "Goals", "- brand new goal");
    expect(out).toContain("- brand new goal");
    expect(out).not.toContain("- old goal");
    expect(out).toContain("- keep this");
  });

  it("keeps the heading itself", () => {
    const out = replaceSection(LF, "Goals", "- x");
    expect(out).toContain("## Goals");
    expect(out).toContain("## Rules");
  });

  it("works on CRLF and does not mix line endings", () => {
    const out = replaceSection(CRLF, "Goals", "- brand new goal");
    expect(out).toContain("- brand new goal");
    // No lone LF should survive: every newline must be preceded by a CR.
    expect(/[^\r]\n/.test(out)).toBe(false);
  });

  it("throws on a missing section rather than appending silently", () => {
    expect(() => replaceSection(LF, "Nonexistent", "x")).toThrow(/no "## Nonexistent"/);
  });

  it("handles headings containing regex metacharacters", () => {
    const doc = ["## Goals (weekly)", "", "- a", ""].join("\n");
    expect(replaceSection(doc, "Goals (weekly)", "- b")).toContain("- b");
  });
});

describe("appendToSection", () => {
  it("keeps existing content and adds after it", () => {
    const out = appendToSection(LF, "Goals", "- second goal");
    expect(out).toContain("- old goal");
    expect(out).toContain("- second goal");
    expect(out.indexOf("- old goal")).toBeLessThan(out.indexOf("- second goal"));
  });

  it("does not bleed into the next section", () => {
    const out = appendToSection(LF, "Goals", "- second goal");
    expect(out.indexOf("- second goal")).toBeLessThan(out.indexOf("## Rules"));
  });
});

describe("setLabelledBullet", () => {
  const doc = [
    "## Goals",
    "",
    "- **Engineering / Career:** old eng",
    "- **Athletics:** old ath",
    "",
  ].join("\n");

  it("replaces only the named bullet", () => {
    const out = setLabelledBullet(doc, "Engineering / Career", "new eng");
    expect(getLabelledBullet(out, "Engineering / Career")).toBe("new eng");
    expect(getLabelledBullet(out, "Athletics")).toBe("old ath");
  });

  it("keeps the label and its markdown bolding intact", () => {
    const out = setLabelledBullet(doc, "Athletics", "erg 3x/week");
    expect(out).toContain("- **Athletics:** erg 3x/week");
  });

  it("does not reinterpret $& in the new value as a backreference", () => {
    // A plain string replacement would expand these into the matched text.
    const out = setLabelledBullet(doc, "Athletics", "cost $50 & rising, $& $1");
    expect(getLabelledBullet(out, "Athletics")).toBe("cost $50 & rising, $& $1");
  });

  it("escapes regex metacharacters in the label", () => {
    const tricky = "- **C++ (advanced):** yes";
    expect(getLabelledBullet(tricky, "C++ (advanced)")).toBe("yes");
    expect(setLabelledBullet(tricky, "C++ (advanced)", "no")).toContain("- **C++ (advanced):** no");
  });

  it("does not match a different label that shares a prefix", () => {
    const two = ["- **Athletics:** a", "- **Athletics Extra:** b"].join("\n");
    expect(getLabelledBullet(two, "Athletics")).toBe("a");
    expect(getLabelledBullet(two, "Athletics Extra")).toBe("b");
  });

  it("throws on a missing label rather than writing nothing silently", () => {
    expect(() => setLabelledBullet(doc, "Nonexistent", "x")).toThrow(/no bullet labelled/);
  });

  it("returns null for a missing label", () => {
    expect(getLabelledBullet(doc, "Nonexistent")).toBeNull();
  });
});
