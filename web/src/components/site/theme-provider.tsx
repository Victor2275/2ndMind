"use client";

import { ThemeProvider as NextThemes, useTheme } from "next-themes";
import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { hasPublicChrome } from "@/lib/chrome";
import { GROUND, GROUND_LIGHT } from "@/lib/brand";

/**
 * Light and dark, and the machinery that remembers which (V3 §4.2, D-184).
 *
 * `attribute="class"` because `globals.css` was written for it from the start: `.dark` has held
 * a full palette since V1, and Tailwind's `dark:` variant here is `&:is(.dark *)`. Nothing about
 * the stylesheet had to change shape — `:root` simply stopped being a copy of `.dark`.
 *
 * **`defaultTheme="system"`**, so a phone in night mode opens dark without being asked. The
 * toggle exists for the times the phone is wrong about the room, not to make everyone choose.
 *
 * `disableTransitionOnChange` because nearly every surface here carries a `transition-colors`,
 * and without it a switch animates several hundred elements at once — which on a phone reads as
 * the app hanging rather than as a fade.
 *
 * ## The portfolio does not follow the phone
 *
 * Victor's call: the public site keeps the dark magenta identity D-007 and D-008 established.
 * It is a shopfront and it should look the same to everyone — the case-study images were
 * composed against a dark ground, and a reader whose laptop happens to be in light mode would
 * otherwise be shown a palette nobody has ever looked at. The private app is the thing used at
 * 7am and at midnight, and that is where following the device earns its keep.
 *
 * `forcedTheme` rather than `setTheme`, and the distinction matters: `setTheme("dark")` on a
 * public page would **write** dark into storage and the preference would follow you into the
 * app, so visiting the portfolio would silently undo your choice. `forcedTheme` overrides what
 * is applied without touching what is stored.
 *
 * The boundary is `hasPublicChrome`, which is already the app's one answer to "is this the
 * private app?" — including the offline shell, which lives outside `/private` and is still the
 * app (D-174). Two lists of what counts as private is how they drift apart.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <NextThemes
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      forcedTheme={hasPublicChrome(pathname) ? "dark" : undefined}
    >
      <ThemeColor />
      {children}
    </NextThemes>
  );
}

/**
 * Keeps the browser's own chrome the same colour as the page.
 *
 * `<meta name="theme-color">` is static markup, so the value Next renders is fixed at build
 * time — which was fine while the app was dark-only and is wrong the moment a page can be
 * light: a black status bar sits over a white page.
 *
 * Driven by `resolvedTheme` rather than a `prefers-color-scheme` media query, which is the
 * obvious alternative and is wrong here in a specific way: the portfolio is *forced* dark
 * regardless of the device, so on a public page with a light OS the media query would turn the
 * chrome white over a page that stayed dark. `resolvedTheme` is what is actually on screen,
 * including the forcing.
 */
function ThemeColor() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const tag = document.querySelector('meta[name="theme-color"]');
    if (tag) tag.setAttribute("content", resolvedTheme === "light" ? GROUND_LIGHT : GROUND);
  }, [resolvedTheme]);

  return null;
}
