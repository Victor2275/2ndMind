"use client";

import { ThemeProvider as NextThemes, useTheme } from "next-themes";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { hasPublicChrome } from "@/lib/chrome";
import {
  DEFAULT_THEME,
  THEME_NAMES,
  THEME_VALUES,
  groundFor,
  themeById,
} from "@/lib/theme/registry";

/**
 * Five themes, and the machinery that remembers which (V4 §1.2, D-194).
 *
 * `attribute="data-theme"`, not a class. The palettes in `tokens.css` are keyed on
 * `[data-theme="..."]`, and Tailwind's `dark:` variant is a generated selector list over the
 * dark-family themes — see `lib/theme/registry.ts` for why that beat a runtime attribute.
 *
 * **`themes` are names, `value` maps them to ids.** `enableSystem` resolves the OS preference to
 * the literal strings `light` and `dark` and will not find a theme called `light-teal`, so the
 * two defaults are *named* `light` and `dark` and mapped onto their palette ids. Storage holds
 * `dark`; the DOM gets `data-theme="dark-magenta"`.
 *
 * **`defaultTheme="system"`**, so a phone in night mode opens dark without being asked. The
 * picker exists for the times the phone is wrong about the room, not to make everyone choose.
 *
 * `disableTransitionOnChange` because nearly every surface carries a `transition-colors`, and
 * without it a switch animates several hundred elements at once — which on a phone reads as the
 * app hanging rather than as a fade. This is also Q89, answered "instant".
 *
 * ## The portfolio is pinned dark, and the pin can be lifted for one visit
 *
 * D-184 forced the public site dark: it is a shopfront, it should look the same to everyone, and
 * the case-study images were composed against a dark ground. That still holds and is still the
 * default. What changed in V4 (Q87) is that the footer toggle now *works* — it lifts the pin for
 * the current visit only.
 *
 * The distinction that makes this safe is the same one D-184 drew. `setTheme("light")` on a
 * public page would **write** light into storage and the preference would follow you into the
 * private app, so a visitor's curiosity would silently change Victor's app. `forcedTheme`
 * overrides what is applied without touching what is stored — and here the forced value is
 * component state, so it resets on reload and nothing is persisted at all.
 *
 * A toggle that a visitor can press and see nothing happen is worse than no toggle, which is
 * why the previous arrangement could not simply stay.
 */

type PublicOverride = {
  /** Whether this page is pinned (i.e. is a public page). */
  pinned: boolean;
  /** The theme name currently forced, or null for the pin's default. */
  override: string | null;
  setOverride: (name: string | null) => void;
};

const PublicThemeContext = createContext<PublicOverride>({
  pinned: false,
  override: null,
  setOverride: () => {},
});

/**
 * Lets the public footer's toggle lift the pin for one visit.
 *
 * Returns `pinned: false` inside the private app, where the real picker applies and this does
 * nothing. A control can use `pinned` to decide whether it is changing a stored preference or
 * only the current page.
 */
export function usePublicTheme(): PublicOverride {
  return useContext(PublicThemeContext);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const pinned = hasPublicChrome(pathname);

  // Not persisted anywhere, deliberately: this is "show me the other one for a moment", not a
  // preference. Reloading returns the shopfront to the dark it was designed in.
  const [override, setOverride] = useState<string | null>(null);

  // Cleared on navigation *away from* the public site, so a lifted pin cannot leak into the
  // private app's own theme handling. Keyed on `pinned` rather than on the path so that moving
  // between public pages keeps the choice.
  useEffect(() => {
    if (!pinned) setOverride(null);
  }, [pinned]);

  const context = useMemo<PublicOverride>(
    () => ({ pinned, override, setOverride }),
    [pinned, override],
  );

  const defaultName = themeById(DEFAULT_THEME)?.name ?? "dark";

  return (
    <NextThemes
      attribute="data-theme"
      themes={THEME_NAMES}
      value={THEME_VALUES}
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      forcedTheme={pinned ? (override ?? defaultName) : undefined}
    >
      <PublicThemeContext.Provider value={context}>
        <ThemeColor />
        {children}
      </PublicThemeContext.Provider>
    </NextThemes>
  );
}

/**
 * Keeps the browser's own chrome the same colour as the page.
 *
 * `<meta name="theme-color">` is static markup, so the value Next renders is fixed at build
 * time — which was fine while the app was dark-only and is wrong the moment a page can be any
 * of five palettes: a black status bar over a white page, or a magenta-black one over Carbon.
 *
 * Driven by `resolvedTheme` rather than a `prefers-color-scheme` media query, which is the
 * obvious alternative and is wrong here in a specific way: the portfolio is *pinned* regardless
 * of the device, so on a public page with a light OS the media query would turn the chrome white
 * over a page that stayed dark. `resolvedTheme` is what is actually on screen, including the
 * pinning and any lifted pin.
 *
 * `groundFor` accepts a name or an id and falls back to the default, so a theme id left in
 * storage by an older build cannot produce `undefined` here.
 */
function ThemeColor() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const tag = document.querySelector('meta[name="theme-color"]');
    if (tag) tag.setAttribute("content", groundFor(resolvedTheme));
  }, [resolvedTheme]);

  return null;
}
