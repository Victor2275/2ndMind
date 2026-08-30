"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { createLogEntry } from "@/app/private/log/actions";
import { DictateButton } from "@/components/site/dictate-button";
import type { Category, Field } from "@/lib/log/categories";
import type { ActionState } from "@/lib/sprint-goals";

/**
 * The quick-log form, generated from a category definition.
 *
 * One component for all six categories, because the fields are data. Adding a field means
 * editing `lib/log/categories.ts` and nothing else — which is what makes D-039's promise
 * (Victor edits the fields) actually cheap.
 */

const INPUT =
  "w-full rounded-md border border-border bg-card/60 px-2.5 py-1.5 text-sm text-foreground transition-colors focus:border-primary/60 focus:outline-none";
const LABEL = "font-mono text-[0.55rem] uppercase tracking-[0.14em] text-muted-foreground";

/** Local date as YYYY-MM-DD. `toISOString` would shift to UTC and, in the evening in
 *  California, default the form to tomorrow. */
function todayLocal(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function FieldInput({ field }: { field: Field }) {
  if (field.type === "bool") {
    return (
      <label className="flex items-center gap-2 pt-5">
        <input
          type="checkbox"
          name={field.name}
          className="size-4 rounded border-border accent-[var(--primary)]"
        />
        <span className="text-sm text-foreground">{field.label}</span>
      </label>
    );
  }

  return (
    <div className={field.wide ? "col-span-2 sm:col-span-3" : ""}>
      <label className={LABEL} htmlFor={`f-${field.name}`}>
        {field.label}
      </label>

      {field.type === "select" ? (
        <select
          id={`f-${field.name}`}
          name={field.name}
          defaultValue=""
          className={`${INPUT} mt-1`}
        >
          <option value="">—</option>
          {field.options?.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : field.type === "distance" ? (
        <div className="mt-1 flex gap-1">
          <input
            id={`f-${field.name}`}
            name={field.name}
            inputMode="decimal"
            placeholder={field.placeholder}
            className={INPUT}
          />
          <select name={`${field.name}Unit`} defaultValue="m" className={`${INPUT} w-16 shrink-0`}>
            <option value="m">m</option>
            <option value="km">km</option>
            <option value="mi">mi</option>
          </select>
        </div>
      ) : (
        <input
          id={`f-${field.name}`}
          name={field.name}
          // `decimal` rather than `numeric` so a phone keyboard still offers a colon for
          // durations typed as 2:17.
          inputMode={field.type === "number" ? "decimal" : "text"}
          placeholder={field.placeholder}
          className={`${INPUT} mt-1`}
        />
      )}
    </div>
  );
}

function SaveButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md border border-primary/50 px-4 py-2 text-sm text-primary transition-colors hover:border-primary hover:bg-primary/10 disabled:opacity-60"
    >
      {pending ? "Saving…" : `Log ${label.toLowerCase()}`}
    </button>
  );
}

export function LogForm({ category }: { category: Category }) {
  const [state, action] = useActionState<ActionState | null, FormData>(createLogEntry, null);
  const [showDate, setShowDate] = useState(false);
  const noteId = `note-${category.key}`;

  return (
    <form
      action={action}
      // Remounts on category change, so switching tabs clears the previous category's values
      // instead of leaving them to be submitted by accident.
      key={category.key}
      className="space-y-4"
    >
      <input type="hidden" name="category" value={category.key} />

      {category.fields.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {category.fields.map((field) => (
            <FieldInput key={field.name} field={field} />
          ))}
        </div>
      )}

      <div>
        <div className="flex items-center justify-between gap-2">
          <label className={LABEL} htmlFor={noteId}>
            Note
          </label>
          <DictateButton targetId={noteId} />
        </div>
        <textarea
          id={noteId}
          name="note"
          rows={2}
          placeholder="Anything worth remembering"
          className={`${INPUT} mt-1 resize-y`}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SaveButton label={category.label} />

        {showDate ? (
          <input
            type="date"
            name="occurredOn"
            defaultValue={todayLocal()}
            aria-label="Date this happened"
            className="rounded-md border border-border bg-card/60 px-2 py-1.5 font-mono text-xs text-muted-foreground focus:border-primary/60 focus:outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => setShowDate(true)}
            className="font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            not today?
          </button>
        )}

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
