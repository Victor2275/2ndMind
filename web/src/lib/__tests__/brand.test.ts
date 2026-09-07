import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import manifest from "@/app/manifest";
import { GROUND, GROUND_LIGHT } from "@/lib/brand";
import { DEFAULT_THEME, groundFor } from "@/lib/theme/registry";

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
  // Rewritten again 2026-09-07 (D-194). The palettes moved out of `globals.css` into the
  // generated `tokens.css`, there are five of them rather than two, and the values are OKLCH
  // rather than hex — so "the first --background is light and the second is dark" stopped being
  // true in every particular. `lib/theme/__tests__/tokens.test.ts` now checks every theme's
  // ground against the generated CSS by converting the colour; what is left here is the part
  // that is genuinely about *this* module: that the two exported constants still name the right
  // themes.
  it("exports the default theme's ground and the light theme's", () => {
    expect(GROUND).toBe(groundFor(DEFAULT_THEME));
    expect(GROUND_LIGHT).toBe(groundFor("light-teal"));
    expect(GROUND).not.toBe(GROUND_LIGHT);
  });

  it("is not a hand-typed literal any more", () => {
    // The drift this whole file exists to stop began with a hex typed into a second place.
    const source = read("src/lib/brand.ts");
    expect(source).toMatch(/from "@\/lib\/theme\/registry"/);
    expect(source).not.toMatch(/=\s*"#[0-9a-f]{6}"/i);
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
