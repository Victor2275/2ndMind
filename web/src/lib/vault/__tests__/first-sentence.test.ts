import { describe, expect, it } from "vitest";

import { firstSentence, sectionId } from "@/lib/vault/case-study";

/**
 * The opening summary block lifts one sentence per section (V4 item 6.6, Q333, D-226).
 *
 * Lifting prose is fragile by nature, so these are mostly the ways it went wrong rather than the
 * ways it goes right. The first version shipped a visibly broken row on a real project page, and
 * that case is the first test below.
 */
describe("firstSentence", () => {
  it("does not mistake a bold lead-in for a list bullet", () => {
    // The bug, exactly as it shipped. Vault prose is hard-wrapped, so dropping the first physical
    // line of a paragraph leaves the sentence starting in its middle. Every "Design decisions"
    // section in this vault opens `**Something.** The rest…`.
    const body = [
      "**Presence-based encoding over polarity-based.** With a unipolar ADC, encoding a 1 as",
      "north-up and a 0 as south-up would put half the signal below the readable floor. Encoding",
      "instead as magnet-present versus empty-slot keeps every symbol inside the window.",
    ].join("\n");

    expect(firstSentence(body)).toBe("Presence-based encoding over polarity-based.");
  });

  it("still ignores real list items", () => {
    const body =
      "- a bullet that is quite long and should not be picked up as prose\n\nThe real opening sentence lives here.";
    expect(firstSentence(body)).toBe("The real opening sentence lives here.");
  });

  it("reassembles a hard-wrapped sentence", () => {
    const body =
      "The decoder cannot count empty slots directly, so a\nknown start bit establishes t equals zero.";
    expect(firstSentence(body)).toBe(
      "The decoder cannot count empty slots directly, so a known start bit establishes t equals zero.",
    );
  });

  it("stops at the first sentence, not the first full stop", () => {
    // "10 mph." mid-sentence must not end it — the lookahead needs a space *and* a capital.
    const body = "Tracking held above 10 mph. and stayed within a decimetre throughout the run.";
    expect(firstSentence(body)).toBe(
      "Tracking held above 10 mph. and stayed within a decimetre throughout the run.",
    );
  });

  it("unwraps links and inline code rather than printing their markup", () => {
    const body =
      "The [flood fill](https://example.com) pass runs in `O(n)` over the whole maze grid.";
    expect(firstSentence(body)).toBe("The flood fill pass runs in O(n) over the whole maze grid.");
  });

  it("drops fenced code entirely", () => {
    const body =
      "```\nnot prose at all, and quite long indeed\n```\n\nThis is the sentence that should win.";
    expect(firstSentence(body)).toBe("This is the sentence that should win.");
  });

  it("returns null rather than a fragment when there is nothing usable", () => {
    // The caller hides the row on null (Q331). A two-word stub is worse than an absent row.
    expect(firstSentence("")).toBeNull();
    expect(firstSentence("Too short.")).toBeNull();
    expect(firstSentence("## Heading only")).toBeNull();
    expect(firstSentence("- just\n- a\n- list")).toBeNull();
  });

  it("returns null for a sentence too long to be a summary", () => {
    expect(firstSentence(`${"word ".repeat(80)}.`)).toBeNull();
  });
});

describe("sectionId", () => {
  it("is stable and prefixed", () => {
    expect(sectionId("What did not work")).toBe("section-what-did-not-work");
    expect(sectionId("  Results  ")).toBe("section-results");
  });

  it("survives punctuation and never produces a bare prefix", () => {
    expect(sectionId("Design decisions & trade-offs")).toBe("section-design-decisions-trade-offs");
    expect(sectionId("???")).toBe("section-untitled");
  });
});
