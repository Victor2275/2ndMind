"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { buzzSaved } from "@/lib/haptics";
import { useFormStatus } from "react-dom";

import { captureQuick } from "@/app/private/log/actions";
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

const INPUT =
  "w-full rounded-md border border-border bg-card/60 px-3 py-2 text-sm text-foreground transition-colors focus:border-primary/60 focus:outline-none";

function SendButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-10 shrink-0 rounded-md border border-primary/50 px-3 text-sm text-primary transition-colors hover:border-primary hover:bg-primary/10 disabled:opacity-60"
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
      className="rounded-xl border border-border bg-card/40 p-3"
    >
      <input type="hidden" name="as" value={as} />

      <div className="flex items-center gap-2">
        <input
          ref={input}
          name="text"
          // Only ever true when the launcher shortcut asked for it (§3.5).
          autoFocus={autoFocus}
          autoComplete="off"
          placeholder={as === "task" ? "Something to do…" : "Something on your mind…"}
          aria-label={as === "task" ? "Capture a task" : "Capture a note"}
          className={INPUT}
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
              className={`min-h-8 rounded-md px-2.5 font-mono text-[0.6rem] tracking-[0.1em] uppercase transition-colors ${
                as === mode
                  ? "bg-primary/12 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {mode}
            </button>
          ))}
        </div>

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
