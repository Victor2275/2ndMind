"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

/**
 * The one live region — V4 §7.4 (Q449), D-313.
 *
 * Q449 asks for screen-reader announcements on async saves, and specifies **one** live region.
 * Before this there were twenty: every form using `useActionState` rendered its own
 * `<p role="status">` beside its save button, which is an implicit `aria-live="polite"` region
 * each.
 *
 * Twenty regions is not twenty times the coverage. It is worse than one, in three ways:
 *
 *  - **The saves with no visible message were silent.** Ticking a task, swiping a row away,
 *    the outbox flushing in the background — none of those render a status paragraph, so none
 *    of them said anything. Those are the saves most worth announcing, because they are the
 *    ones with no other feedback.
 *  - **A region announces only if it was in the DOM before the text changed.** Most of these
 *    paragraphs are rendered conditionally on `state &&`, so the element that was supposed to
 *    announce the result *is created by* the result. Screen readers differ on whether they
 *    catch that; several do not. This one is mounted empty by the layout, always, which is the
 *    arrangement the whole mechanism depends on.
 *  - **Concurrent regions interleave.** Two forms resolving together produce two announcements
 *    racing, and the usual outcome is that one is dropped.
 *
 * The visible message stays exactly where it was. What the forms give up is the `role`, not the
 * text: a message next to the button you pressed is good design and is not in question. This
 * just stops each copy being its own announcer.
 */

/* ------------------------------------------------------------------------------------------
   The store

   Module-level rather than context, so `announce()` can be called from places that are not
   React at all — the sync runner's flush callback is the one that matters, and wrapping the
   app in a provider to reach it would put a client boundary above every private page.
   ------------------------------------------------------------------------------------------ */

let message = "";
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function snapshot() {
  return message;
}

/** The server render is always the empty region; nothing has happened yet. */
function serverSnapshot() {
  return "";
}

/**
 * Say something once, politely.
 *
 * Repeating the identical string is a real case — saving the same form twice, two tasks ticked
 * with the same confirmation — and setting a live region to the text it already holds is not a
 * mutation, so nothing is announced. The zero-width space makes the second one a different
 * string without making it a different sentence.
 */
export function announce(text: string) {
  if (!text) return;
  message = text === message ? text + "​" : text;
  for (const listener of listeners) listener();
}

/** Test seam, matching `resetOutboxStatus`. Clears both the message and the subscribers. */
export function resetAnnouncer(): void {
  message = "";
  listeners.clear();
}

/* ------------------------------------------------------------------------------------------
   The region
   ------------------------------------------------------------------------------------------ */

/**
 * Mounted once, by the private layout, and empty.
 *
 * `aria-live="polite"` rather than `assertive`: a save confirmation is not worth interrupting
 * what is being read. Errors go through here too and are also polite — an `assertive` region
 * for failures would mean the one case where you are most likely to be mid-sentence reading
 * the field that failed is the one case that cuts you off.
 *
 * `aria-atomic` so the whole message is read rather than the diff, which for a replaced string
 * is the difference between "Saved" and a stream of changed characters.
 */
export function Announcer() {
  const text = useSyncExternalStore(subscribe, snapshot, serverSnapshot);

  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {text}
    </div>
  );
}

/* ------------------------------------------------------------------------------------------
   The form hook
   ------------------------------------------------------------------------------------------ */

/**
 * The shape this hook needs, which is deliberately *not* `ActionState`.
 *
 * Three different result types flow through the private app's forms — `ActionState`,
 * `TailorState` and `ProposalState` — and they agree on exactly the two fields that matter
 * here. Naming the structural minimum lets all three pass without a cast and without this
 * module importing any of them. `message` is optional because `TailorState`'s is; a result
 * whose whole content is `advice` has nothing to read out, and is skipped below.
 */
type Announceable = {
  ok: boolean;
  message?: string;
  queued?: boolean;
};

/**
 * Announces a form result when it arrives, and again whenever it changes.
 *
 * Called by every form that renders one. The identity check is on the object, not the string:
 * React gives a new state object per submission, so submitting twice with the same outcome
 * announces twice — which is correct, because two saves happened.
 *
 * `queued` is spelled out rather than left to the message (§5.2's reason for the field
 * existing): "Saved" and "Saved on this phone, and it will send when you reconnect" are
 * different outcomes, and the one thing a screen-reader user cannot do is glance at the
 * outbox pill to tell which they got.
 */
export function useAnnounce(state: Announceable | null | undefined) {
  const last = useRef<Announceable | null | undefined>(null);

  useEffect(() => {
    if (!state || state === last.current) return;
    last.current = state;
    if (!state.message) return;
    announce(state.queued ? `${state.message} Queued on this device.` : state.message);
  }, [state]);
}
