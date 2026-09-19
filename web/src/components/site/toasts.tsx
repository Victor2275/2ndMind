"use client";

import { toast } from "sonner";

import { Toaster } from "@/components/ui/sonner";

/**
 * The toast system, mounted (V4 §5.2, D-192).
 *
 * `ui/sonner.tsx` has been in this repo since V1 and D-192 found the truth about it: it was
 * **mounted nowhere and `toast()` was called nowhere**, so the app had never shown one. §1.10
 * made the component correct at the V4 tokens; this is the part that puts it on screen, and it
 * is a build rather than the styling pass Q265–Q268 were scoped as.
 *
 * ## Why there is a wrapper rather than a `<Toaster />` in the layout
 *
 * Three things have to be decided in one place or they drift, and none of them belongs in a
 * vendored registry file:
 *
 * 1. **Where it sits** (Q267) — bottom, above the tab bar. The bar is `fixed` at
 *    `bottom-0` with `env(safe-area-inset-bottom)` under it and a 12px-ish row above that, so a
 *    bottom-centred toast at sonner's default offset lands *underneath* the one piece of
 *    chrome that is always on screen. The offset below is that height, written the same way the
 *    bar writes it.
 * 2. **What a toast is for** — see `notify` below. Not every save.
 * 3. **How long it stays.** An undo toast that disappears in four seconds is an undo nobody
 *    catches on a phone; eight is long enough to read, notice and reach.
 */

/**
 * Mounted once, in the private layout.
 *
 * **Not in the root layout.** The public site has nothing that writes, so a `Toaster` there
 * would be a client component and a portal on every statically generated page for a function
 * that can never fire. The one exception that matters — the cached offline shell — mounts its
 * own, because it renders outside the private layout.
 */
export function PrivateToaster() {
  return (
    <Toaster
      position="bottom-center"
      // `4.5rem` is the tab bar's own height (`pb-[calc(4.5rem+…)]` in the More sheet is the
      // same number, for the same reason), plus the safe-area inset under it. A toast that
      // covers the tab bar is a toast that eats the tap you were about to make.
      offset="calc(4.5rem + env(safe-area-inset-bottom) + 0.5rem)"
      // On a pointer device there is no tab bar — the sidebar owns navigation — so the toast
      // can sit where it belongs.
      mobileOffset="calc(4.5rem + env(safe-area-inset-bottom) + 0.5rem)"
      duration={DURATION}
      // Q207's reading of `prefers-reduced-motion`: a designed alternative rather than nothing.
      // sonner's own handling is an opacity fade, which is exactly the alternative asked for,
      // so this is left to it rather than overridden.
      closeButton
    />
  );
}

/** Long enough to read, notice, and reach for the undo. Sonner's default is 4s. */
const DURATION = 8000;

/**
 * What a toast is for, and what it is not for.
 *
 * **It is not the confirmation that a save landed.** `log-form.tsx` says why, and the comment
 * there predates this file: the form is used at a rack, one hand, eyes elsewhere, and a toast
 * answers "did that save?" only if you look at it. `buzzSaved()` answers it without looking and
 * stays the primary confirmation for every write path (§3.3, Q197).
 *
 * A toast is for the two things a buzz cannot say:
 *
 * - **An action you might want to take back** (Q265). Destructive actions in this app are
 *   undoable rather than confirmed, which is only true if the undo is reachable — and a
 *   confirmation dialog on a phone is a modal between a thumb and the thing it was aiming at.
 * - **Something that went wrong where you were not looking**, which is the case a vibration
 *   cannot distinguish from success at arm's length.
 */
export const notify = {
  /**
   * An undoable action just happened.
   *
   * The undo runs whatever the caller hands it, so this file knows nothing about tasks, log
   * entries or sessions — which is what keeps it usable from the five screens §5.4–5.9 will
   * want it from.
   */
  undoable(message: string, onUndo: () => void) {
    toast(message, {
      action: { label: "Undo", onClick: onUndo },
    });
  },

  /** Something failed where the reader was not looking. */
  failed(message: string) {
    toast.error(message);
  },

  /** Rare: a save worth saying out loud, because it happened somewhere off screen. */
  done(message: string) {
    toast.success(message);
  },
};
