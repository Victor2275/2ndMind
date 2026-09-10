"use client";

import { useEffect, useState } from "react";

/**
 * How many pixels of the layout viewport the on-screen keyboard is currently covering (D-237).
 *
 * ## Why this is needed at all
 *
 * A phone keyboard does not resize the page. By default both iOS Safari and Chrome Android
 * shrink the *visual* viewport — what you can see — and leave the *layout* viewport, which is
 * what `position: fixed` and `100dvh` are measured against, exactly as it was. So a panel
 * pinned to `inset-0` keeps its full height and its bottom edge, footer and all, sits underneath
 * the keyboard. That is the exercise picker's "Add 3 exercises" button disappearing the moment
 * you tap the name field, which is the one moment you are about to need it.
 *
 * `window.visualViewport` is the only thing that reports the difference. The number below is the
 * gap between the bottom of the layout viewport and the bottom of the visible one; applied as
 * `padding-bottom` on a `fixed inset-0` element it shortens the content box, so a flex column
 * inside re-lays out with its footer sitting on top of the keyboard and its scrolling middle
 * correspondingly shorter — one style on one element, rather than a height calculation repeated
 * down the tree.
 *
 * ## Why not `interactive-widget=resizes-content`
 *
 * The viewport meta tag can ask the browser to resize the layout viewport instead, which would
 * make all of this unnecessary. It is also app-wide: it would change how the bottom tab bar and
 * every other fixed element behaves on the quick-log screen, the settings forms and everywhere
 * else, to fix one panel. Scoped here, nothing else moves.
 *
 * Returns 0 when there is no `visualViewport` (jsdom, older browsers) and on a desktop browser,
 * where the two viewports agree and the arithmetic yields nothing.
 */
export function useKeyboardInset(active = true): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    if (!active) return;
    const viewport = typeof window === "undefined" ? undefined : window.visualViewport;
    if (!viewport) return;

    const measure = () => {
      // `offsetTop` matters when the page is pinch-zoomed or the visual viewport has been
      // scrolled within the layout one: the covered strip is what is left below the visible box,
      // not simply the height difference. Rounded because sub-pixel churn here would re-render
      // the whole list on every scroll frame; floored at 0 because a URL bar retracting produces
      // a small negative, which is not a keyboard.
      const covered = window.innerHeight - (viewport.height + viewport.offsetTop);
      setInset(covered > 1 ? Math.round(covered) : 0);
    };

    measure();
    viewport.addEventListener("resize", measure);
    viewport.addEventListener("scroll", measure);
    return () => {
      viewport.removeEventListener("resize", measure);
      viewport.removeEventListener("scroll", measure);
    };
  }, [active]);

  // Gated on the way out rather than reset on the way in: writing state from an effect body to
  // clear it is a cascading render, and the last measurement is meaningless while inactive
  // anyway. Reopening re-subscribes and measures again.
  return active ? inset : 0;
}
