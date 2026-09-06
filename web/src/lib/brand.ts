/**
 * The one place the app's ground colour is written down as a value JavaScript can read.
 *
 * `globals.css` is still the source of truth — `--background` on `:root` and `.dark` — but
 * three things outside CSS need the same colour and cannot read a custom property:
 *
 *   - `manifest.ts`, for `background_color` and `theme_color`. Android composes the splash
 *     screen from those, so a mismatch is a coloured flash between splash and first paint.
 *   - `layout.tsx`, for `viewport.themeColor`, which tints the Samsung status bar.
 *   - `scripts/render-icons.mjs`, for the icon tile and the colour the folds are cut in.
 *
 * Before this existed all three had been typed by hand and all three had drifted: the
 * status bar was `#0a161b`, a leftover from the teal palette D-002 replaced, and the
 * manifest and icons were `#100a0e`, which is close enough to `#140a10` to survive every
 * desktop review and still be wrong. `__tests__/brand.test.ts` pins them together, because
 * this is drift no screenshot catches — it only shows on a phone, at launch, for 200ms.
 *
 * `render-icons.mjs` cannot import this file (it is ESM JavaScript run by node, not by the
 * bundler), so it carries the literal and the test asserts the literal matches.
 */
export const GROUND = "#140a10";

/**
 * The light theme's ground, and the only reason it lives here rather than only in CSS.
 *
 * `<meta name="theme-color">` colours the browser's own chrome — the address bar in a tab, the
 * status bar in an installed app — and it is set in markup, not in a stylesheet, so it cannot
 * read a CSS variable. Pinning it to `GROUND` was right while the app was dark-only; in light
 * mode it leaves a black status bar over a white page (§4.2, D-184).
 *
 * Kept in step with `--background` in `globals.css` by `__tests__/brand.test.ts`, for the same
 * reason `GROUND` is: this is drift no screenshot catches.
 */
export const GROUND_LIGHT = "#fbf7f9";
