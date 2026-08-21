import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  addChecklistItem,
  getChecklistItems,
  removeChecklistItem,
  setChecklistItem,
} from "../checklist";

const HEADING = "3. Academic Tracker (Secondary to Canvas)";

function doc(items: string[], eol = "\n") {
  return [
    "---",
    "updated: 2026-08-21",
    "stability: volatile",
    "---",
    "",
    "# Current Sprint",
    "",
    "## 1. Active Sprint Goals",
    "",
    "- **Engineering / Career:** ship it",
    "",
    `## ${HEADING}`,
    "",
    "*Use this space to track midterms.*",
    ...items,
    "",
  ].join(eol);
}

describe("getChecklistItems", () => {
  it("reads ticked and unticked items", () => {
    const raw = doc(["- [ ] CS 131 midterm", "- [x] M51A lab 1"]);
    expect(getChecklistItems(raw, HEADING)).toEqual([
      { text: "CS 131 midterm", done: false },
      { text: "M51A lab 1", done: true },
    ]);
  });

  it("ignores blank placeholder rows", () => {
    // The sprint file ships with two of these; they are not items.
    expect(getChecklistItems(doc(["- [ ] ", "- [ ]"]), HEADING)).toEqual([]);
  });

  it("returns nothing for a heading that is not there", () => {
    expect(getChecklistItems(doc(["- [ ] a"]), "No Such Section")).toEqual([]);
  });

  it("does not read items out of a neighbouring section", () => {
    const raw = doc(["- [ ] mine"]) + "\n## 4. Other\n\n- [ ] not mine\n";
    expect(getChecklistItems(raw, HEADING).map((i) => i.text)).toEqual(["mine"]);
  });

  it("reads CRLF files, which is what Windows writes", () => {
    const items = getChecklistItems(doc(["- [ ] CS 131 midterm"], "\r\n"), HEADING);
    expect(items).toEqual([{ text: "CS 131 midterm", done: false }]);
    expect(items[0].text).not.toMatch(/\r/);
  });
});

describe("addChecklistItem", () => {
  it("fills the first blank placeholder rather than appending past it", () => {
    const raw = doc(["- [ ] ", "- [ ]"]);
    const items = getChecklistItems(addChecklistItem(raw, HEADING, "CS 131 midterm"), HEADING);
    expect(items).toEqual([{ text: "CS 131 midterm", done: false }]);
  });

  it("appends once the placeholders are used up", () => {
    let raw = doc(["- [ ] ", "- [ ]"]);
    raw = addChecklistItem(raw, HEADING, "first");
    raw = addChecklistItem(raw, HEADING, "second");
    raw = addChecklistItem(raw, HEADING, "third");
    expect(getChecklistItems(raw, HEADING).map((i) => i.text)).toEqual([
      "first",
      "second",
      "third",
    ]);
  });

  it("leaves the rest of the file alone", () => {
    const raw = doc(["- [ ] existing"]);
    const updated = addChecklistItem(raw, HEADING, "new one");
    expect(updated).toContain("- **Engineering / Career:** ship it");
    expect(updated).toContain("## 1. Active Sprint Goals");
    expect(updated).toContain("*Use this space to track midterms.*");
  });

  it("preserves CRLF line endings", () => {
    const updated = addChecklistItem(doc(["- [ ] a"], "\r\n"), HEADING, "b");
    expect(updated).toContain("\r\n");
    expect(updated.split("\r\n").length).toBeGreaterThan(5);
    // A stray lone \n would mean the file now mixes endings.
    expect(/[^\r]\n/.test(updated)).toBe(false);
  });

  it("refuses an empty item", () => {
    expect(() => addChecklistItem(doc([]), HEADING, "   ")).toThrow(/empty/);
  });

  it("throws when the section does not exist", () => {
    expect(() => addChecklistItem(doc([]), "Nope", "x")).toThrow(/no "## Nope" section/);
  });

  it("does not treat regex metacharacters in the heading as a pattern", () => {
    // The real heading contains parentheses and a dot.
    const raw = doc(["- [ ] a"]);
    expect(() => addChecklistItem(raw, HEADING, "b")).not.toThrow();
  });

  it("stores text containing $& literally", () => {
    // The backreference trap: a naive string replacement would expand this.
    const updated = addChecklistItem(doc([]), HEADING, "read $& chapter");
    expect(getChecklistItems(updated, HEADING)[0].text).toBe("read $& chapter");
  });
});

describe("setChecklistItem", () => {
  it("ticks an item", () => {
    const updated = setChecklistItem(doc(["- [ ] CS 131 midterm"]), HEADING, "CS 131 midterm", true);
    expect(getChecklistItems(updated, HEADING)).toEqual([
      { text: "CS 131 midterm", done: true },
    ]);
  });

  it("unticks an item", () => {
    const updated = setChecklistItem(doc(["- [x] done thing"]), HEADING, "done thing", false);
    expect(getChecklistItems(updated, HEADING)[0].done).toBe(false);
  });

  it("touches only the matching item", () => {
    const raw = doc(["- [ ] one", "- [ ] two", "- [ ] three"]);
    const items = getChecklistItems(setChecklistItem(raw, HEADING, "two", true), HEADING);
    expect(items).toEqual([
      { text: "one", done: false },
      { text: "two", done: true },
      { text: "three", done: false },
    ]);
  });

  it("throws rather than silently doing nothing when the item is gone", () => {
    // Silence here would look like a successful save in the UI while nothing changed.
    expect(() => setChecklistItem(doc(["- [ ] a"]), HEADING, "b", true)).toThrow(/no checklist/);
  });

  it("handles text with regex metacharacters", () => {
    const raw = doc(["- [ ] review (a+b)* notes"]);
    const updated = setChecklistItem(raw, HEADING, "review (a+b)* notes", true);
    expect(getChecklistItems(updated, HEADING)[0].done).toBe(true);
  });
});

describe("removeChecklistItem", () => {
  it("removes one item and leaves the others", () => {
    const raw = doc(["- [ ] one", "- [x] two", "- [ ] three"]);
    const items = getChecklistItems(removeChecklistItem(raw, HEADING, "two"), HEADING);
    expect(items.map((i) => i.text)).toEqual(["one", "three"]);
  });

  it("throws when nothing matches", () => {
    expect(() => removeChecklistItem(doc(["- [ ] a"]), HEADING, "b")).toThrow(/no checklist/);
  });

  it("keeps the section heading even when emptied", () => {
    const updated = removeChecklistItem(doc(["- [ ] only"]), HEADING, "only");
    expect(updated).toContain(`## ${HEADING}`);
    expect(getChecklistItems(updated, HEADING)).toEqual([]);
  });
});

describe("round trip against the real sprint file shape", () => {
  it("adds, ticks, and removes without disturbing the goals section", () => {
    let raw = doc(["- [ ] ", "- [ ]"]);
    raw = addChecklistItem(raw, HEADING, "CS 131 midterm");
    raw = addChecklistItem(raw, HEADING, "M51A project");
    raw = setChecklistItem(raw, HEADING, "CS 131 midterm", true);
    raw = removeChecklistItem(raw, HEADING, "M51A project");

    expect(getChecklistItems(raw, HEADING)).toEqual([
      { text: "CS 131 midterm", done: true },
    ]);
    expect(raw).toContain("- **Engineering / Career:** ship it");
    expect(raw).toMatch(/^---\r?\nupdated: 2026-08-21/);
  });
});

describe("against the real current_sprint.md", () => {
  // The fixtures above all use a heading I typed. This reads the actual vault file, so a
  // renamed or re-numbered heading fails here instead of silently doing nothing in the UI.
  const raw = fs.readFileSync(
    path.join(process.cwd(), "..", "context", "04_operations", "current_sprint.md"),
    "utf8",
  );

  it("finds the tracker section in the real file", () => {
    expect(() => addChecklistItem(raw, HEADING, "probe")).not.toThrow();
  });

  it("adds an item without disturbing the sprint goals or the frontmatter", () => {
    const updated = addChecklistItem(raw, HEADING, "CS 131 midterm");

    expect(getChecklistItems(updated, HEADING).map((i) => i.text)).toContain("CS 131 midterm");
    expect(updated).toContain("## 1. Active Sprint Goals");
    expect(updated).toContain("**Engineering / Career:**");
    expect(updated).toMatch(/^---\r?\nupdated:/);
    // Everything outside the tracker section must be byte-identical.
    const cut = (t: string) => t.slice(0, t.indexOf("## " + HEADING));
    expect(cut(updated)).toBe(cut(raw));
  });

  it("does not change the file's line endings", () => {
    const crlfBefore = (raw.match(/\r\n/g) ?? []).length;
    const updated = addChecklistItem(raw, HEADING, "probe");
    const crlfAfter = (updated.match(/\r\n/g) ?? []).length;
    // One line added, so at most one more CRLF — never a wholesale conversion.
    expect(Math.abs(crlfAfter - crlfBefore)).toBeLessThanOrEqual(2);
  });
});
