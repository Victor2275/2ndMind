/**
 * Which themes exist (V4 §1.2, D-194).
 *
 * The palettes themselves are in `src/app/tokens.css`, generated from contrast targets by
 * `scripts/build-tokens.mts`. This is the metadata the *app* needs — what to call each theme in
 * the picker, which family it belongs to, and what colour the browser chrome should be — and it
 * is deliberately the only list. A theme named here and missing from the CSS, or the reverse,
 * fails `__tests__/registry.test.ts`.
 *
 * ## One attribute, and a generated variant
 *
 * `next-themes` writes `data-theme` on `<html>` and nothing else. Tailwind's `dark:` variant is
 * a selector list over the dark-family themes, **generated into `tokens.css`** by the same
 * script that writes the palettes, so adding a sixth theme is one spec in the generator plus one
 * entry here — no component edits and no selector to remember.
 *
 * A runtime `data-scheme` attribute was the first plan and was dropped: setting a second
 * attribute before first paint means a second pre-hydration script running alongside
 * next-themes', and if it lands a frame late every `dark:` utility renders its light branch on a
 * dark ground. Anything that genuinely varies by scheme rather than by theme — the ambient
 * pools, the grain — is a **token** instead, which is correct on the first painted frame.
 *
 * Nothing here is sensitive — it compiles into client chunks.
 */

export type Scheme = "dark" | "light";

export type Theme = {
  /** Matches `[data-theme="..."]` in `tokens.css` and the spec id in the generator. */
  id: string;
  /**
   * What `next-themes` stores and what `setTheme()` takes.
   *
   * The two default themes are named `light` and `dark` rather than by their ids, because
   * `enableSystem` resolves the OS preference to exactly those two strings and will not find a
   * theme called `light-teal`. `value` maps the name onto the id, so storage holds `dark` and
   * the DOM gets `data-theme="dark-magenta"`.
   */
  name: string;
  /** Shown in the picker. */
  label: string;
  /** One line, shown under the label in settings. */
  note: string;
  scheme: Scheme;
  /** `--background` as a hex literal, for `<meta name="theme-color">`, which cannot read CSS. */
  ground: string;
  /**
   * `--primary` and `--foreground`, for the settings picker's swatches.
   *
   * A swatch has to render in a theme it is not currently showing, so it cannot use
   * `var(--primary)` — that would resolve to the *active* theme and paint all five identically.
   * These are literals for the same reason `ground` is, and the same test pins them: every one
   * is checked against the generated CSS by converting the OKLCH, not by reading a comment.
   */
  accent: string;
  foreground: string;
  /** Offered in the private settings picker. Experimental themes are, deliberately. */
  selectable: boolean;
};

/**
 * Every theme, in the order the picker shows them.
 *
 * `ground` is duplicated from the generated CSS on purpose: `<meta name="theme-color">` is
 * markup and cannot read a custom property, so the value has to exist in JavaScript. That
 * duplication is exactly the drift `lib/brand.ts` was created to stop — the status bar sat at
 * `#0a161b`, a leftover from a palette replaced two versions earlier, because nobody could see
 * it on a desktop. A test pins every `ground` here to the generated CSS.
 */
export const THEMES: readonly Theme[] = [
  {
    id: "dark-magenta",
    name: "dark",
    label: "Magenta",
    note: "The default. Warm near-black, magenta accent.",
    scheme: "dark",
    ground: "#12090d",
    accent: "#d36da8",
    foreground: "#f9f0f5",
    selectable: true,
  },
  {
    id: "light-teal",
    name: "light",
    label: "Teal",
    note: "Warm paper, teal accent. The light theme.",
    scheme: "light",
    ground: "#eef4f4",
    accent: "#007372",
    foreground: "#182727",
    selectable: true,
  },
  {
    id: "hc-dark",
    name: "hc-dark",
    label: "High contrast",
    note: "For a phone in sunlight. Every colour clears 7.5:1.",
    scheme: "dark",
    ground: "#030303",
    accent: "#ed82bf",
    foreground: "#fdfdfd",
    selectable: true,
  },
  {
    id: "carbon",
    name: "carbon",
    label: "Carbon",
    note: "Experimental. Hueless near-black, cyan accent.",
    scheme: "dark",
    ground: "#0e0e0e",
    accent: "#00aeb6",
    foreground: "#f6f6f6",
    selectable: true,
  },
  {
    id: "steel-light",
    name: "steel-light",
    label: "Steel",
    note: "Experimental. Cool paper, steel accent.",
    scheme: "light",
    ground: "#f2f5f8",
    accent: "#3b6998",
    foreground: "#1e262e",
    selectable: true,
  },
] as const;

/** The theme applied when nothing has been chosen, and what the public site is pinned to. */
export const DEFAULT_THEME = "dark-magenta";

export const THEME_IDS = THEMES.map((t) => t.id);

/** The names `next-themes` knows. Passed as its `themes` prop. */
export const THEME_NAMES = THEMES.map((t) => t.name);

/** `next-themes` `value` prop: the name it stores -> the attribute value the CSS selects on. */
export const THEME_VALUES: Record<string, string> = Object.fromEntries(
  THEMES.map((t) => [t.name, t.id]),
);

export function themeByName(name: string | undefined): Theme | undefined {
  return THEMES.find((t) => t.name === name);
}

export function themeById(id: string | undefined): Theme | undefined {
  return THEMES.find((t) => t.id === id);
}

/**
 * The scheme a theme id belongs to.
 *
 * Falls back to the default's scheme rather than throwing: this runs during render with
 * whatever `next-themes` read out of `localStorage`, which can be a theme id from a build
 * where it existed and this one where it does not.
 */
export function schemeFor(idOrName: string | undefined): Scheme {
  const found = themeById(idOrName) ?? themeByName(idOrName);
  return found?.scheme ?? themeById(DEFAULT_THEME)!.scheme;
}

/** The ground of a theme, by id or by name. Used for `<meta name="theme-color">`. */
export function groundFor(idOrName: string | undefined): string {
  const found = themeById(idOrName) ?? themeByName(idOrName);
  return (found ?? themeById(DEFAULT_THEME)!).ground;
}
