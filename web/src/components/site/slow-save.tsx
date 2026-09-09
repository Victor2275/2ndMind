"use client";

import { useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";

/**
 * Saying so when a save is taking too long (V4 Phase N5).
 *
 * ## Why a watchdog rather than a deadline
 *
 * Everywhere else in Phase N the fix is to give the request a deadline. That is not available
 * here: these forms submit through **Server Actions**, which are framework-owned POSTs. There is
 * no `fetch` call to wrap and nowhere to hand an `AbortSignal`, so the request cannot be
 * timed out from outside — the only thing the app can observe is that `pending` is still true.
 *
 * So this observes exactly that, and does the one useful thing left: it stops the silence. A
 * disabled button that has said "Saving…" for fifteen seconds is indistinguishable from an app
 * that has crashed, and the reasonable response to an app that has crashed is to close it —
 * which is the single worst thing to do here.
 *
 * ## The wording is deliberately smaller than the plan's
 *
 * `DEGRADED_NETWORK.md` proposed *"still trying; this is saved on the device either way"*. That
 * sentence is **false in the live app**. Only the cached shell writes through the outbox; a form
 * under `/private` posts straight to a Server Action and there is no local copy of anything. The
 * message would have offered a guarantee precisely where it does not exist, and someone acting
 * on it — closing the app, confident the entry was safe — would lose the entry.
 *
 * It says the true, smaller thing instead. Making the larger sentence true is the outbox-always
 * work, tracked as N9; when that lands, this wording should change with it (D-206).
 *
 * ## The button stays disabled
 *
 * The plan's phrase "instead of a disabled button" is about the *silence*, not the disabling.
 * Re-enabling submit while a POST may still be in flight buys a duplicate entry, which is worse
 * than the problem being solved.
 */

/**
 * How long a save may take before the app admits something is wrong.
 *
 * Six seconds, and the number is doing real work in both directions. Shorter and it fires on an
 * ordinary slow-but-fine connection, which trains you to ignore it. Longer and it arrives after
 * the point where a person has already decided the app is broken.
 *
 * Deliberately not one of `lib/net/deadline.ts`'s budgets. Those bound a request the app can
 * cancel; this one bounds a person's patience for a request it cannot.
 *
 * It is a parameter rather than a constant read straight from module scope so that this can be
 * tested against a real `<form>` and a real Server Action in a fraction of a second. Faking
 * timers around React's form machinery does not work — the action's own pending state comes
 * apart when the clock is moved under it — and a test that waited six real seconds per case is
 * a test that gets deleted.
 */
export const SLOW_SAVE_MS = 6_000;

/**
 * The notice. Present in the DOM from the start and hidden, revealed by a timer.
 *
 * ## Why it does not use React state, which is what you would reach for first
 *
 * **A `setState` anywhere inside a `<form>` ends `useFormStatus().pending` for every component
 * reading it, while the action's promise is still unresolved.** Measured on React 19.2.8: a
 * sibling that flips one boolean takes the save button — which is `disabled={pending}` — out of
 * its pending state and re-enables it, mid-POST.
 *
 * The first version of this component did exactly that, and it would have shipped a worse bug
 * than the one it fixes: at six seconds the notice would appear for a frame, the button would
 * come back to life while the request was still in flight, and the obvious thing to do with a
 * re-enabled Save button is press it again. A duplicated entry is a much more expensive failure
 * than a silent one. See D-207.
 *
 * So the component renders **once**, hidden, and a timer toggles `hidden` through a ref. No
 * state, no re-render, nothing for React's form machinery to notice. This is one of the few
 * places where writing to the DOM directly is not a shortcut — it is the only way to say
 * something without disturbing the thing being described.
 *
 * `role="status"` rather than `alert`: this is information, not an error, and a screen reader
 * should hear it without interrupting whatever the user is doing. `hidden` keeps it out of the
 * accessibility tree until it is true, so it is announced when it appears rather than on load.
 */
export function SlowSaveNotice({ after = SLOW_SAVE_MS }: { after?: number } = {}) {
  const { pending } = useFormStatus();
  const notice = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (!pending) return;

    // Captured here rather than read as `notice.current` in the cleanup: by the time cleanup
    // runs the ref may already point somewhere else, and the node that needs re-hiding is the
    // one this effect was set up for.
    const node = notice.current;
    const timer = setTimeout(() => {
      if (node) node.hidden = false;
    }, after);

    // Hidden again on the way out, which covers both endings: the save landed, or the form
    // was replaced. Doing it here rather than in the effect body keeps the "not pending" path
    // free of any work at all.
    return () => {
      clearTimeout(timer);
      if (node) node.hidden = true;
    };
  }, [pending, after]);

  return (
    <p ref={notice} hidden role="status" className="text-xs text-muted-foreground">
      Still trying — the connection is slow. Keep this open until it saves.
    </p>
  );
}
