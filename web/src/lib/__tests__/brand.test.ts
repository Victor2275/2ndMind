import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import manifest from "@/app/manifest";
import { GROUND, GROUND_LIGHT } from "@/lib/brand";

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
  // Rewritten 2026-09-06, and it went red on its own first — which is exactly what the note
  // above predicted: "keeps this passing if a light theme adds a third, at which point this
  // test is the thing that will say so out loud". §4.2 made `:root` light and left `.dark`
  // dark, so "both agree" stopped being the truth and "each matches its own theme's constant"
  // became it (D-184).
  it("matches --background in globals.css, per theme", () => {
    const css = read("src/app/globals.css");
    const declared = [...css.matchAll(/--background:\s*(#[0-9a-f]{6})\s*;/gi)].map((m) =>
      m[1].toLowerCase(),
    );

    // Exactly two, and which is which matters: the light one is declared first, in `:root`,
    // because that is the block `next-themes` leaves alone and `.dark` is what it toggles on.
    expect(declared).toEqual([GROUND_LIGHT.toLowerCase(), GROUND.toLowerCase()]);
  });

  it("is what the manifest gives Android to build the splash screen from", () => {
    // Still the dark ground, deliberately, and unchanged by light mode. A manifest carries one
    // colour and the splash is a fraction of a second on the way into an app whose icon is
    // dark; the *page's* theme-color follows the resolved theme at runtime instead (D-184).
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
