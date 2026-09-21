"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { captureQuick } from "@/app/private/log/actions";
import { CONTROL_FULL } from "@/components/site/field";
import { SlowSaveNotice } from "@/components/site/slow-save";
import { buzzSaved } from "@/lib/haptics";
import type { ActionState } from "@/lib/sprint-goals";

/**
 * One line, no category (V3, D-164).
 *
 * The whole point is that it asks nothing. A capture box that wants to know which category
 * something belongs to is a filing form, and filing is the work being deferred — `addInboxNote`
 * already records that reasoning for tasks, and this is the same idea for everything else.
 *
 * It sits **above** the tabs and stays there whichever category is selected, so the fastest
 * path through the log page is: type, send. Nothing to choose first.
 *
 * The one choice it does ask is note-or-task, because they go to different places and only the
 * writer knows which a sentence is. "That stroke cue worked" is a note; "email the coach" is a
 * task with a checkbox and a due date it may one day need. It defaults to note — the cheaper
 * mistake, because a note can be filed later and a task nobody meant sits in a list demanding
 * to be ticked.
 *
 * Nothing sensitive may be hard-coded here: this compiles into `/_next/static/chunks/`.
 */

/* The local `INPUT` constant that used to be here is gone (§5.4). It was a fourth spelling of
   a control — `py-2 text-sm`, so 36px on the screen where Q245 asked for 48, and 14px text on
   the one iOS zooms the viewport for. `CONTROL_FULL` is §5.2's shared string. */

function SendButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      // Filled, not outlined. This is the primary action of the loudest block on Today, and
      // §5.2's vocabulary reserves the filled button for exactly that — everything else in
      // this component is an outline or a text control, so there is one obvious target.
      className="min-h-12 shrink-0 press rounded-control bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors duration-fast ease-standard hover:bg-primary/90 disabled:opacity-60"
    >
      {pending ? "…" : "Save"}
    </button>
  );
}

export function QuickCapture({
  write = captureQuick,
  autoFocus = false,
  firstAction = false,
}: {
  /** Overridden on the offline shell, which enqueues instead of posting (§2.2). */
  write?: (prev: ActionState | null, formData: FormData) => Promise<ActionState>;
  /**
   * Set by the icon's "Quick note" shortcut, which arrives at `/private?capture=1` (§3.5).
   * Off everywhere else: a box that grabs the keyboard on every visit to Today would cover
   * half the screen with a keyboard nobody asked for.
   */
  autoFocus?: boolean;
  /**
   * Marks this box as what `npm run shots` measures the fold to (§3.2).
   *
   * True on `/private/log`, where getting a thought out of your head is the action the page
   * exists for. False on Today, where the Due list is the answer and this box sits below it —
   * marking both there made the gate measure whichever was lower and stop watching the list
   * (D-182).
   */
  firstAction?: boolean;
}) {
  const [state, action] = useActionState<ActionState | null, FormData>(write, null);
  const [as, setAs] = useState<"note" | "task">("note");
  const input = useRef<HTMLInputElement>(null);

  /**
   * Put the text back if the save failed.
   *
   * React blanks a function-action form as soon as the action returns, success or not. Here
   * that matters more than anywhere else in the app: the entire premise is that a thought is
   * captured before it is lost, and losing it to a failed save would be the one failure this
   * box cannot afford.
   */
  const typed = useRef("");
  const settled = useRef<ActionState | null>(null);
  useEffect(() => {
    if (!state || state === settled.current) return;
    settled.current = state;
    if (state.ok) buzzSaved();
    if (!state.ok && input.current) input.current.value = typed.current;
  }, [state]);

  return (
    <form
      // The fold check measures to this box on /private/log (§3.2). Getting a thought out of
      // your head is the action that page exists for; the tabs and the structured form below
      // are what you use once you have decided to be precise about it. Set by the caller, so
      // that stays true of the log page and does not become true of every page it appears on.
      data-first-action={firstAction || undefined}
      action={(formData) => {
        typed.current = String(formData.get("text") ?? "");
        return action(formData);
      }}
      /* **The loudest thing on Today** (§5.4, Q380).
       *
       * Q380 asked for the capture box to be separated from the task list rather than
       * continuous with it, and Q5 records it as the part of the app Victor would be annoyed
       * to lose. It was a `border-border bg-card/40` rectangle — the quietest surface in the
       * app, and visually a footer to the list above it.
       *
       * Primary border, primary tint, and its own label. It does **not** move above the Due
       * list: D-182 measured what that costs (the first task at 495px on a desktop, five pixels
       * under the limit two decisions exist to defend), and loudness is a property of the thing,
       * not of its position. Being the brightest block on the page is what makes it findable;
       * being above the answer is what made it a problem.
       */
      className="rounded-xl border border-primary/40 bg-primary/5 p-4"
    >
      <input type="hidden" name="as" value={as} />

      <p className="mb-2 eyebrow text-primary">Capture</p>

      <div className="flex items-center gap-2">
        <input
          ref={input}
          name="text"
          // Only ever true when the launcher shortcut asked for it (§3.5).
          autoFocus={autoFocus}
          autoComplete="off"
          placeholder={as === "task" ? "Something to do…" : "Something on your mind…"}
          aria-label={as === "task" ? "Capture a task" : "Capture a note"}
          className={CONTROL_FULL}
        />
        <SendButton />
      </div>

      <div className="mt-2 flex items-center justify-between gap-3">
        <div className="flex gap-1">
          {(["note", "task"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setAs(mode)}
              aria-pressed={as === mode}
              // `min-h-11` is DESIGN.md §9's 44px. It was `min-h-8` — 32px — on the one
              // control in this box that is tapped before typing.
              className={`min-h-11 press rounded-control px-3 eyebrow transition-colors duration-fast ease-standard ${
                as === mode
                  ? "bg-primary/12 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {mode}
            </button>
          ))}
        </div>

        {/* Phase N5, and it sits above the result line rather than replacing it: one is what
            happened, the other is that nothing has yet. */}
        <SlowSaveNotice />

        {state && (
          <p
            role="status"
            className={`text-xs ${state.ok ? "text-muted-foreground" : "text-destructive"}`}
          >
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
