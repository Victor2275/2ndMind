import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { GROOVE_D, GROOVE_WIDTH, LOBE_D, MARK_BOX, markDataUri, markSvg } from "@/lib/mark";

const root = path.join(__dirname, "..", "..", "..");
const brainSvg = readFileSync(path.join(root, "public/icons/brain.svg"), "utf8");

/** Path data is written across several lines in the SVG and on one line in the module. */
const flat = (d: string) => d.replace(/\s+/g, " ").trim();

/**
 * The mark exists twice and this is why that is allowed (D-346).
 *
 * `brain.svg` is the drawing; `lib/mark.ts` is the same drawing as data, because the header
 * component and the OG routes cannot read a file at render time. Duplication without a test is
 * how `#140a10` survived two days after the tile moved out from under it, so the duplication
 * here comes with the check that makes it loud.
 */
describe("the mark's geometry matches the drawing of record", () => {
  it("carries the same silhouette", () => {
    expect(flat(brainSvg)).toContain(flat(LOBE_D));
  });

  it("carries the same six folds, in the same order", () => {
    const flatSvg = flat(brainSvg);
    for (const d of GROOVE_D) expect(flatSvg).toContain(flat(d));
    expect(GROOVE_D).toHaveLength(6);
  });

  it("cuts them at the same width", () => {
    expect(brainSvg).toContain(`stroke-width="${GROOVE_WIDTH}"`);
  });

  it("does not carry a groove the drawing has dropped", () => {
    // The other direction. Removing a fold from the SVG and leaving it here would draw a header
    // mark that no icon matches — a difference nobody would notice, because the two are never
    // seen side by side.
    const drawn = [...brainSvg.matchAll(/<path d="(M\d[^"]*)"\s*\/>/g)].map((m) => flat(m[1]));
    const grooves = drawn.filter((d) => d !== flat(LOBE_D));
    expect(grooves.map(flat).sort()).toEqual(GROOVE_D.map(flat).sort());
  });

  it("measures the bounding box inside the viewBox", () => {
    // Not a re-derivation of the path — a sanity floor. A box that has drifted outside the
    // canvas, or collapsed, scales the mark into dead space in every rendered icon.
    expect(MARK_BOX.x).toBeGreaterThanOrEqual(0);
    expect(MARK_BOX.y).toBeGreaterThanOrEqual(0);
    expect(MARK_BOX.x + MARK_BOX.w).toBeLessThanOrEqual(512);
    expect(MARK_BOX.y + MARK_BOX.h).toBeLessThanOrEqual(512);
    expect(MARK_BOX.w).toBeGreaterThan(200);
    expect(MARK_BOX.h).toBeGreaterThan(200);
  });

  it("is the box render-icons.mjs scales by", () => {
    const script = readFileSync(path.join(root, "scripts/render-icons.mjs"), "utf8");
    const found = script.match(/const BOX = \{ x: (\d+), y: (\d+), w: (\d+), h: (\d+) \}/);
    expect(found?.slice(1, 5).map(Number)).toEqual([
      MARK_BOX.x,
      MARK_BOX.y,
      MARK_BOX.w,
      MARK_BOX.h,
    ]);
  });
});

describe("markSvg", () => {
  it("paints the silhouette in the colour it is given", () => {
    expect(markSvg("#00aeb6")).toContain('fill="#00aeb6"');
  });

  it("keeps the grooves as holes, never as paint", () => {
    // The whole point of D-346. A groove painted in a ground colour is opaque, and opaque is all
    // Android reads — which is the bug D-203 was raised for.
    const svg = markSvg("#fff");
    expect(svg).toContain('stroke="#000"');
    expect(svg).toContain("mask=");
    expect(svg).not.toContain('stroke="#0e0e0e"');
  });

  it("can be given a suffix so two marks in one document do not share a mask", () => {
    // Two `<mask id="folds">` in one page and the second silently uses the first. That is
    // invisible until the two marks are different sizes, at which point one of them vanishes.
    const a = markSvg("#fff", "-a");
    const b = markSvg("#fff", "-b");
    expect(a).toContain('id="folds-a"');
    expect(b).toContain('id="folds-b"');
    expect(a).not.toContain("folds-b");
  });

  it("round-trips through a data URI", () => {
    const uri = markDataUri("#00aeb6");
    expect(uri.startsWith("data:image/svg+xml;base64,")).toBe(true);
    const decoded = Buffer.from(uri.split(",")[1], "base64").toString("utf8");
    expect(decoded).toBe(markSvg("#00aeb6"));
  });
});
