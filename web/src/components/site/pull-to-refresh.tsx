"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpIcon, Loader2Icon } from "lucide-react";

import { requestSync, SYNC_DONE_EVENT } from "@/components/site/sync-runner";

/**
 * Pull down at the top of a private screen to flush the outbox (V3 §3.3).
 *
 * The gesture people already try by reflex. Before this it did nothing anywhere, and the only
 * way to force a sync was to background the app and come back — which is not a thing anyone
 * thinks of, and is why an outbox could sit longer than expected after a failed attempt (there
 * is no timer; a run happens on reconnect, on foreground, or when something asks).
 *
 * Mounted in the private layout, so it is on **every** private screen. Consistency is the whole
 * value: a gesture that works on four screens out of ten is worse than one that works nowhere,
 * because the four teach you to expect it and the six make you doubt yourself.
 *
 * **Not on the offline shell.** There it would ask for a flush that cannot happen, and a
 * spinner that resolves to nothing is a worse answer than no gesture at all. The shell already
 * sends by itself the moment signal returns (D-175).
 *
 * ## Not fighting the page
 *
 * It arms only when the page is already scrolled to the top and the finger moves **down**.
 * Anywhere else, and in any other direction, the listener releases immediately and the page
 * scrolls as it always did. The indicator is `fixed` and `pointer-events: none`, so it can
 * never swallow a tap meant for the page underneath.
 */

/** How far down before the pull counts. Roughly a thumb's comfortable travel. */
const THRESHOLD = 72;

/**
 * The distance at which letting go actually sends — and the number the ring fills to.
 *
 * `THRESHOLD * 0.5` was written out at both places that needed it and named at neither, which
 * hid a real disagreement the moment §5.3 drew progress: the release fires at 36px and the ring
 * would have completed at 72, so the indicator would have said "keep pulling" through the
 * entire second half of a gesture that was already going to work. Naming it is what makes the
 * drawing and the behaviour the same fact.
 */
const RELEASE = THRESHOLD * 0.5;

/** Past this the indicator stops following, so a hard pull does not drag the page apart. */
const MAX = 96;

export function PullToRefresh() {
  const [pull, setPull] = useState(0);
  const [syncing, setSyncing] = useState(false);

  // Refs, not state: these change on every move and none of them should cause a render.
  const start = useRef<number | null>(null);
  const armed = useRef(false);

  // The listeners below are registered once and must not be torn down on every move, so how
  // far the pull has travelled lives in a ref and the state is only what gets rendered. Closing
  // over `pull` instead would measure the first pixel of the gesture and decide on that; and
  // writing the ref during render, which is the other obvious shortcut, is what
  // `react-hooks/refs` exists to stop.
  const pullRef = useRef(0);

  useEffect(() => {
    const done = () => setSyncing(false);
    window.addEventListener(SYNC_DONE_EVENT, done);
    return () => window.removeEventListener(SYNC_DONE_EVENT, done);
  }, []);

  useEffect(() => {
    function onDown(event: PointerEvent) {
      // Only from the very top, and only a real first touch. Anywhere else this is a scroll and
      // never becomes anything else.
      if (!event.isPrimary || window.scrollY > 0) return;
      start.current = event.clientY;
      armed.current = false;
    }

    function onMove(event: PointerEvent) {
      if (start.current === null) return;
      const travelled = event.clientY - start.current;

      // Upward, or the page has scrolled under us: give it up and do not take it back for the
      // rest of this gesture.
      if (travelled <= 0 || window.scrollY > 0) {
        start.current = null;
        pullRef.current = 0;
        setPull(0);
        return;
      }

      armed.current = true;
      // Damped, so the indicator reads as resisting rather than as the page tearing off.
      const next = Math.min(MAX, travelled * 0.5);
      pullRef.current = next;
      setPull(next);
    }

    function onUp() {
      const travelled = pullRef.current;
      const wasArmed = armed.current;
      start.current = null;
      armed.current = false;
      pullRef.current = 0;
      setPull(0);

      if (!wasArmed || travelled < RELEASE) return;
      setSyncing(true);
      // The same event §1.7's retry screen uses. Nothing here knows how to sync, and nothing
      // here should — this is a trigger, and `SyncRunner` owns what a trigger means.
      requestSync();
    }

    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    window.addEventListener("pointercancel", onUp, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, []);

  const ready = pull >= RELEASE;
  if (pull === 0 && !syncing) return null;

  /**
   * The indicator, designed (§5.3, Q200).
   *
   * What it was: a pill with a 9.6px mono sentence in it — under the 11px floor §7.1 turns
   * into a gate — that changed its wording twice and its colour once, and said nothing at all
   * about *how far there is left to pull*. A pull gesture with no progress is a guess, and the
   * way a guess fails is that you let go early, nothing happens, and you conclude the gesture
   * does not exist.
   *
   * So the progress is now the drawing rather than the words: a ring that fills as the finger
   * travels, completing exactly at the release point. Three states, distinguished by shape as
   * well as colour (DESIGN.md §2 rule 1) — an arrow that points down while there is further to
   * go, the same arrow rotated to point up once releasing would send, and a spinner while it
   * sends.
   *
   * The ring is an SVG `stroke-dasharray` rather than a `conic-gradient`, because a conic
   * gradient cannot be a ring without a second element masking its middle, and because this
   * needs to work under `forced-colors`, which §7.4 audits for.
   */
  const progress = Math.min(1, pull / RELEASE);
  const CIRCUMFERENCE = 2 * Math.PI * 9;

  return (
    <div
      // Never over the middle of the screen and never interactive: an indicator that can be
      // tapped is an indicator that can eat a tap meant for a task. `pointer-events-none` is
      // what makes that true — not `aria-hidden`, which was here first and was wrong: it hid a
      // live "Sending…" from the accessibility tree, which is exactly the part worth announcing.
      className="pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center print:hidden"
      style={{ transform: `translateY(${syncing ? 12 : Math.max(0, pull - 8)}px)` }}
    >
      <span
        role="status"
        aria-live="polite"
        className={`flex items-center gap-2 rounded-full border bg-card/95 py-1 pr-3 pl-1.5 text-xs shadow-lg backdrop-blur-md transition-colors duration-fast ease-standard ${
          syncing || ready
            ? "border-primary/50 text-primary"
            : "border-border text-muted-foreground"
        }`}
      >
        <span className="relative grid size-5 place-items-center">
          <svg viewBox="0 0 22 22" className="absolute size-5 -rotate-90">
            {/* The track. Faint, so the ring reads as filling rather than as changing colour. */}
            <circle cx="11" cy="11" r="9" className="fill-none stroke-border stroke-2" />
            <circle
              cx="11"
              cy="11"
              r="9"
              className="fill-none stroke-current stroke-2"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              // Full circle at `RELEASE`, not at `MAX` and not at `THRESHOLD`: the ring
              // completing is the signal that letting go will do something, so it has to
              // complete exactly where that becomes true.
              strokeDashoffset={CIRCUMFERENCE * (1 - (syncing ? 1 : progress))}
            />
          </svg>

          {syncing ? (
            <Loader2Icon aria-hidden className="size-3 animate-spin" />
          ) : (
            // One arrow, rotated. Down while there is further to pull, up once releasing sends
            // — the shape carries the state, so the colour is not doing it alone.
            <ArrowUpIcon
              aria-hidden
              className={`size-3 transition-transform duration-fast ease-standard ${
                ready ? "" : "rotate-180"
              }`}
            />
          )}
        </span>

        {syncing ? "Sending…" : ready ? "Release to send" : "Pull to send"}
      </span>
    </div>
  );
}
