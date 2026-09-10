/**
 * Renders the app icons from `public/icons/brain.svg`.
 *
 * Playwright is already a dev dependency (it drives `npm run shots`), so this needs no new
 * tooling and — like everything else in Phase 0 — runs with the network off.
 *
 * Everything comes out of one drawing, and the differences matter:
 *
 *   any        — the mark on a rounded near-black tile, drawn edge to edge. What a launcher
 *                uses when it does not mask, and what the app switcher shows.
 *   maskable   — the same mark on a full-bleed square, scaled so the whole thing sits inside
 *                the safe circle. Android's One UI crops icons to a squircle; a maskable icon
 *                that fills its canvas gets its edges shaved off.
 *   badge      — the notification small icon. White on transparent, because Android reads
 *                nothing but its alpha channel (D-203). Since D-215 that needs no special
 *                drawing: the mark is a stencil everywhere, so this is just the mark with no
 *                tile behind it.
 *   apple-icon — iOS ignores the manifest and reads `apple-touch-icon`. Keeps its tile.
 *   favicon    — `icon.svg` (light/dark, vector) plus an `.ico` of three raster frames, since
 *                browsers request `/favicon.ico` whether or not anything links to it.
 *   shortcuts  — three lucide glyphs on the app's tile, for the launcher's long-press menu.
 *
 * The last three write to `src/app/`, not `public/icons/`: they are Next file conventions, and
 * only a file in that directory makes Next emit the link tag for it.
 *
 * Run: node scripts/render-icons.mjs
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

const here = path.dirname(fileURLToPath(import.meta.url));
const iconsDir = path.join(here, "..", "public", "icons");
// `icon.svg` and `apple-icon.png` are file conventions, not assets: Next only emits the
// `<link rel="icon">` and `<link rel="apple-touch-icon">` tags for files that sit here.
const appDir = path.join(here, "..", "src", "app");

// Must equal `GROUND` in src/lib/brand.ts, which is the default theme's ground in
// src/lib/theme/registry.ts and is generated into src/app/tokens.css. A test pins
// all three together. This file is run by node rather than the bundler, so it cannot import
// the constant and carries the literal instead.
const GROUND = "#0e0e0e";

// The default theme's `accent`, same source and same treatment as GROUND above — the literal
// exists because node cannot import the registry, and `__tests__/brand.test.ts` pins it.
//
// Added 2026-09-10 (D-215). Before this the mark carried its own magenta gradient, so the
// launcher icon stayed a V2-magenta brain for the two days after D-197 made carbon the default
// and moved the tile underneath it to #0e0e0e. The mark is `currentColor` now, so the icon's
// colour is stated once, here, and follows the default theme like everything else does.
const ACCENT = "#00aeb6";

// The light theme's `accent`, for the favicon's `prefers-color-scheme: light` branch — the
// carbon cyan is a dark-theme value and sits at roughly 2.4:1 on a white tab strip. Same
// treatment as the two above: literal here, pinned by `__tests__/brand.test.ts`.
const ACCENT_LIGHT = "#007372";

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
 * mark is redrawn. Fold strokes are ignored: they are holes, so a stroke that overshoots the
 * silhouette subtracts from nothing and does not belong in the box.
 *
 * `lib/mark.ts` carries the same numbers as `MARK_BOX` and `lib/__tests__/mark.test.ts` pins
 * the two together.
 */
const BOX = { x: 68, y: 102, w: 382, h: 302 };

/**
 * The notification small icon is an alpha channel, not a picture (D-203).
 *
 * Android throws away every colour in a `badge` and paints whatever is left opaque in the
 * system accent. Handing it `icon-192.png` — a coloured mark on an opaque near-black tile —
 * therefore produces a solid white rounded square in the status bar, which is exactly what
 * was reported. Nothing about the file is wrong; it is being read as a stencil.
 *
 * **Since D-215 the badge needs no special drawing.** The mark knocks its grooves out of the
 * alpha in `brain.svg` itself, so it is a stencil everywhere and always; the badge is simply
 * the mark with no tile behind it. The two CSS rules that used to recolour the paths here are
 * gone, along with their dependence on the mark's internal structure — the only thing this
 * file now says about colour is `color`, which the drawing picks up as `currentColor`.
 *
 * The drawing is not simplified for the small size, deliberately. At 24dp the silhouette is
 * what identifies it and the grooves are texture; widening them to "help" would make the badge
 * a different mark from the launcher icon, which is the thing being asked for.
 */

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

  // The mark carries its own alpha (D-215): the silhouette is `currentColor` and the grooves are
  // holes. So the only difference between an icon and a stencil is what sits behind it — a tile,
  // or nothing — and what `color` is set to. No masking is done here any more.
  const art = badge
    ? `<g transform="${transform}">${body}</g>`
    : `<rect width="512" height="512" rx="${radius}" fill="${GROUND}"/>
  <g transform="${transform}">${body}</g>`;

  return `<!doctype html><html><body style="margin:0">
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"
     color="${badge ? "#fff" : ACCENT}">
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
  // iOS ignores the manifest's icons entirely and reads `apple-touch-icon`. It also composites
  // the result onto white if any pixel is transparent, so this one keeps its tile — and it goes
  // to `src/app/`, where Next's `apple-icon` file convention emits the link tag for it.
  { file: "apple-icon.png", size: 180, fill: 0.7, radius: 0, dir: appDir },
];

/* ===========================================================================================
   SHORTCUT GLYPHS — V4 item 6.2 (Q436)
   ===========================================================================================

   The launcher's long-press menu had all three shortcuts pointing at `icon-192.png`, so the
   menu was the app icon three times over and the icons carried no information at all.

   The geometry is imported from `lucide-react` rather than drawn here. It is already a
   dependency, it is the icon set the app uses everywhere else (Q209), and hand-copying five
   bezier paths into this file is exactly the kind of duplication that goes stale silently. The
   package publishes `__iconNode` as raw `[tag, attrs]` pairs, which is all that is needed. */
const GLYPHS = [
  ["shortcut-training.png", "dumbbell"],
  ["shortcut-note.png", "square-pen"],
  ["shortcut-day.png", "moon"],
];

/** One lucide icon, on the same tile as the app icon, at the app's own stroke width. */
async function glyphPage(name) {
  const { __iconNode } = await import(`lucide-react/dist/esm/icons/${name}.mjs`);
  const paths = __iconNode
    .map(([tag, attrs]) => {
      const rendered = Object.entries(attrs)
        .filter(([key]) => key !== "key")
        .map(([key, value]) => `${key}="${value}"`)
        .join(" ");
      return `<${tag} ${rendered}/>`;
    })
    .join("");

  // lucide draws on a 24 grid. 0.5 of the tile, centred, matches the optical weight of the mark
  // at `fill: 0.74` — a glyph is mostly negative space where the mark is mostly solid.
  const scale = (512 * 0.5) / 24;
  const offset = (512 - 24 * scale) / 2;

  return `<!doctype html><html><body style="margin:0">
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="${GROUND}"/>
  <g transform="translate(${offset} ${offset}) scale(${scale.toFixed(4)})"
     fill="none" stroke="${ACCENT}" stroke-width="1.75"
     stroke-linecap="round" stroke-linejoin="round">${paths}</g>
</svg>
</body></html>`;
}

/**
 * The favicon, and the only output that is not a raster (Q38).
 *
 * A browser tab is the one surface where the light and dark answers differ and there is no
 * theme attribute to read — the page has not been parsed yet. An SVG favicon can carry its own
 * `prefers-color-scheme` query, which is why Q38 asked for the format change: `.ico` cannot.
 *
 * No tile. The grooves are holes, so on a light tab strip they show the tab strip, and the mark
 * reads as drawn on it rather than pasted onto it.
 */
function faviconSvg(body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="Victor Gusev">
  <title>Victor Gusev</title>
  <!-- GENERATED by scripts/render-icons.mjs from public/icons/brain.svg — do not edit. -->
  <style>
    /* Dark is the default here, matching the site's own default theme. */
    svg { color: ${ACCENT} }
    @media (prefers-color-scheme: light) { svg { color: ${ACCENT_LIGHT} } }
  </style>
  ${body}
</svg>
`;
}

/**
 * Pack PNGs into an `.ico` (V4 item 6.2).
 *
 * `icon.svg` is what any browser from the last five years uses, but every browser also requests
 * `/favicon.ico` on its own whether or not a link tag points at one, so the file has to exist
 * and has to be the mark. Before this it was a 25,931-byte file dated the day the repo was
 * created and had never been generated by anything here.
 *
 * ICO directory entries may carry a whole PNG rather than a BMP, which every browser has
 * understood since IE11 — so this is a header, three 16-byte entries, and the PNG bytes. No
 * encoder dependency, and nothing to keep in step with the mark.
 */
function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // 1 = icon
  header.writeUInt16LE(images.length, 4);

  let offset = 6 + images.length * 16;
  const entries = [];
  for (const { size, png } of images) {
    const entry = Buffer.alloc(16);
    entry[0] = size >= 256 ? 0 : size; // 0 means 256
    entry[1] = size >= 256 ? 0 : size;
    entry[2] = 0; // palette
    entry[3] = 0; // reserved
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += png.length;
  }

  return Buffer.concat([header, ...entries, ...images.map((i) => i.png)]);
}

const body = await markBody();
await mkdir(iconsDir, { recursive: true });

const browser = await chromium.launch();
try {
  for (const { file, size, fill, radius, badge, dir } of VARIANTS) {
    const view = await browser.newPage({
      viewport: { width: 512, height: 512 },
      deviceScaleFactor: size / 512,
    });
    await view.setContent(page(body, fill, radius, badge));
    const shot = await view.locator("svg").screenshot({ omitBackground: true });
    await writeFile(path.join(dir ?? iconsDir, file), shot);
    await view.close();
    console.log(`  ${file.padEnd(24)} ${size}x${size}`);
  }

  // The `.ico` fallback: no tile, accent-coloured, so it matches what `icon.svg` shows rather
  // than being a second, differently-dressed mark. Three sizes is what Windows and the older
  // browsers ask for between them.
  //
  // The folds are widened as the frame shrinks, and this is the one place the drawing is allowed
  // to be adjusted for its size. At 16px a stroke of 18 viewBox units is 18/512 × 16 = 0.56px —
  // below one device pixel, so the grooves grey out instead of cutting and the mark arrives as
  // the striped blob D-148 named. Widening keeps the *count* and the wander, which is what
  // identifies it; it only makes each cut wide enough to survive the raster. D-203 declined to
  // simplify the badge at 24dp and that still holds — this is not a simplification, and nothing
  // is removed.
  const ICO_GROOVE = { 16: 40, 32: 26, 48: 21 };
  const icoImages = [];
  for (const size of [16, 32, 48]) {
    const view = await browser.newPage({
      viewport: { width: 512, height: 512 },
      deviceScaleFactor: size / 512,
    });
    const scaled = body.replace(/stroke-width="\d+"/, `stroke-width="${ICO_GROOVE[size]}"`);
    await view.setContent(page(scaled, 0.92, 0, true).replace('color="#fff"', `color="${ACCENT}"`));
    icoImages.push({ size, png: await view.locator("svg").screenshot({ omitBackground: true }) });
    await view.close();
  }
  await writeFile(path.join(appDir, "favicon.ico"), ico(icoImages));
  console.log(`  ${"favicon.ico".padEnd(24)} 16/32/48  (fallback)`);

  for (const [file, glyph] of GLYPHS) {
    const view = await browser.newPage({
      viewport: { width: 512, height: 512 },
      deviceScaleFactor: 192 / 512,
    });
    await view.setContent(await glyphPage(glyph));
    const shot = await view.locator("svg").screenshot({ omitBackground: true });
    await writeFile(path.join(iconsDir, file), shot);
    await view.close();
    console.log(`  ${file.padEnd(24)} 192x192  (lucide ${glyph})`);
  }
} finally {
  await browser.close();
}

await writeFile(path.join(appDir, "icon.svg"), faviconSvg(body));
console.log(`  ${"icon.svg".padEnd(24)} vector   (light/dark)`);

console.log("icons written to public/icons/ and src/app/");
