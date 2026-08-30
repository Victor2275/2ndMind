"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { logWorkoutAction } from "@/app/private/athletics/actions";
import type { ActionState } from "@/lib/athletics/forms";

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

const FIELD =
  "w-full rounded-md border border-border bg-card/70 px-2.5 py-1.5 font-mono text-xs text-foreground transition-colors focus:border-primary/60 focus:outline-none";

const LABEL = "font-mono text-[0.58rem] uppercase tracking-[0.14em] text-muted-foreground";

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
          <select name="distanceUnit" className={`${FIELD} w-16`} defaultValue="m">
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
