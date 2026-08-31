import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import manifest from "@/app/manifest";
import { GROUND } from "@/lib/brand";

const root = path.join(__dirname, "..", "..", "..");
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");

/**
 * The ground colour is written in four places that cannot see each other: a CSS custom
 * property, a metadata route, a viewport export, and a node script. Before these tests all
 * four had been typed by hand and three had drifted — the status bar was still `#0a161b`
 * from the teal palette D-002 replaced, and the manifest and icon tile were `#100a0e`.
 *
 * None of that is visible on a laptop. It shows on the phone, at launch: a teal status bar
 * above a magenta app, and a flash where the splash hands over to the first paint. That is
 * why this is a test and not a comment.
 */
describe("the ground colour is one colour", () => {
  it("matches --background on both :root and .dark in globals.css", () => {
    const css = read("src/app/globals.css");
    const declared = [...css.matchAll(/--background:\s*(#[0-9a-f]{6})\s*;/gi)].map((m) =>
      m[1].toLowerCase(),
    );

    // Two declarations today (`:root` and `.dark`) and both must agree. Asserting the set
    // rather than a count keeps this passing if a light theme adds a third — at which point
    // this test is the thing that will say so out loud rather than failing on arithmetic.
    expect(declared.length).toBeGreaterThan(0);
    expect(new Set(declared)).toEqual(new Set([GROUND]));
  });

  it("is what the manifest gives Android to build the splash screen from", () => {
    const { background_color, theme_color } = manifest();
    expect(background_color).toBe(GROUND);
    expect(theme_color).toBe(GROUND);
  });

  it("is what tints the status bar", () => {
    // Checked as source text, not by importing the module: `layout.tsx` calls
    // `next/font/local`, which only exists as a build-time transform and throws under
    // vitest. That costs nothing here — the failure this guards against is a literal hex
    // typed into the viewport export, and a literal is exactly what reading the source sees.
    const layout = read("src/app/layout.tsx");
    expect(layout).toMatch(/from "@\/lib\/brand"/);
    expect(layout).toMatch(/themeColor:\s*GROUND\s*,/);
    expect(layout).not.toMatch(/themeColor:\s*"#/);
  });

  it("is the tile the icons are rendered on", () => {
    // render-icons.mjs is plain ESM run by node, not through the bundler, so it cannot
    // import brand.ts. It carries the literal instead and this pins the literal.
    const script = read("scripts/render-icons.mjs");
    const found = script.match(/const GROUND = "(#[0-9a-f]{6})";/i);
    expect(found?.[1].toLowerCase()).toBe(GROUND);
  });
});
