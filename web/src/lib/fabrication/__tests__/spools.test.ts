import { describe, expect, it } from "vitest";

import {
  describeSpool,
  fractionLeft,
  levelOf,
  needsReorder,
  swatch,
  type SpoolLike,
} from "@/lib/fabrication/spools";

/**
 * §5.1. The page exists to answer one question — *what am I about to run out of* — so the
 * arithmetic behind that answer is what is worth pinning, along with the one field that reaches
 * a stylesheet.
 */

const spool = (over: Partial<SpoolLike> = {}): SpoolLike => ({
  material: "PLA",
  brand: "Prusament",
  colourName: "Galaxy Black",
  colourHex: "#1b1b1f",
  gramsRemaining: 800,
  gramsFull: 1000,
  ...over,
});

describe("how much is left", () => {
  it("reads as a fraction of a full spool", () => {
    expect(fractionLeft(spool({ gramsRemaining: 250, gramsFull: 1000 }))).toBe(0.25);
  });

  it("survives a spool entered without a full weight", () => {
    // Dividing by zero gives Infinity, which sorts to the bottom — quietly hiding the spool
    // most likely to have been entered in a hurry and be wrong.
    expect(fractionLeft(spool({ gramsFull: 0, gramsRemaining: 500 }))).toBe(0);
    expect(Number.isFinite(fractionLeft(spool({ gramsFull: 0 })))).toBe(true);
  });

  it("clamps a spool that says it has more than it started with", () => {
    expect(fractionLeft(spool({ gramsRemaining: 1200, gramsFull: 1000 }))).toBe(1);
  });
});

describe("which spools need buying", () => {
  it("separates empty from nearly empty", () => {
    // Different actions: one is a purchase, the other is a plan for the next print.
    expect(levelOf(spool({ gramsRemaining: 0 }))).toBe("empty");
    expect(levelOf(spool({ gramsRemaining: 200, gramsFull: 1000 }))).toBe("low");
  });

  it("puts the reorder line at a quarter", () => {
    expect(levelOf(spool({ gramsRemaining: 250, gramsFull: 1000 }))).toBe("low");
    expect(levelOf(spool({ gramsRemaining: 260, gramsFull: 1000 }))).toBe("some");
  });

  it("counts both empty and low as needing a reorder", () => {
    expect(needsReorder(spool({ gramsRemaining: 0 }))).toBe(true);
    expect(needsReorder(spool({ gramsRemaining: 100, gramsFull: 1000 }))).toBe(true);
    expect(needsReorder(spool({ gramsRemaining: 900, gramsFull: 1000 }))).toBe(false);
  });
});

describe("naming a spool", () => {
  it("leads with the colour, which is how one is asked for at a printer", () => {
    expect(describeSpool(spool())).toBe("Galaxy Black PLA · Prusament");
  });

  it("copes with a spool that has almost nothing filled in", () => {
    // A rough entry now beats an exact one never, so a half-filled spool still has to render.
    expect(describeSpool(spool({ colourName: "", brand: "" }))).toBe("PLA");
    expect(describeSpool(spool({ colourName: "", brand: "", material: "" }))).toBe("Unnamed spool");
  });
});

describe("the colour that reaches a stylesheet", () => {
  /**
   * This value is interpolated into a style attribute. An unchecked string there is how a
   * colour field becomes a way to inject CSS — so it is an allowlist, and anything failing it
   * renders as a word instead.
   */
  it("accepts the two hex shapes and nothing else", () => {
    expect(swatch("#1b1b1f")).toBe("#1b1b1f");
    expect(swatch("#abc")).toBe("#abc");
    expect(swatch("  #ABC  ")).toBe("#ABC");
  });

  it("refuses anything that is not a plain hex colour", () => {
    expect(swatch("red")).toBeNull();
    expect(swatch("rgb(0,0,0)")).toBeNull();
    expect(swatch("#1b1b1f; background: url(evil)")).toBeNull();
    expect(swatch("url(javascript:alert(1))")).toBeNull();
    expect(swatch("")).toBeNull();
    expect(swatch(null)).toBeNull();
  });
});
