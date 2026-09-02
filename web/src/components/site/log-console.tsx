"use client";

import { useActionState, useEffect, useState } from "react";

import { removeLogEntry, undoLogEntry } from "@/app/private/log/actions";
import { LogForm } from "@/components/site/log-form";
import { CATEGORIES, summarise } from "@/lib/log/categories";
import type { ChipSets } from "@/lib/log/chips";
import type { ActionState } from "@/lib/sprint-goals";

/**
 * Category tabs, the form for the selected one, and today's entries.
 *
 * Client-side tab switching on purpose: moving between categories must not cost a server
 * round trip. Victor logs training at the gym on a phone, and every navigation to a
 * `force-dynamic` route costs 335–440ms of Vercel function time before anything renders.
 */

export type EntryView = {
  id: number;
  category: string;
  occurredAt: string;
  note: string;
  data: Record<string, unknown>;
};

const TIME = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Los_Angeles",
});

function EntryRow({ entry, onUndo }: { entry: EntryView; onUndo: (id: number) => void }) {
  const [state, remove] = useActionState<ActionState | null, FormData>(removeLogEntry, null);

  useEffect(() => {
    if (state?.ok && state.undoId) onUndo(state.undoId);
  }, [state, onUndo]);

  const category = CATEGORIES.find((c) => c.key === entry.category);
  const line = summarise(entry.category, entry.data, entry.note);

  return (
    <li className="group flex items-baseline gap-3 px-4 py-2.5 transition-colors hover:bg-accent/30">
      <span className="tabular shrink-0 font-mono text-[0.6rem] text-muted-foreground">
        {TIME.format(new Date(entry.occurredAt))}
      </span>
      <span className="shrink-0 rounded border border-border px-1.5 py-0.5 font-mono text-[0.55rem] text-muted-foreground">
        {category?.label ?? entry.category}
      </span>
      <span className="min-w-0 flex-1 text-sm text-foreground">{line}</span>

      <form action={remove} className="shrink-0">
        <input type="hidden" name="id" value={entry.id} />
        <button
          type="submit"
          aria-label="Remove entry"
          className="text-muted-foreground opacity-100 transition-colors hover:text-destructive sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100"
        >
          <svg viewBox="0 0 14 14" className="size-3.5 fill-none stroke-current stroke-[1.6]">
            <path d="M3 3l8 8M11 3l-8 8" />
          </svg>
        </button>
      </form>
    </li>
  );
}

export function LogConsole({
  entries,
  loggedToday,
  chips = {},
}: {
  entries: EntryView[];
  loggedToday: string[];
  /** Recent values per category, for the one-tap chips (§1.6, D-155). */
  chips?: Record<string, ChipSets>;
}) {
  const [active, setActive] = useState(CATEGORIES[0].key);
  const [undoId, setUndoId] = useState<number | null>(null);
  const [, undo] = useActionState<ActionState | null, FormData>(undoLogEntry, null);

  const category = CATEGORIES.find((c) => c.key === active) ?? CATEGORIES[0];
  const missing = CATEGORIES.filter((c) => !loggedToday.includes(c.key));

  return (
    <div className="space-y-6">
      <div>
        {/* Scrolls rather than wraps, so the row stays one line on a phone. */}
        <div className="-mx-1 flex [scrollbar-width:none] gap-1 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden">
          {CATEGORIES.map((c) => {
            const done = loggedToday.includes(c.key);
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => setActive(c.key)}
                aria-pressed={c.key === active}
                className={`flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 font-mono text-xs transition-colors ${
                  c.key === active
                    ? "bg-primary/12 text-primary"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                }`}
              >
                {c.label}
                {done && (
                  <span aria-label="logged today" className="size-1.5 rounded-full bg-primary/70" />
                )}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{category.hint}</p>
      </div>

      <div className="rounded-xl border border-border bg-card/60 p-5">
        <LogForm category={category} chips={chips[category.key]} />
      </div>

      {/* The daily prompt: quiet, and only names what is actually missing. */}
      {missing.length > 0 && missing.length < CATEGORIES.length && (
        <p className="text-xs text-muted-foreground">
          Nothing logged today for{" "}
          {missing.map((c, i) => (
            <span key={c.key}>
              {i > 0 && ", "}
              <button
                type="button"
                onClick={() => setActive(c.key)}
                className="text-primary hover:underline"
              >
                {c.label.toLowerCase()}
              </button>
            </span>
          ))}
          .
        </p>
      )}

      <div>
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="text-base font-semibold tracking-tight">Today</h2>
          <span className="tabular font-mono text-[0.65rem] text-muted-foreground">
            {entries.length} {entries.length === 1 ? "entry" : "entries"}
          </span>
        </div>

        {entries.length > 0 ? (
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card/60">
            {entries.map((entry) => (
              <EntryRow key={entry.id} entry={entry} onUndo={setUndoId} />
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            Nothing logged yet today.
          </p>
        )}

        {undoId !== null && (
          <form
            action={undo}
            onSubmit={() => setUndoId(null)}
            className="mt-2 flex items-center gap-2"
          >
            <input type="hidden" name="id" value={undoId} />
            <span className="text-xs text-muted-foreground">Removed.</span>
            <button type="submit" className="font-mono text-xs text-primary hover:underline">
              Undo
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
