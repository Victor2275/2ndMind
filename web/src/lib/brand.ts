/**
 * The ground colours as values JavaScript can read.
 *
 * `src/app/tokens.css` is the source of truth, but it is CSS, and three things outside CSS need
 * the same colour and cannot read a custom property:
 *
 *   - `manifest.ts`, for `background_color` and `theme_color`. Android composes the splash
 *     screen from those, so a mismatch is a coloured flash between splash and first paint.
 *   - `layout.tsx`, for `viewport.themeColor`, which tints the Samsung status bar.
 *   - `scripts/render-icons.mjs`, for the icon tile and the colour the folds are cut in.
 *
 * Before this existed all three had been typed by hand and all three had drifted: the status bar
 * was `#0a161b`, a leftover from the teal palette D-002 replaced, and the manifest and icons
 * were `#100a0e`, close enough to the real ground to survive every desktop review and still be
 * wrong. `__tests__/brand.test.ts` pins them together, because this is drift no screenshot
 * catches — it only shows on a phone, at launch, for 200ms.
 *
 * **Since V4 these are derived, not typed** (D-194). `lib/theme/registry.ts` carries each
 * theme's ground and a test checks every one of them against the generated CSS by converting
 * the OKLCH value rather than by trusting a comment. `render-icons.mjs` still cannot import
 * anything (it is plain ESM run by node), so it keeps a literal and the test pins it.
 */
import { DEFAULT_THEME, groundFor } from "@/lib/theme/registry";

/** The default theme's ground. The app's "brand" colour wherever exactly one is allowed. */
export const GROUND = groundFor(DEFAULT_THEME);

/**
 * The light theme's ground.
 *
 * `<meta name="theme-color">` colours the browser's own chrome and is set in markup, so it
 * cannot read a CSS variable. Pinning it to `GROUND` was right while the app was dark-only; in
 * light mode it leaves a black status bar over a white page (D-184).
 *
 * At runtime `ThemeColor` in `theme-provider.tsx` uses `groundFor(resolvedTheme)` and handles
 * all five themes. This constant is the static fallback and the value the tests pin.
 */
export const GROUND_LIGHT = groundFor("light-teal");
