/**
 * Renders the app icons from `public/icons/brain.svg`.
 *
 * Playwright is already a dev dependency (it drives `npm run shots`), so this needs no new
 * tooling and — like everything else in Phase 0 — runs with the network off.
 *
 * Two shapes come out of one source, and the difference matters:
 *
 *   any       — the mark on a rounded near-black tile, drawn edge to edge. This is what a
 *               browser shows in a tab and what a launcher uses when it does not mask.
 *   maskable  — the same mark on a full-bleed square, scaled to ~62% so the whole thing sits
 *               inside the safe circle. Android's One UI crops icons to a squircle; a
 *               maskable icon that fills its canvas gets its edges shaved off.
 *
 * Run: node scripts/render-icons.mjs
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

const here = path.dirname(fileURLToPath(import.meta.url));
const iconsDir = path.join(here, "..", "public", "icons");

const GROUND = "#100a0e";

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
const BOX = { x: 102, y: 117, w: 315, h: 317 };

/**
 * @param body  inner SVG markup
 * @param fill  fraction of the tile the mark's longest side should span
 * @param radius corner radius in viewBox units; 0 for the full-bleed maskable tile
 */
function page(body, fill, radius) {
  const scale = (512 * fill) / Math.max(BOX.w, BOX.h);
  const cx = BOX.x + BOX.w / 2;
  const cy = BOX.y + BOX.h / 2;
  // Scale about the mark's own centre, then park that centre on the tile's centre.
  const transform = `translate(256 256) scale(${scale.toFixed(4)}) translate(${-cx} ${-cy})`;

  return `<!doctype html><html><body style="margin:0">
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${radius}" fill="${GROUND}"/>
  <g transform="${transform}">${body}</g>
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
];

const body = await markBody();
await mkdir(iconsDir, { recursive: true });

const browser = await chromium.launch();
try {
  for (const { file, size, fill, radius } of VARIANTS) {
    const view = await browser.newPage({
      viewport: { width: 512, height: 512 },
      deviceScaleFactor: size / 512,
    });
    await view.setContent(page(body, fill, radius));
    const shot = await view.locator("svg").screenshot({ omitBackground: true });
    await writeFile(path.join(iconsDir, file), shot);
    await view.close();
    console.log(`  ${file.padEnd(20)} ${size}x${size}`);
  }
} finally {
  await browser.close();
}

console.log("icons written to public/icons/");
