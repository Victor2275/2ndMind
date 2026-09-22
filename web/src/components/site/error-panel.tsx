"use client";

import { useActionState } from "react";

import { resolveErrorReport } from "@/app/private/actions";
import { useAnnounce } from "@/components/site/announcer";
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
  useAnnounce(state);

  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="eyebrow text-muted-foreground">
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
            className="min-h-8 rounded-md border border-border px-2.5 font-mono text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
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

/**
 * One line by default, the list one tap away (V3 §3.1).
 *
 * It shipped as an open list of full-height cards, and on its first real day it had five
 * things to say — which pushed the first task on the dashboard to **936px**, past the 791px
 * D-083 was written to fix. That is the panel undoing the page it sits on: a report about
 * something being broken had made the working part unreachable.
 *
 * Collapsing costs something real — a closed thing is read less than an open one — so the
 * summary line does the work instead. It names the top problem and its count, in a red border,
 * above everything else on the page. What is behind the disclosure is the *other four* and the
 * "dealt with" buttons, which are follow-up rather than news.
 *
 * `<details>` rather than state: no hydration boundary, keyboard-accessible for free, and it
 * opens before this component's JavaScript has loaded.
 */
export function ErrorPanel({ errors }: { errors: ErrorView[] }) {
  if (errors.length === 0) return null;

  const [worst] = errors;
  const others = errors.length - 1;

  return (
    <details className="group mt-6 overflow-hidden rounded-lg border border-destructive/40 bg-destructive/5">
      <summary className="cursor-pointer list-none px-4 py-3 transition-colors hover:bg-destructive/10 [&::-webkit-details-marker]:hidden">
        <div className="flex items-baseline gap-2">
          <span className="shrink-0 font-mono text-[0.7rem] text-muted-foreground transition-transform group-open:rotate-90">
            &rsaquo;
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold tracking-tight text-foreground">
              Something is broken
            </p>
            {/* The top problem by name, not just a count. "5 errors" tells you nothing you can
                act on; "workout_set row has no clientId, 11 times" is the whole finding. */}
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {worst.name}
              {worst.message && ` — ${worst.message}`}
            </p>
          </div>
          <span className="tabular shrink-0 font-mono text-[0.6rem] text-muted-foreground">
            {worst.seenCount}×{others > 0 && ` +${others}`}
          </span>
        </div>
      </summary>

      <ul className="divide-y divide-border border-t border-destructive/40">
        {errors.map((error) => (
          <Row key={error.id} error={error} />
        ))}
      </ul>

      {/* Said plainly, because "dealt with" is not "fixed" and the difference matters when the
          same thing reappears next week. */}
      <p className="px-4 py-3 text-xs text-muted-foreground">
        Marking one dealt with hides it. It comes back on its own if it happens again.
      </p>
    </details>
  );
}
