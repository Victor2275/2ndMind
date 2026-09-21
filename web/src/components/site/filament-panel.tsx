"use client";

import { useActionState, useState } from "react";
import { PencilIcon, XIcon } from "lucide-react";
import { useFormStatus } from "react-dom";

import { deleteSpool, saveSpool } from "@/app/private/hobbies/actions";
import {
  describeSpool,
  fractionLeft,
  levelOf,
  needsReorder,
  swatch,
} from "@/lib/fabrication/spools";
import type { FilamentSpool } from "@/lib/db/schema";
import type { ActionState } from "@/lib/sprint-goals";
import { useAnnounce } from "@/components/site/announcer";

/**
 * Filament, sorted by what runs out first (V3 §5.1, D-189).
 *
 * **Reorder-first**, as specified: the list arrives emptiest-first from SQL and the count of
 * what needs buying is the first thing on the panel. This page answers *what am I about to run
 * out of*; "which spool is nicest" is a different page and nobody needs it.
 *
 * An empty spool stays in the list rather than being filtered out. "I have no black PLA" is the
 * most useful single thing this can say, and hiding a zero would remove exactly that.
 *
 * Nothing sensitive may appear in this file; it compiles into `/_next/static/chunks/`.
 */

/** The bar's fill. Amber and red repeat what the badge already says in words. */
const LEVEL_FILL = {
  empty: "bg-destructive",
  low: "bg-highlight",
  some: "bg-primary/70",
  full: "bg-primary",
} as const;

const LEVEL_TONE = {
  empty: "border-destructive/60 text-destructive",
  low: "border-highlight/60 text-highlight",
  some: "border-border text-muted-foreground",
  full: "border-border text-muted-foreground",
} as const;

export function FilamentPanel({ spools }: { spools: FilamentSpool[] }) {
  const [adding, setAdding] = useState(false);
  const reorder = spools.filter(needsReorder).length;

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="text-sm text-foreground">
          {spools.length === 0
            ? "No spools yet."
            : reorder === 0
              ? `${spools.length} spools, none low.`
              : `${reorder} of ${spools.length} need reordering.`}
        </p>
        <button
          type="button"
          onClick={() => setAdding((open) => !open)}
          className="min-h-11 press rounded-control border border-primary/50 px-3 font-mono text-xs text-primary transition-colors duration-fast ease-standard hover:bg-primary/10"
        >
          {adding ? "Cancel" : "+ spool"}
        </button>
      </div>

      {adding && <SpoolForm onDone={() => setAdding(false)} />}

      {spools.length > 0 && (
        <ul className="mt-4 divide-y divide-border overflow-hidden rounded-lg border border-border bg-card/60">
          {spools.map((spool) => (
            <SpoolRow key={spool.id} spool={spool} />
          ))}
        </ul>
      )}
    </div>
  );
}

function SpoolRow({ spool }: { spool: FilamentSpool }) {
  const [editing, setEditing] = useState(false);
  const [, remove] = useActionState<ActionState | null, FormData>(deleteSpool, null);

  const level = levelOf(spool);
  const colour = swatch(spool.colourHex);
  const percent = Math.round(fractionLeft(spool) * 100);

  return (
    <li className="px-4 py-3">
      <div className="flex items-center gap-3">
        {/* The swatch, only ever from a validated hex. Where there is none the colour name
            still carries the row, so a spool entered in a hurry is not a blank square. */}
        {colour ? (
          <span
            aria-hidden
            className="size-5 shrink-0 rounded-full border border-border"
            style={{ backgroundColor: colour }}
          />
        ) : (
          <span
            aria-hidden
            className="grid size-5 shrink-0 place-items-center rounded-full border border-dashed border-border font-mono text-[0.5rem] text-muted-foreground"
          >
            ?
          </span>
        )}

        <span className="min-w-0 flex-1 truncate text-sm text-foreground">
          {describeSpool(spool)}
        </span>

        <span
          className={`tabular shrink-0 rounded border px-1.5 py-0.5 font-mono text-[0.65rem] ${LEVEL_TONE[level]}`}
        >
          {level === "empty" ? "empty" : `${spool.gramsRemaining}g · ${percent}%`}
        </span>

        <button
          type="button"
          onClick={() => setEditing((open) => !open)}
          aria-label={`Edit ${describeSpool(spool)}`}
          className="inline-flex size-11 shrink-0 press items-center justify-center rounded-control text-muted-foreground transition-colors duration-fast ease-standard hover:text-foreground"
        >
          <PencilIcon aria-hidden className="size-3.5" />
        </button>

        <form action={remove} className="shrink-0">
          <input type="hidden" name="id" value={spool.id} />
          <button
            type="submit"
            aria-label={`Remove ${describeSpool(spool)}`}
            className="-mr-2 inline-flex size-11 press items-center justify-center rounded-control text-muted-foreground transition-colors duration-fast ease-standard hover:text-destructive"
          >
            <XIcon aria-hidden className="size-3.5" />
          </button>
        </form>
      </div>

      {/* Q424 — the level, as a level.
          The badge beside the name says "412g · 41%", which is precise and unscannable: the
          question this page answers is *what am I about to run out of*, and eight rows of
          percentages have to be read one at a time. A bar is the same number arranged so the
          shortest one is visible without reading any of them. The badge stays, so nothing here
          depends on the bar being measured by eye (rule 10). */}
      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${describeSpool(spool)} remaining`}
        className="mt-2 ml-8 h-1 overflow-hidden rounded-full bg-border"
      >
        <div
          className={`h-full rounded-full ${LEVEL_FILL[level]}`}
          style={{ width: `${Math.max(percent, level === "empty" ? 0 : 2)}%` }}
        />
      </div>

      {spool.notes !== "" && (
        <p className="mt-1 pl-8 text-xs text-muted-foreground">{spool.notes}</p>
      )}

      {editing && <SpoolForm spool={spool} onDone={() => setEditing(false)} />}
    </li>
  );
}

function SpoolForm({ spool, onDone }: { spool?: FilamentSpool; onDone: () => void }) {
  const [state, action] = useActionState<ActionState | null, FormData>(saveSpool, null);
  useAnnounce(state);

  return (
    <form action={action} className="mt-3 rounded-lg border border-border bg-background/60 p-3">
      {spool && <input type="hidden" name="id" value={spool.id} />}

      <div className="grid gap-2 sm:grid-cols-3">
        <Field name="material" label="Material" defaultValue={spool?.material ?? "PLA"} required />
        <Field name="brand" label="Brand" defaultValue={spool?.brand ?? ""} />
        <Field name="colourName" label="Colour" defaultValue={spool?.colourName ?? ""} />
        {/* A colour input rather than free text: it cannot produce anything but a hex, which
            removes a whole class of bad value before it reaches the server. */}
        <Field
          name="colourHex"
          label="Swatch"
          type="color"
          defaultValue={swatch(spool?.colourHex ?? null) ?? "#888888"}
        />
        <Field
          name="gramsRemaining"
          label="Grams left"
          type="number"
          defaultValue={String(spool?.gramsRemaining ?? 0)}
        />
        <Field
          name="gramsFull"
          label="Full spool"
          type="number"
          defaultValue={String(spool?.gramsFull ?? 1000)}
        />
      </div>

      <Field name="notes" label="Notes" defaultValue={spool?.notes ?? ""} />

      <div className="mt-3 flex items-center gap-3">
        <SaveButton />
        <button
          type="button"
          onClick={onDone}
          className="font-mono text-xs text-muted-foreground hover:text-foreground"
        >
          close
        </button>
        {state && (
          <span className={`font-mono text-xs ${state.ok ? "text-primary" : "text-destructive"}`}>
            {state.message}
          </span>
        )}
      </div>
    </form>
  );
}

function Field({
  name,
  label,
  type = "text",
  defaultValue,
  required = false,
}: {
  name: string;
  label: string;
  type?: string;
  defaultValue: string;
  required?: boolean;
}) {
  return (
    <label className="mt-2 block">
      <span className="eyebrow text-muted-foreground">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        className="mt-1 min-h-10 w-full rounded-md border border-border bg-card/60 px-2.5 text-sm text-foreground transition-colors focus:border-primary/60 focus:outline-none"
      />
    </label>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-10 rounded-md border border-primary/50 px-3 text-sm text-primary transition-colors hover:bg-primary/10 disabled:opacity-60"
    >
      {pending ? "…" : "Save"}
    </button>
  );
}
