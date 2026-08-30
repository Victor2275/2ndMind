"use client";

import { useActionState, useEffect, useRef } from "react";

import { addInboxNote } from "@/app/private/actions";
import { TaskList, type TaskView } from "@/components/site/task-list";
import type { ActionState } from "@/lib/sprint-goals";

/**
 * The inbox: somewhere to put a thought without deciding where it goes.
 *
 * Victor asked for "a place to jot down random things for future organization" that nags.
 * Both halves matter — a capture box that does not nag becomes a write-only drawer, which
 * is the failure mode of every inbox that is only ever added to.
 *
 * The nag is age, not count. Ten things captured this morning is a productive morning; one
 * thing sitting untriaged for three weeks is the actual problem, and a count cannot tell
 * those apart.
 *
 * Client Component for the form's pending state. Nothing sensitive is hard-coded here —
 * this compiles into `/_next/static/chunks/`, served without authentication. Items arrive
 * as props at render time.
 */

/** Days before the panel starts pushing. A week is one triage cycle. */
const NAG_AFTER_DAYS = 7;

export function InboxPanel({ items, staleDays }: { items: TaskView[]; staleDays: number }) {
  const [state, action, pending] = useActionState<ActionState | null, FormData>(addInboxNote, null);
  const form = useRef<HTMLFormElement>(null);

  // Clear on success so the next thought can go straight in. Capture is meant to be
  // repeatable without touching the mouse.
  useEffect(() => {
    if (state?.ok) form.current?.reset();
  }, [state]);

  const nagging = staleDays >= NAG_AFTER_DAYS;

  return (
    <div>
      <form ref={form} action={action} className="flex gap-2">
        <input
          name="title"
          placeholder="Jot it down…"
          autoComplete="off"
          className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm transition-colors outline-none placeholder:text-muted-foreground/70 focus:border-primary/60"
        />
        <button
          type="submit"
          disabled={pending}
          className="shrink-0 rounded-md border border-primary/50 px-3 py-2 font-mono text-xs text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
        >
          {pending ? "…" : "Capture"}
        </button>
      </form>

      {state && !state.ok && <p className="mt-2 text-xs text-destructive">{state.message}</p>}

      {nagging && (
        <p className="mt-3 rounded-md border border-highlight/40 bg-highlight/10 px-3 py-2 text-xs text-foreground">
          Oldest note has been sitting {staleDays} days. Give it a domain and a date, or delete it.
        </p>
      )}

      <div className="mt-3">
        <TaskList
          tasks={items}
          emptyMessage="Empty. Anything that does not have a home yet goes here."
        />
      </div>
    </div>
  );
}
