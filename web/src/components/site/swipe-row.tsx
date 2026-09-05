"use client";

import { useRef, useState, type ReactNode } from "react";

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
  const committing = Math.abs(dx) >= THRESHOLD && handlerFor(dx) !== undefined;

  return (
    <div className="relative overflow-hidden">
      {/* Behind the row. `aria-hidden` because the buttons inside the row already say all of
          this to anything that is not a thumb. */}
      {revealed && (
        <div
          aria-hidden
          className={`absolute inset-0 flex items-center px-4 font-mono text-[0.65rem] tracking-wide ${
            dx > 0 ? "justify-start" : "justify-end"
          } ${
            dx < 0
              ? committing
                ? "bg-destructive/25 text-destructive"
                : "bg-destructive/10 text-destructive/70"
              : committing
                ? "bg-primary/25 text-primary"
                : "bg-primary/10 text-primary/70"
          }`}
        >
          {revealed}
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
