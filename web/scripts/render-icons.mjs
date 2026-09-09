/**
 * Renders the app icons from `public/icons/brain.svg`.
 *
 * Playwright is already a dev dependency (it drives `npm run shots`), so this needs no new
 * tooling and — like everything else in Phase 0 — runs with the network off.
 *
 * Three shapes come out of one source, and the differences matter:
 *
 *   any       — the mark on a rounded near-black tile, drawn edge to edge. This is what a
 *               browser shows in a tab and what a launcher uses when it does not mask.
 *   maskable  — the same mark on a full-bleed square, scaled to ~62% so the whole thing sits
 *               inside the safe circle. Android's One UI crops icons to a squircle; a
 *               maskable icon that fills its canvas gets its edges shaved off.
 *   badge     — the notification small icon, and the only one that is not a picture at all.
 *               See `BADGE` below; it is white-on-transparent because Android reads nothing
 *               but its alpha channel (D-203).
 *
 * Run: node scripts/render-icons.mjs
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

const here = path.dirname(fileURLToPath(import.meta.url));
const iconsDir = path.join(here, "..", "public", "icons");

// Must equal `GROUND` in src/lib/brand.ts, which is the default theme's ground in
// src/lib/theme/registry.ts and is generated into src/app/tokens.css. A test pins
// all three together. This file is run by node rather than the bundler, so it cannot import
// the constant and carries the literal instead.
const GROUND = "#0e0e0e";

/** The mark's own markup, lifted out of the source file so both variants share one drawing. */
async function markBody() {
  const svg = await readFile(path.join(iconsDir, "brain.svg"), "utf8");
  const start = svg.indexOf("<defs>");
  const end = svg.lastIndexOf("</svg>");
  if (start < 0 || end < 0) throw new Error("brain.svg is not in the expected shape");
  return svg.slice(start, end);
}

/**
 * The mark's bounding box inside the 512 viewBox, measured from the path data in brain.svg.
 * The profile drawing is off-centre in both axes — it leans right and hangs low, because the
 * cerebellum and stem sit at the bottom-right. Scaling the whole canvas instead of the box is
 * what left the first render floating in dead space, so this must be re-measured whenever the
 * mark is redrawn. Fold strokes are ignored: they are cut in the tile colour, so overshoot is
 * invisible and does not belong in the box.
 */
const BOX = { x: 68, y: 102, w: 382, h: 302 };

/**
 * The notification small icon is an alpha channel, not a picture (D-203).
 *
 * Android throws away every colour in a `badge` and paints whatever is left opaque in the
 * system accent. Handing it `icon-192.png` — a magenta mark on an opaque near-black tile —
 * therefore produces a solid white rounded square in the status bar, which is exactly what
 * was reported. Nothing about the file is wrong; it is being read as a stencil.
 *
 * So the badge is drawn as one: the silhouette solid white, the grooves **knocked out of the
 * alpha** rather than painted in the ground colour. That distinction is the whole fix — a
 * groove filled with `#0e0e0e` is still opaque, and opaque is all Android looks at.
 *
 * The drawing is not simplified for the small size, deliberately. At 24dp the silhouette is
 * what identifies it and the grooves are texture; widening them to "help" would make the badge
 * a different mark from the launcher icon, which is the thing being asked for.
 *
 * Two CSS rules do the recolouring rather than a second copy of the paths, because a
 * presentation attribute (`fill="url(#lobe)"`, `stroke="#140a10"`) loses to any CSS
 * declaration. The selectors depend only on `brain.svg`'s structure — one blob path, then a
 * group of groove paths — so a redrawn mark needs no change here.
 */
const BADGE = `#mark > path { fill: #fff }  #mark g path { stroke: #000 }`;

/**
 * @param body  inner SVG markup
 * @param fill  fraction of the tile the mark's longest side should span
 * @param radius corner radius in viewBox units; 0 for the full-bleed maskable tile
 * @param badge render as an alpha stencil instead of a coloured tile
 */
function page(body, fill, radius, badge = false) {
  const scale = (512 * fill) / Math.max(BOX.w, BOX.h);
  const cx = BOX.x + BOX.w / 2;
  const cy = BOX.y + BOX.h / 2;
  // Scale about the mark's own centre, then park that centre on the tile's centre.
  const transform = `translate(256 256) scale(${scale.toFixed(4)}) translate(${-cx} ${-cy})`;

  // Luminance masking: white keeps a pixel, black drops it. The backing rect starts black so
  // everything outside the silhouette is transparent, and the grooves are strokes of black
  // over the white blob, so they cut back out again.
  const art = badge
    ? `<style>${BADGE}</style>
  <mask id="stencil">
    <rect width="512" height="512" fill="#000"/>
    <g transform="${transform}">${body}</g>
  </mask>
  <rect width="512" height="512" fill="#fff" mask="url(#stencil)"/>`
    : `<rect width="512" height="512" rx="${radius}" fill="${GROUND}"/>
  <g transform="${transform}">${body}</g>`;

  return `<!doctype html><html><body style="margin:0">
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  ${art}
</svg>
</body></html>`;
}

const VARIANTS = [
  { file: "icon-192.png", size: 192, fill: 0.74, radius: 96 },
  { file: "icon-512.png", size: 512, fill: 0.74, radius: 96 },
  // Android crops a maskable icon to a squircle and keeps only the inner ~80%. 0.58 leaves
  // the whole mark inside that circle with margin, which is why it looks small on its own
  // and correct once the launcher has cropped it.
  { file: "maskable-512.png", size: 512, fill: 0.58, radius: 0 },
  // 96px is what Chrome asks for. No tile to sit inside and no launcher crop to survive, so
  // it runs nearly edge to edge — Android adds its own padding around a small icon, and
  // padding this one too would shrink the mark to a smudge.
  { file: "badge-96.png", size: 96, fill: 0.9, radius: 0, badge: true },
];

const body = await markBody();
await mkdir(iconsDir, { recursive: true });

const browser = await chromium.launch();
try {
  for (const { file, size, fill, radius, badge } of VARIANTS) {
    const view = await browser.newPage({
      viewport: { width: 512, height: 512 },
      deviceScaleFactor: size / 512,
    });
    await view.setContent(page(body, fill, radius, badge));
    const shot = await view.locator("svg").screenshot({ omitBackground: true });
    await writeFile(path.join(iconsDir, file), shot);
    await view.close();
    console.log(`  ${file.padEnd(20)} ${size}x${size}`);
  }
} finally {
  await browser.close();
}

console.log("icons written to public/icons/");
