"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { recordBodyweightAction } from "@/app/private/athletics/actions";
import { SlowSaveNotice } from "@/components/site/slow-save";
import type { ActionState } from "@/lib/athletics/forms";

/**
 * A morning weigh-in.
 *
 * Two fields and a date that is already filled in, because this gets typed half-awake and a
 * form that takes more than one tap plus three digits will not get used. Re-submitting the
 * same day overwrites rather than appending — see `recordBodyweight`.
 *
 * Nothing sensitive is hard-coded here. This compiles into a publicly served client chunk, so
 * the placeholder is a generic number and no real reading, target or range appears in the
 * source. Values reach it only as props at render time.
 */

function todayLocal(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

const FIELD =
  "w-full rounded-md border border-border bg-card/70 px-2.5 py-1.5 font-mono text-xs text-foreground transition-colors focus:border-primary/60 focus:outline-none";

const LABEL = "eyebrow text-muted-foreground";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md border border-primary/50 px-4 py-2 text-sm text-primary transition-all duration-300 hover:-translate-y-0.5 hover:border-primary hover:bg-primary/10 hover:shadow-[0_0_20px_-6px_var(--primary)] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Saving…" : "Record"}
    </button>
  );
}

export function BodyweightForm() {
  const [state, action] = useActionState<ActionState | null, FormData>(
    recordBodyweightAction,
    null,
  );

  return (
    <form action={action} className="mt-5 space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className={LABEL} htmlFor="bw-date">
            Day
          </label>
          <input
            id="bw-date"
            type="date"
            name="measuredOn"
            required
            defaultValue={todayLocal()}
            className={`${FIELD} mt-1`}
          />
        </div>
        <div>
          <label className={LABEL} htmlFor="bw-weight">
            Weight (lb)
          </label>
          <input
            id="bw-weight"
            name="weightLbs"
            inputMode="decimal"
            required
            className={`${FIELD} mt-1`}
            placeholder="000.0"
          />
        </div>
        <div>
          <label className={LABEL} htmlFor="bw-note">
            Note
          </label>
          <input id="bw-note" name="note" className={`${FIELD} mt-1`} placeholder="post-practice" />
        </div>
      </div>

      {/* Phase N5. Silent until a save has been running for six seconds, at which point the
          difference between "slow" and "crashed" is the difference between waiting and closing
          the app on an entry that has not landed. */}
      <SlowSaveNotice />

      <div className="flex flex-wrap items-center gap-4">
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

      <p className="text-xs text-muted-foreground">
        One reading per day — recording the same day again replaces it. This is what every
        weight-adjusted split on this page is computed from.
      </p>
    </form>
  );
}
