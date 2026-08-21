"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { appendLogbookEntry } from "@/app/private/actions";
import type { ActionState } from "@/lib/sprint-goals";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md border border-primary/50 px-4 py-2 text-sm text-primary transition-all duration-300 hover:-translate-y-0.5 hover:border-primary hover:bg-primary/10 hover:shadow-[0_0_20px_-6px_var(--primary)] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Committing…" : "Append entry"}
    </button>
  );
}

export function LogbookForm() {
  const [state, action] = useActionState<ActionState | null, FormData>(
    appendLogbookEntry,
    null,
  );

  return (
    <form action={action} className="mt-6 space-y-4">
      <textarea
        name="entry"
        rows={5}
        required
        className="w-full resize-y rounded-md border border-border bg-card/70 px-3 py-2 text-sm text-foreground transition-colors focus:border-primary/60 focus:outline-none"
        placeholder={"One thing per line.\nThey become bullets under today's date."}
      />
      <div className="flex flex-wrap items-center gap-4">
        <SaveButton />
        {state && (
          <p
            role="status"
            className={
              state.ok ? "font-mono text-xs text-primary" : "font-mono text-xs text-destructive"
            }
          >
            {state.message}{" "}
            {state.ok && state.url && (
              <a href={state.url} className="underline underline-offset-4">
                view commit
              </a>
            )}
          </p>
        )}
      </div>
    </form>
  );
}
