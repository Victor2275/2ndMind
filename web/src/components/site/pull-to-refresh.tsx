"use client";

import { useEffect, useRef, useState } from "react";

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

      if (!wasArmed || travelled < THRESHOLD * 0.5) return;
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

  const ready = pull >= THRESHOLD * 0.5;
  if (pull === 0 && !syncing) return null;

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
        className={`rounded-full border bg-card/95 px-3 py-1 font-mono text-[0.6rem] shadow-lg backdrop-blur-md transition-colors ${
          syncing || ready
            ? "border-primary/50 text-primary"
            : "border-border text-muted-foreground"
        }`}
      >
        {syncing ? "Sending…" : ready ? "Release to send" : "Pull to send"}
      </span>
    </div>
  );
}
