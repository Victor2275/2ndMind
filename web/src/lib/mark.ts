/**
 * The mark's geometry, as values JavaScript can read (V4 item 6.1, D-346).
 *
 * `public/icons/brain.svg` is the drawing of record and `scripts/render-icons.mjs` reads that
 * file directly, because it is plain ESM run by node and can. Three things inside the app need
 * the same shape and cannot read a file at render time:
 *
 *   - `components/site/mark.tsx`, the header mark, which is a Client Component.
 *   - `app/opengraph-image.tsx` and the per-project variant, where `next/og` rasterises through
 *     satori and takes an image rather than a component tree.
 *   - the five-pillar lockup, which composes the mark with four other glyphs.
 *
 * So the path data exists twice — here and in the SVG — and `__tests__/mark.test.ts` pins the
 * two together by comparing the `d` strings with whitespace normalised. This is the same
 * arrangement as `lib/net/deadline.ts` and the service worker's copy of the budgets (D-204):
 * duplication is allowed where it cannot be avoided, and is always accompanied by the test that
 * makes drift loud.
 *
 * Nothing here is sensitive — it compiles into client chunks, as a drawing should.
 */

/** The silhouette. One closed blob, lobed the whole way round. */
export const LOBE_D =
  "M78 250 C70 210 92 172 128 158 C138 124 180 108 212 128 C232 100 282 100 302 126 " +
  "C336 106 382 122 390 158 C428 168 448 206 436 244 C456 274 448 316 414 332 " +
  "C408 368 372 392 336 380 C316 404 274 408 254 386 C226 406 186 400 172 374 " +
  "C132 376 100 348 106 314 C76 296 68 268 78 250 Z";

/**
 * The folds, cut *out* of the silhouette rather than drawn over it.
 *
 * Six, at stroke 18. Each S-bends twice on the way down; that wander is what separates a brain
 * from a striped shell, and it is why there are six heavy cuts rather than thirteen light ones —
 * the previous drawing sat at the legibility ceiling and degraded by 36px (D-148).
 */
export const GROOVE_D = [
  "M126 168 C148 194 122 216 140 244 C152 262 134 270 140 280",
  "M196 140 C218 168 192 190 210 218 C226 244 202 268 214 298",
  "M268 132 C290 160 264 182 280 208 C292 228 274 240 280 254",
  "M340 142 C362 170 336 192 354 220 C370 246 346 272 358 300",
  "M408 178 C426 204 404 224 416 246",
  // The one groove that runs the other way, dividing off the lower lobe. It breaks out of the
  // front edge on purpose — the only cut that does, which is what makes it read as a division
  // rather than as a sixth fold.
  "M96 322 C140 350 200 356 250 342 C290 330 320 340 340 358",
] as const;

/** The stroke width the folds are cut at, in viewBox units. */
export const GROOVE_WIDTH = 18;

/** The drawing's coordinate system. */
export const MARK_VIEWBOX = "0 0 512 512";

/**
 * The mark's bounding box inside the 512 viewBox, measured from `LOBE_D`.
 *
 * Fold strokes are excluded: they are holes, so a stroke that overshoots the silhouette
 * subtracts from nothing and does not belong in the box. Must be re-measured if the blob is
 * redrawn — `render-icons.mjs` carries the same numbers for the same reason.
 */
export const MARK_BOX = { x: 68, y: 102, w: 382, h: 302 } as const;

/**
 * The mark as a standalone SVG document.
 *
 * Used where a component tree is not an option: satori takes an `<img>`, and a data URI is the
 * only way to hand it a masked drawing. `color` is a real colour here rather than
 * `currentColor`, because a data URI has no surrounding context to inherit from.
 *
 * @param color   what to paint the silhouette. The grooves are always holes.
 * @param idSuffix disambiguates the mask id when several marks share one document.
 */
export function markSvg(color: string, idSuffix = ""): string {
  const maskId = `folds${idSuffix}`;
  const lobeId = `lobe${idSuffix}`;
  const grooves = GROOVE_D.map((d) => `<path d="${d}"/>`).join("");

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${MARK_VIEWBOX}">` +
    `<defs><path id="${lobeId}" d="${LOBE_D}"/>` +
    `<mask id="${maskId}" maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512">` +
    `<use href="#${lobeId}" fill="#fff"/>` +
    `<g fill="none" stroke="#000" stroke-width="${GROOVE_WIDTH}" stroke-linecap="round">` +
    `${grooves}</g></mask></defs>` +
    `<use href="#${lobeId}" fill="${color}" mask="url(#${maskId})"/>` +
    `</svg>`
  );
}

/** `markSvg` packaged as a `data:` URI, which is what satori and `<img src>` want. */
export function markDataUri(color: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(markSvg(color)).toString("base64")}`;
}
