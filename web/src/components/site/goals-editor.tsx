"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { saveSprintGoals } from "@/app/private/actions";
import { GOAL_DOMAINS, type ActionState } from "@/lib/sprint-goals";

/**
 * The week's three goals, inline on the Today screen.
 *
 * V1 put these behind a separate `/private/sprint` page, so setting them was a navigation
 * plus a page load plus a git commit. They are rows in `tasks` now (D-037), which makes
 * saving a database write with no commit and no deploy — fast enough to belong on the
 * screen where they are read.
 */

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md border border-primary/50 px-3 py-1.5 font-mono text-xs text-primary transition-colors hover:border-primary hover:bg-primary/10 disabled:opacity-60"
    >
      {pending ? "Saving…" : "Save goals"}
    </button>
  );
}

export function GoalsEditor({ values }: { values: Record<string, string> }) {
  const [state, action] = useActionState<ActionState | null, FormData>(saveSprintGoals, null);

  return (
    <form action={action} className="space-y-3">
      {GOAL_DOMAINS.map((domain) => (
        <div key={domain.key}>
          <label htmlFor={`goal-${domain.key}`} className="eyebrow text-muted-foreground">
            {domain.label}
          </label>
          <input
            id={`goal-${domain.key}`}
            name={domain.key}
            defaultValue={values[domain.key] ?? ""}
            placeholder="Leave blank to clear"
            className="mt-1 w-full rounded-md border border-border bg-card/60 px-3 py-1.5 text-sm text-foreground transition-colors focus:border-primary/60 focus:outline-none"
          />
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <SaveButton />
        {state && (
          <p
            role="status"
            className={`font-mono text-xs ${state.ok ? "text-primary" : "text-destructive"}`}
          >
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
