import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import manifest from "@/app/manifest";
import { GROUND, GROUND_LIGHT } from "@/lib/brand";
import { DEFAULT_THEME, groundFor, themeById } from "@/lib/theme/registry";

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

  it("is joined by the accent the mark is drawn in", () => {
    // Added 2026-09-10 (D-215). The mark is `currentColor` now, so the icon's colour is stated
    // in the renderer rather than inside the drawing — which means it is a second hand-typed
    // literal in a file that cannot import, and it gets the same treatment as the first.
    //
    // This is the check that was missing on 2026-09-08: D-197 moved the default theme to carbon
    // and the tile followed it, but the mark's own magenta gradient did not, and nothing said
    // so. Pinning the accent to the registry means the next default-theme change fails here
    // until `node scripts/render-icons.mjs` has been re-run.
    const script = read("scripts/render-icons.mjs");
    const found = script.match(/const ACCENT = "(#[0-9a-f]{6})";/i);
    expect(found?.[1].toLowerCase()).toBe(themeById(DEFAULT_THEME)!.accent.toLowerCase());
  });

  it("is joined by the four colours the OG cards are drawn in", () => {
    // Added 2026-09-10 (D-218). `render-og.mjs` is plain ESM run by node, like the icon
    // renderer, so it carries literals for the same reason and gets the same pin.
    //
    // This caught a real mistake on the way in: `MUTED` had been written as `#a1a1a1`, a value
    // invented while drafting rather than taken from the palette. It cleared contrast and looked
    // right, which is exactly why nothing else would have found it — the summary line on every
    // link preview would simply have been a grey the site does not use.
    const script = read("scripts/render-og.mjs");
    const carbon = themeById(DEFAULT_THEME)!;
    const tokens = read("src/app/tokens.css");

    // The generator writes each value's hex in a trailing comment beside the oklch(), so the
    // block can be read for tokens the registry does not carry.
    // The selector with its brace, not just the name: `@custom-variant dark` lists every
    // dark theme by name at the top of the file, so slicing from the bare selector starts
    // the search above every block and reads whichever theme is declared first. That is
    // how this first ran green-then-red against `dark-magenta`’s value.
    const block = tokens.slice(tokens.indexOf(`[data-theme="${carbon.id}"] {`));
    const tokenHex = (name: string) => {
      // Read by splitting rather than by a built regex: the value is an oklch() followed by a
      // trailing comment holding the hex, and escaping that pattern through a string-built
      // RegExp is how this test first shipped matching nothing at all.
      const at = block.indexOf(`--${name}:`);
      if (at < 0) return undefined;
      const line = block.slice(
        at,
        block.indexOf(
          `
`,
          at,
        ),
      );
      return line.match(/#[0-9a-f]{6}/i)?.[0].toLowerCase();
    };

    const literal = (name: string) => {
      const found = script.match(new RegExp(`const ${name} = "(#[0-9a-f]{6})";`, "i"));
      return found?.[1].toLowerCase();
    };

    expect(literal("GROUND")).toBe(carbon.ground.toLowerCase());
    expect(literal("ACCENT")).toBe(carbon.accent.toLowerCase());
    expect(literal("FOREGROUND")).toBe(carbon.foreground.toLowerCase());
    expect(literal("MUTED")).toBe(tokenHex("muted-foreground"));
  });

  it("is joined by the light accent the favicon switches to", () => {
    const script = read("scripts/render-icons.mjs");
    const found = script.match(/const ACCENT_LIGHT = "(#[0-9a-f]{6})";/i);
    expect(found?.[1].toLowerCase()).toBe(themeById("light-teal")!.accent.toLowerCase());
  });

  it("is not painted into the mark itself", () => {
    // The drawing must stay colourless. A `fill="#..."` or a gradient stop back in brain.svg is
    // precisely the drift D-215 removed: it would override `currentColor` and the mark would
    // stop following the theme, silently and only on a phone.
    const mark = read("public/icons/brain.svg");
    expect(mark).toMatch(/fill="currentColor"/);

    // Comments are stripped first, and deliberately: the drawing's own notes name `#140a10` and
    // `#0e0e0e` while explaining the drift they came from, and a test that cannot tell markup
    // from prose would forbid writing that down.
    const markup = mark.replace(/<!--[\s\S]*?-->/g, "");
    expect(markup).not.toMatch(/<linearGradient/);
    // Only #fff and #000 may appear, and only inside the luminance mask.
    const hexes = [...markup.matchAll(/#[0-9a-f]{3,8}\b/gi)].map((m) => m[0].toLowerCase());
    expect(hexes.filter((h) => h !== "#fff" && h !== "#000")).toEqual([]);
  });
});
