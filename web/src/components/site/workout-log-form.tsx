"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { logWorkoutAction } from "@/app/private/athletics/actions";
import { SlowSaveNotice } from "@/components/site/slow-save";
import type { ActionState } from "@/lib/athletics/forms";

/**
 * The manual session form — **built and no longer mounted** (D-159).
 *
 * The quick log grew the same repeated set rows, reads better under a thumb, and is reachable
 * from the laptop too, so training is logged in one place now. Two forms writing the same
 * thing meant two places to keep in step, and this is the one that was rarely opened.
 *
 * Kept rather than deleted, the same call as D-158. It is the only way to create a `workouts`
 * row by hand — a whole session with a title, a date and notes in one submit — and if entering
 * a backdated session one exercise at a time turns out to be worse, remounting it is restoring
 * one import and one `<WorkoutLogForm />` in `app/private/athletics/page.tsx`. Keeping it also
 * keeps `logWorkoutAction` referenced rather than an unreachable write endpoint.
 */

/** Local date as YYYY-MM-DD. `toISOString()` would shift to UTC and, in the evening in
 *  California, default the form to tomorrow. */
function todayLocal(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md border border-primary/50 px-4 py-2 text-sm text-primary transition-all duration-300 hover:-translate-y-0.5 hover:border-primary hover:bg-primary/10 hover:shadow-[0_0_20px_-6px_var(--primary)] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Saving…" : "Log session"}
    </button>
  );
}

/** No width in the base, so a call site that wants one is not fighting `w-full` — see D-219. */
const CONTROL =
  "rounded-md border border-border bg-card/70 px-2.5 py-1.5 font-mono text-xs text-foreground transition-colors focus:border-primary/60 focus:outline-none";
const FIELD = `${CONTROL} w-full`;

const LABEL = "eyebrow text-muted-foreground";

function SetRow({ index }: { index: number }) {
  return (
    <div className="grid grid-cols-2 gap-2 rounded-lg border border-border/70 p-3 sm:grid-cols-12">
      <div className="col-span-2 sm:col-span-3">
        {index === 0 && <label className={LABEL}>Exercise</label>}
        <input name="exercise" className={`${FIELD} mt-1`} placeholder="Bench Press" />
      </div>
      <div className="sm:col-span-2">
        {index === 0 && <label className={LABEL}>Weight</label>}
        <input name="weight" inputMode="decimal" className={`${FIELD} mt-1`} placeholder="lbs" />
      </div>
      <div className="sm:col-span-1">
        {index === 0 && <label className={LABEL}>Reps</label>}
        <input name="reps" inputMode="numeric" className={`${FIELD} mt-1`} placeholder="5" />
      </div>
      <div className="sm:col-span-2">
        {index === 0 && <label className={LABEL}>Distance</label>}
        <div className="mt-1 flex gap-1">
          <input name="distance" inputMode="decimal" className={FIELD} placeholder="500" />
          <select name="distanceUnit" className={`${CONTROL} w-16 shrink-0`} defaultValue="m">
            <option value="m">m</option>
            <option value="km">km</option>
            <option value="mi">mi</option>
          </select>
        </div>
      </div>
      <div className="sm:col-span-2">
        {index === 0 && <label className={LABEL}>Time</label>}
        <input name="duration" className={`${FIELD} mt-1`} placeholder="m:ss" />
      </div>
      <div className="sm:col-span-1">
        {/* Erg only. Without it here, the vault's stroke-rate targets have nothing to check
            a piece against — which is why the field earns its width. */}
        {index === 0 && <label className={LABEL}>SPM</label>}
        <input name="spm" inputMode="numeric" className={`${FIELD} mt-1`} placeholder="72" />
      </div>
      <div className="sm:col-span-1">
        {index === 0 && <label className={LABEL}>Type</label>}
        <select name="setType" className={`${FIELD} mt-1`} defaultValue="normal">
          <option value="normal">work</option>
          <option value="warmup">warm</option>
        </select>
      </div>
    </div>
  );
}

export function WorkoutLogForm() {
  const [state, action] = useActionState<ActionState | null, FormData>(logWorkoutAction, null);
  const [rows, setRows] = useState(3);

  return (
    <form action={action} className="mt-5 space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className={LABEL} htmlFor="performedOn">
            Date
          </label>
          <input
            id="performedOn"
            type="date"
            name="performedOn"
            required
            defaultValue={todayLocal()}
            className={`${FIELD} mt-1`}
          />
        </div>
        <div className="sm:col-span-2">
          <label className={LABEL} htmlFor="title">
            Session
          </label>
          <input id="title" name="title" className={`${FIELD} mt-1`} placeholder="Push Day" />
        </div>
      </div>

      <div className="space-y-2">
        {Array.from({ length: rows }, (_, i) => (
          <SetRow key={i} index={i} />
        ))}
      </div>

      <button
        type="button"
        onClick={() => setRows((n) => n + 1)}
        className="rounded-md border border-border px-3 py-1.5 font-mono text-xs text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
      >
        + another set
      </button>

      <div>
        <label className={LABEL} htmlFor="notes">
          Notes
        </label>
        <textarea id="notes" name="notes" rows={2} className={`${FIELD} mt-1 resize-y`} />
      </div>

      {/* Phase N5, and reachable only if this form is ever remounted — see D-159 above. It is
          here so that remounting restores a form that behaves like the rest of the app, rather
          than one that goes silent on a bad connection. Training is logged through the quick
          log today, and that path carries its own notice. */}
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
        Blank rows are ignored. Weight and reps for lifts; distance, time and SPM for erg pieces — a
        time may be typed as <span className="text-foreground">m:ss</span> or as seconds. A stroke
        rate is what lets a piece be checked against the vault&rsquo;s targets.
      </p>
    </form>
  );
}
