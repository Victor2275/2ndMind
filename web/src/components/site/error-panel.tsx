"use client";

import { useActionState } from "react";

import { resolveErrorReport } from "@/app/private/actions";
import type { ActionState } from "@/lib/sprint-goals";

/**
 * What is currently broken (V3 §2.4, D-165).
 *
 * The whole feature's payoff is this panel, and its most important property is that it is
 * **not here most of the time**. Aggregation only helps if a report is read; a panel that is
 * always on screen showing "0 errors" is a panel that stops being read within a week, and then
 * the one time it says something the eye goes past it.
 *
 * So: nothing renders unless something is open, and something recent. Same rule the unsorted
 * pile follows (D-164).
 *
 * Nothing sensitive may be hard-coded here. The text it renders arrives as props at render
 * time — the app's own error messages, already scrubbed twice on the way in.
 */

export type ErrorView = {
  id: number;
  source: string;
  name: string;
  message: string;
  route: string;
  agent: string;
  seenCount: number;
  lastSeenAt: string;
  buildId: string;
};

const AGE = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Los_Angeles",
});

function Row({ error }: { error: ErrorView }) {
  const [state, resolve] = useActionState<ActionState | null, FormData>(resolveErrorReport, null);

  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-mono text-[0.55rem] tracking-[0.14em] text-muted-foreground uppercase">
          {error.source}
          {error.route && ` · ${error.route}`}
          {error.agent && ` · ${error.agent}`}
        </span>
        <span className="shrink-0 font-mono text-[0.6rem] text-muted-foreground tabular-nums">
          {/* The count first, because "once" and "four thousand times" are different problems
              with the same message. */}
          {error.seenCount}× · {AGE.format(new Date(error.lastSeenAt))}
        </span>
      </div>

      <p className="mt-1 text-sm text-foreground">
        <span className="font-medium">{error.name}</span>
        {error.message && <span className="text-muted-foreground"> — {error.message}</span>}
      </p>

      <div className="mt-2 flex items-center gap-3">
        <form action={resolve}>
          <input type="hidden" name="id" value={error.id} />
          <button
            type="submit"
            className="min-h-8 rounded-md border border-border px-2.5 font-mono text-[0.6rem] text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
          >
            dealt with
          </button>
        </form>

        {error.buildId && (
          <span className="font-mono text-[0.55rem] text-muted-foreground">{error.buildId}</span>
        )}
        {state && !state.ok && <span className="text-xs text-destructive">{state.message}</span>}
      </div>
    </li>
  );
}

export function ErrorPanel({ errors }: { errors: ErrorView[] }) {
  if (errors.length === 0) return null;

  return (
    <section className="mt-8">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold tracking-tight">Something is broken</h2>
        <span className="font-mono text-[0.65rem] text-muted-foreground tabular-nums">
          {errors.length}
        </span>
      </div>
      <ul className="divide-y divide-border overflow-hidden rounded-lg border border-destructive/40 bg-destructive/5">
        {errors.map((error) => (
          <Row key={error.id} error={error} />
        ))}
      </ul>
      {/* Said plainly, because "dealt with" is not "fixed" and the difference matters when the
          same thing reappears next week. */}
      <p className="mt-2 text-xs text-muted-foreground">
        Marking one dealt with hides it. It comes back on its own if it happens again.
      </p>
    </section>
  );
}
