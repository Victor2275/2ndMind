import { describe, expect, it } from "vitest";

import { insertUpdate, splitUpdates } from "../updates";

const CRLF = (s: string) => s.replace(/\n/g, "\r\n");

describe("splitUpdates", () => {
  it("returns the body unchanged when there is no Updates section", () => {
    const body = "# Proof\n\n## The problem\n\nSomething hard.";
    expect(splitUpdates(body)).toEqual({ body, updates: [] });
  });

  it("pulls out dated entries and removes the section from the body", () => {
    // Left in the body too, the same update would be published twice: once as raw markdown
    // under a heading, once as a dated entry.
    const { body, updates } = splitUpdates(
      "# Proof\n\n## Updates\n\n### 2026-08-20\n\nFirst thing.\n\n### 2026-08-25\n\nSecond thing.",
    );
    expect(body).toBe("# Proof");
    expect(updates).toEqual([
      { date: "2026-08-25", body: "Second thing." },
      { date: "2026-08-20", body: "First thing." },
    ]);
  });

  it("sorts newest first regardless of the order in the file", () => {
    const { updates } = splitUpdates(
      "## Updates\n\n### 2026-01-02\n\nB\n\n### 2026-09-30\n\nC\n\n### 2025-12-31\n\nA",
    );
    expect(updates.map((u) => u.date)).toEqual(["2026-09-30", "2026-01-02", "2025-12-31"]);
  });

  it("keeps two entries written on the same day in authoring order", () => {
    // Merging them would lose the boundary between two separate things.
    const { updates } = splitUpdates("## Updates\n\n### 2026-08-25\n\nA\n\n### 2026-08-25\n\nB");
    expect(updates.map((u) => u.body)).toEqual(["A", "B"]);
  });

  it("stops at the next ## heading instead of swallowing the rest of the file", () => {
    const { body, updates } = splitUpdates(
      "## Updates\n\n### 2026-08-25\n\nAn update.\n\n## Architecture\n\nHow it works.",
    );
    expect(updates).toHaveLength(1);
    expect(updates[0].body).toBe("An update.");
    expect(body).toContain("## Architecture");
    expect(body).toContain("How it works.");
  });

  it("survives CRLF, which is how the vault is stored on Windows", () => {
    // A bare \n regex silently matches nothing in these files. It has cost real debugging
    // in frontmatter.ts and public.ts already.
    const { body, updates } = splitUpdates(
      CRLF("# Proof\n\n## Updates\n\n### 2026-08-25\n\nLine one.\nLine two."),
    );
    expect(updates).toHaveLength(1);
    expect(updates[0].body).toBe(CRLF("Line one.\nLine two."));
    expect(body).toBe("# Proof");
  });

  it("keeps multi-paragraph entries whole", () => {
    const { updates } = splitUpdates("## Updates\n\n### 2026-08-25\n\nPara one.\n\nPara two.");
    expect(updates[0].body).toBe("Para one.\n\nPara two.");
  });

  it("drops an entry with a heading but nothing written under it", () => {
    // An empty dated entry on the public Working page advertises a gap, which is the same
    // reason `dropUnwritten` exists for case-study sections.
    const { updates } = splitUpdates("## Updates\n\n### 2026-08-25\n\n### 2026-08-26\n\nReal.");
    expect(updates.map((u) => u.date)).toEqual(["2026-08-26"]);
  });

  it("ignores a ### that is not a date rather than misdating it", () => {
    const { updates } = splitUpdates("## Updates\n\n### Soon\n\nNo date.\n\n### 2026-08-25\n\nB");
    expect(updates).toEqual([{ date: "2026-08-25", body: "B" }]);
  });
});

describe("insertUpdate", () => {
  it("creates the section when the file has none", () => {
    const next = insertUpdate("# Proof\n\nIntro.\n", "2026-08-25", "Shipped it.");
    expect(next).toContain("## Updates");
    expect(splitUpdates(next).updates).toEqual([{ date: "2026-08-25", body: "Shipped it." }]);
    expect(splitUpdates(next).body).toContain("Intro.");
  });

  it("prepends within an existing section, so newest sits under the heading", () => {
    // Whoever opens the file to write the next one reads top-down.
    const file = "## Updates\n\n### 2026-08-20\n\nOld.\n";
    const next = insertUpdate(file, "2026-08-25", "New.");
    expect(next.indexOf("New.")).toBeLessThan(next.indexOf("Old."));
    expect(splitUpdates(next).updates.map((u) => u.date)).toEqual(["2026-08-25", "2026-08-20"]);
  });

  it("does not disturb sections after Updates", () => {
    const file = "## Updates\n\n### 2026-08-20\n\nOld.\n\n## Architecture\n\nHow it works.\n";
    const parsed = splitUpdates(insertUpdate(file, "2026-08-25", "New."));
    expect(parsed.body).toContain("## Architecture");
    expect(parsed.updates).toHaveLength(2);
  });

  it("round-trips through CRLF without mixing line endings", () => {
    const next = insertUpdate(CRLF("## Updates\n\n### 2026-08-20\n\nOld.\n"), "2026-08-25", "New.");
    expect(next).not.toMatch(/[^\r]\n/);
  });

  it("refuses a non-ISO date", () => {
    // The date is the sort key and the public label. Free text would sort wrong and read wrong.
    expect(() => insertUpdate("# P", "Aug 25", "x")).toThrow(/ISO date/);
  });

  it("refuses an empty update", () => {
    expect(() => insertUpdate("# P", "2026-08-25", "   ")).toThrow(/something written/);
  });
});
