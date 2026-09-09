// @vitest-environment node
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { decodePng, eachPixel, type Png } from "@/test/png";

/**
 * The notification badge is an alpha mask, and this is the only place that can tell (D-203).
 *
 * The reported bug was a white box in the status bar. Its cause was not a broken file: Android
 * discards every colour in a `badge` and paints whatever survives as opaque in the system
 * accent, so `icon-192.png` — a magenta mark on an *opaque* near-black tile — is a correct
 * picture and a completely solid stencil. It rendered as the tile, because the tile is what the
 * alpha channel says.
 *
 * That failure is invisible to every other kind of check. The file opens, decodes, is the right
 * size, and looks like a brain in any viewer. Only the alpha channel distinguishes the fix from
 * the bug, so the test reads pixels.
 *
 * The regression it guards is narrow and specific: someone regenerates the icons after redrawing
 * the mark, the badge variant is dropped or the grooves go back to being painted in the ground
 * colour, and the status bar quietly returns to a white square that nobody notices for a month.
 */

const icons = path.join(process.cwd(), "public/icons");
const read = (file: string) => decodePng(fs.readFileSync(path.join(icons, file)));

/** Fraction of pixels for which `test` holds. */
function share(png: Png, test: (pixel: [number, number, number, number]) => boolean): number {
  let hits = 0;
  let total = 0;
  for (const pixel of eachPixel(png)) {
    total += 1;
    if (test(pixel)) hits += 1;
  }
  return hits / total;
}

/** The alpha values along one row, left to right. */
function row(png: Png, y: number): number[] {
  const values: number[] = [];
  for (let x = 0; x < png.width; x++) values.push(png.pixels[(y * png.width + x) * 4 + 3]);
  return values;
}

/** How many separate runs of opaque pixels a row contains. */
function opaqueRuns(alpha: number[]): number {
  let runs = 0;
  let inside = false;
  for (const value of alpha) {
    // Half, not 255: the edges are antialiased and the grooves have soft shoulders. The
    // question is "is this pixel more mark than hole", which is what Android effectively asks.
    const opaque = value > 128;
    if (opaque && !inside) runs += 1;
    inside = opaque;
  }
  return runs;
}

describe("badge-96.png", () => {
  it("is 96 square, which is the size Chrome asks for", () => {
    const badge = read("badge-96.png");
    expect(badge.width).toBe(96);
    expect(badge.height).toBe(96);
  });

  it("carries no colour — every visible pixel is white", () => {
    // Not cosmetic. A badge that still had the magenta in it would look right in a viewer and
    // tell you nothing about whether the alpha is a stencil, which is how the original bug
    // survived being looked at.
    const badge = read("badge-96.png");
    const coloured = share(badge, ([r, g, b, a]) => a > 8 && !(r === g && g === b));
    expect(coloured).toBe(0);
  });

  it("is mostly transparent, so it is not a solid tile", () => {
    // The bug, stated as a number. A rounded square of tile is ~93% opaque; the mark itself
    // covers well under half its canvas.
    const badge = read("badge-96.png");
    const opaque = share(badge, ([, , , a]) => a > 128);
    expect(opaque).toBeLessThan(0.6);
    // And the other direction: an empty file would also pass the line above.
    expect(opaque).toBeGreaterThan(0.15);
  });

  it("has transparent corners", () => {
    const badge = read("badge-96.png");
    const at = (x: number, y: number) => badge.pixels[(y * badge.width + x) * 4 + 3];
    for (const [x, y] of [
      [0, 0],
      [95, 0],
      [0, 95],
      [95, 95],
    ]) {
      expect(at(x, y)).toBe(0);
    }
  });

  it("knocks the grooves out of the alpha rather than painting them", () => {
    // The heart of it. A groove filled with the ground colour is still opaque, and Android
    // cannot see the difference between that and solid brain — so the mark would arrive as a
    // featureless blob. A row across the middle of the mark must therefore break into several
    // separate opaque runs, one per fold it crosses.
    const badge = read("badge-96.png");
    const runs = [40, 48, 56].map((y) => opaqueRuns(row(badge, y)));
    expect(Math.max(...runs)).toBeGreaterThan(2);
  });
});

describe("both notification paths", () => {
  // Two files raise notifications and they are easy to change apart: the worker's `push`
  // listener handles the server's reminders, and `local-alert.ts` handles the app telling you
  // about its own outbox. Fixing one and not the other is the obvious way for the white box to
  // come back on half the notifications, so both are asserted together.
  const sources = {
    "sw-template.js": "src/lib/pwa/sw-template.js",
    "local-alert.ts": "src/lib/push/local-alert.ts",
  };

  for (const [name, file] of Object.entries(sources)) {
    it(`${name} gives the stencil to badge and the picture to icon`, () => {
      const source = fs.readFileSync(path.join(process.cwd(), file), "utf8");
      expect(source).toMatch(/badge:\s*"\/icons\/badge-96\.png"/);
      expect(source).toMatch(/icon:\s*"\/icons\/icon-192\.png"/);
    });
  }
});

describe("icon-192.png", () => {
  it("is still a picture, not a stencil", () => {
    // The positive control, and the reverse mistake worth guarding: pointing `icon` at the
    // badge would "fix" the status bar by making the large icon a white smear. The large icon
    // is the one place the mark is supposed to be magenta on a tile.
    const icon = read("icon-192.png");
    const magenta = share(icon, ([r, g, b, a]) => a > 200 && r > 120 && b > 100 && g < r - 40);
    expect(magenta).toBeGreaterThan(0.05);

    const opaqueCentre = icon.pixels[(96 * icon.width + 96) * 4 + 3];
    expect(opaqueCentre).toBe(255);
  });
});
