"use client";

import { useRef, useState, type ReactNode } from "react";
import { CheckIcon, Trash2Icon } from "lucide-react";

import { buzzSaved } from "@/lib/haptics";

/**
 * A list row you can swipe (V3 §3.3).
 *
 * Right completes, left deletes — the checkbox is on the left of a task row and the × is on the
 * right, so each swipe goes toward the control it stands in for, and left-is-destructive is
 * what every mail app has already taught the thumb. A direction with no handler springs back
 * instead of doing nothing silently, which is how the rule gets learned rather than guessed at.
 *
 * **Swipe never replaces the buttons.** They stay, they stay reachable by keyboard, and they
 * are what a screen reader gets. This is a shortcut for a thumb, not an interface — a gesture
 * with no visible affordance cannot be the only way to do anything.
 *
 * ## Not fighting the page
 *
 * The failure that makes swipe rows unbearable is stealing vertical scroll. Two guards, and
 * both matter:
 *
 * - Nothing happens until the finger has moved `SLOP` **and** moved further horizontally than
 *   vertically. Before that the row is inert and the page scrolls normally.
 * - Once horizontal movement wins, the pointer is captured and the row commits to the gesture,
 *   so a wobble mid-swipe cannot hand the page a scroll halfway through.
 *
 * `touch-action: pan-y` tells the browser the same thing at a level React cannot: vertical
 * panning is the page's, horizontal is ours. Without it Chrome starts scrolling before the
 * first `pointermove` ever arrives.
 */

/** How far the finger travels before this is a swipe rather than a tap or the start of a scroll. */
const SLOP = 12;

/** How far it has to go to commit. Below this the row springs back and nothing happens. */
const THRESHOLD = 88;

/** The row never travels further than this, so a hard flick still reads as a row, not a launch. */
const MAX = 120;

export function SwipeRow({
  children,
  onSwipeRight,
  onSwipeLeft,
  rightLabel,
  leftLabel,
  className = "",
}: {
  children: ReactNode;
  /** Right is the constructive direction. Omit it and a right swipe springs back. */
  onSwipeRight?: () => void;
  /** Left is the destructive one, everywhere in the app. */
  onSwipeLeft?: () => void;
  rightLabel?: string;
  leftLabel?: string;
  className?: string;
}) {
  const [dx, setDx] = useState(0);
  const [sliding, setSliding] = useState(false);

  // Refs, not state: these change on every pointermove and none of them should render.
  const start = useRef<{ x: number; y: number } | null>(null);
  const engaged = useRef(false);

  const handlerFor = (offset: number) => (offset > 0 ? onSwipeRight : onSwipeLeft);

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    // Mouse right-clicks and multi-touch are not swipes.
    if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;
    start.current = { x: event.clientX, y: event.clientY };
    engaged.current = false;
    setSliding(false);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!start.current) return;
    const offsetX = event.clientX - start.current.x;
    const offsetY = event.clientY - start.current.y;

    if (!engaged.current) {
      // Still undecided. Anything more vertical than horizontal is the page's, and once it is
      // the page's it stays the page's — otherwise a diagonal scroll snags rows on the way past.
      if (Math.abs(offsetY) > Math.abs(offsetX) && Math.abs(offsetY) > SLOP) {
        start.current = null;
        return;
      }
      if (Math.abs(offsetX) < SLOP) return;
      engaged.current = true;
      setSliding(true);
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }

    // A direction with nothing behind it drags at a third speed: it moves enough to say "this
    // is a swipe and it does nothing here", and not enough to look like it is about to act.
    const resistance = handlerFor(offsetX) ? 1 : 0.33;
    setDx(Math.max(-MAX, Math.min(MAX, offsetX * resistance)));
  }

  function finish(event: React.PointerEvent<HTMLDivElement>) {
    if (!start.current) return;
    const travelled = dx;
    start.current = null;
    engaged.current = false;
    setSliding(false);
    setDx(0);
    event.currentTarget.releasePointerCapture?.(event.pointerId);

    if (Math.abs(travelled) < THRESHOLD) return;
    const handler = handlerFor(travelled);
    if (!handler) return;

    // The same tick a save gets. The gesture has no button to depress, so this is the only
    // confirmation that it took at all (§3.3).
    buzzSaved();
    handler();
  }

  const revealed = dx > 0 ? rightLabel : dx < 0 ? leftLabel : undefined;
  const travelled = Math.abs(dx);
  const committing = travelled >= THRESHOLD && handlerFor(dx) !== undefined;
  const destructive = dx < 0;
  const Icon = destructive ? Trash2Icon : CheckIcon;

  /**
   * Colour arrives before the icon (§5.3, Q199).
   *
   * Q199 asked for **both**, with the colour first, and the order is the whole point: the
   * colour is the answer to *what will this do*, which a thumb needs while the row is still
   * moving, and the icon is the confirmation, which is only worth the width once the gesture
   * has committed to a direction. A reveal that shows both at once says the same thing twice
   * at 10% opacity and neither legibly.
   *
   * So the ground ramps in over the first `SLOP`–`THRESHOLD` of travel and the icon fades in
   * over the second half of it. The label follows the icon, because a word at 40px of travel
   * is being read while the finger is still deciding.
   *
   * Written as an inline `style` rather than a class per state for the reason the tab bar's
   * sheet gives: this changes at 60fps and there is no set of classes that can express it.
   * `motion-reduce` is not needed here — nothing below animates on its own, it tracks a
   * finger, and a gesture that ignored the finger under reduced motion would simply be broken.
   */
  const ramp = Math.min(1, Math.max(0, (travelled - SLOP) / (THRESHOLD - SLOP)));
  const iconOpacity = Math.min(1, Math.max(0, (ramp - 0.5) * 2));

  return (
    <div className="relative overflow-hidden">
      {/* Behind the row. `aria-hidden` because the buttons inside the row already say all of
          this to anything that is not a thumb. */}
      {revealed && (
        <div
          aria-hidden
          style={{
            // `0.08 → 0.28` rather than `0 → 1`: this sits *behind* a row that stays opaque, so
            // what is visible is the strip either side of it. At full strength the strip reads
            // as a second row rather than as the row's own backing.
            backgroundColor: `color-mix(in oklab, var(${
              destructive ? "--destructive" : "--primary"
            }) ${(8 + ramp * 20).toFixed(1)}%, transparent)`,
          }}
          className={`absolute inset-0 flex items-center gap-2 px-4 ${
            dx > 0 ? "justify-start" : "justify-end"
          } ${destructive ? "text-destructive" : "text-primary"}`}
        >
          <span
            style={{ opacity: iconOpacity }}
            className={`flex items-center gap-2 ${committing ? "font-semibold" : ""}`}
          >
            <Icon className="icon-md" />
            {/* The label keeps the body face: it is a word, and DESIGN.md §2 rule 2 reserves
                mono for real data. It was `font-mono text-[0.65rem]`, which is 10.4px and under
                the 11px floor §7.1 turns into a gate. */}
            <span className="text-sm">{revealed}</span>
          </span>
        </div>
      )}

      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finish}
        onPointerCancel={finish}
        // Vertical panning belongs to the page, horizontal to this row. Set in the style rather
        // than a class so it cannot be purged, and because it has to be true before the first
        // event arrives.
        style={{
          touchAction: "pan-y",
          transform: dx === 0 ? undefined : `translateX(${dx}px)`,
          // No transition while the finger is down — the row must track it exactly. The spring
          // back on release is the only animated part, and `motion-reduce` drops it.
          transition: sliding ? "none" : undefined,
        }}
        className={`relative bg-card transition-transform duration-200 motion-reduce:transition-none ${className}`}
      >
        {children}
      </div>
    </div>
  );
}
