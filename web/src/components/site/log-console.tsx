"use client";

import { useActionState, useEffect, useState } from "react";

import { fileLogEntry, removeLogEntry, undoLogEntry } from "@/app/private/log/actions";
import { LogForm } from "@/components/site/log-form";
import { QuickCapture } from "@/components/site/quick-capture";
import { categoryByKey, summarise, TAB_CATEGORIES } from "@/lib/log/categories";
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

  // By key, not by tab: a retired category still has a definition so its entries keep their
  // label and their summary line in the timeline (D-159).
  const category = categoryByKey(entry.category);
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

/**
 * One captured note, and the categories it can be filed into (D-164).
 *
 * A row of one-tap targets rather than a dropdown: filing is meant to cost less than writing
 * the thing did, and a select on a phone is a modal wheel. Filing keeps the text and moves the
 * category, so a note becomes an ordinary entry in the timeline.
 *
 * **It does not open the form to add fields.** The log has no edit path anywhere — a mistake is
 * deleted and re-logged — and inventing one here would be a second way to change a stored entry
 * with different rules from the first. If a note needs numbers on it, delete it and log it
 * properly; the pile exists so the thought survives until then, not to become an editor.
 */
function UnsortedRow({ entry }: { entry: EntryView }) {
  const [state, file] = useActionState<ActionState | null, FormData>(fileLogEntry, null);

  return (
    <li className="px-4 py-3">
      <p className="text-sm text-foreground">
        {entry.note || summarise(entry.category, entry.data, entry.note)}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-1">
        {TAB_CATEGORIES.map((c) => (
          <form key={c.key} action={file}>
            <input type="hidden" name="id" value={entry.id} />
            <input type="hidden" name="category" value={c.key} />
            <button
              type="submit"
              className="min-h-8 rounded-md border border-border px-2.5 font-mono text-[0.6rem] text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
            >
              {c.label}
            </button>
          </form>
        ))}

        {state && !state.ok && <span className="text-xs text-destructive">{state.message}</span>}
      </div>
    </li>
  );
}

/**
 * The pile of things captured and not yet filed.
 *
 * Shown above the form and only when it is non-empty, with a count. A second inbox is a real
 * cost — it is another list that can silently fill up — so it earns its place by disappearing
 * completely the moment it is empty, and by never nagging when it is not.
 */
function Unsorted({ entries }: { entries: EntryView[] }) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold tracking-tight">Unsorted</h2>
        <span className="tabular font-mono text-[0.65rem] text-muted-foreground">
          {entries.length}
        </span>
      </div>
      <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card/60">
        {entries.map((entry) => (
          <UnsortedRow key={entry.id} entry={entry} />
        ))}
      </ul>
    </div>
  );
}

export function LogConsole({
  entries,
  unsorted = [],
  loggedToday,
  chips = {},
  initialCategory,
}: {
  entries: EntryView[];
  /** Notes captured but not yet filed (D-164). */
  unsorted?: EntryView[];
  loggedToday: string[];
  /** Recent values per category, for the one-tap chips (§1.6, D-155). */
  chips?: Record<string, ChipSets>;
  /** Which tab to open on, from `?category=` — already validated by the page (§3.5). */
  initialCategory?: string;
}) {
  // The icon's long-press shortcuts arrive at `/private/log?category=…` and the page resolves
  // that to a known tab before it gets here, so an unknown key can never reach this state
  // (§3.5, D-178). Initial state only — switching tabs afterwards is the user's business and
  // must not be fought by the URL.
  const [active, setActive] = useState(initialCategory ?? TAB_CATEGORIES[0].key);
  const [undoId, setUndoId] = useState<number | null>(null);
  const [, undo] = useActionState<ActionState | null, FormData>(undoLogEntry, null);

  const category = TAB_CATEGORIES.find((c) => c.key === active) ?? TAB_CATEGORIES[0];
  const missing = TAB_CATEGORIES.filter((c) => !loggedToday.includes(c.key));

  return (
    <div className="space-y-6">
      {/* Above the tabs and outside them, so the fastest path through this page is type-and-send
          with nothing to choose first. */}
      <QuickCapture />

      {unsorted.length > 0 && <Unsorted entries={unsorted} />}

      <div>
        {/*
          Wraps rather than scrolls (D-164).

          It used to be one horizontally-scrolling line, which kept the row to a single row of
          pixels and hid whatever did not fit — on a 360px phone that was the last two
          categories, with nothing on screen to say they were there. A tab you cannot see is a
          tab that does not get used. Two short rows cost about 30px and hide nothing.
        */}
        <div className="-mx-1 flex flex-wrap gap-1">
          {TAB_CATEGORIES.map((c) => {
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
      {missing.length > 0 && missing.length < TAB_CATEGORIES.length && (
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
