"use client";

import { startTransition, useActionState, useCallback, useEffect, useRef, useState } from "react";

import { fileLogEntry, removeLogEntry, tagLogEntry, undoLogEntry } from "@/app/private/log/actions";
import { SwipeRow } from "@/components/site/swipe-row";
import { notify } from "@/components/site/toasts";
import { Empty } from "@/components/site/states";
import { LogForm } from "@/components/site/log-form";
import { QuickCapture } from "@/components/site/quick-capture";
import { TagInput } from "@/components/site/tag-input";
import { categoryByKey, summarise, TAB_CATEGORIES } from "@/lib/log/categories";
import { readLastCategory, writeLastCategory } from "@/lib/log/drafts";
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
  tags: string[];
};

const TIME = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Los_Angeles",
});

function EntryRow({ entry, onUndo }: { entry: EntryView; onUndo: (id: number) => void }) {
  const [state, remove] = useActionState<ActionState | null, FormData>(removeLogEntry, null);

  /**
   * Guarded on the state object's identity, not on `state.ok` (§5.5, the same trap `TaskList`
   * documents). Two removals in a row produce two states that compare equal field by field,
   * and an effect that re-fires on an unrelated re-render puts a second undo toast on screen
   * pointing at an entry that is already gone.
   */
  const settled = useRef<ActionState | null>(null);
  useEffect(() => {
    if (!state || state === settled.current) return;
    settled.current = state;
    if (state.ok && state.undoId) onUndo(state.undoId);
  }, [state, onUndo]);

  // By key, not by tab: a retired category still has a definition so its entries keep their
  // label and their summary line in the timeline (D-159).
  const category = categoryByKey(entry.category);
  const line = summarise(entry.category, entry.data, entry.note);

  /**
   * Left deletes; right springs back (§3.3, D-180).
   *
   * A log entry has no "complete" to swipe toward, and left-is-destructive holds everywhere in
   * the app rather than only where there happen to be two directions — a rule that changes per
   * screen is not a rule anyone can rely on with a thumb. Right resists and returns, which says
   * "nothing here" more clearly than no response at all.
   */
  const removeEntry = () => {
    const data = new FormData();
    data.set("id", String(entry.id));
    remove(data);
  };

  return (
    <li>
      <SwipeRow
        className="group flex items-baseline gap-3 px-4 py-2.5 transition-colors hover:bg-accent/30"
        onSwipeLeft={removeEntry}
        leftLabel="Remove"
      >
        <span className="tabular shrink-0 font-mono text-[0.6rem] text-muted-foreground">
          {TIME.format(new Date(entry.occurredAt))}
        </span>
        <span className="shrink-0 rounded border border-border px-1.5 py-0.5 font-mono text-[0.55rem] text-muted-foreground">
          {category?.label ?? entry.category}
        </span>
        <span className="min-w-0 flex-1 text-sm text-foreground">
          {line}
          {entry.tags.length > 0 && (
            <span className="ml-2 inline-flex flex-wrap gap-1 align-middle">
              {entry.tags.map((t) => (
                <a
                  key={t}
                  href={`/private/log?tag=${encodeURIComponent(t)}`}
                  className="font-mono text-[0.6rem] text-muted-foreground hover:text-primary"
                >
                  #{t}
                </a>
              ))}
            </span>
          )}
        </span>

        <form action={remove} className="shrink-0">
          <input type="hidden" name="id" value={entry.id} />
          <button
            type="submit"
            aria-label="Remove entry"
            // Visible on hover for a mouse, always visible on touch where hover does not exist.
            //
            // `can-hover:` rather than `sm:` (§5.3, Q194). The width was a proxy for "has a
            // mouse" and a touch tablet breaks it: over 640px, no hover, so the button was
            // invisible with no way to reveal it — and unlike the task list, this row has no
            // swipe to fall back on, so the entry could not be removed at all.
            //
            // `size-11` is DESIGN.md §9's 44px. It was a bare 14px glyph with no padding.
            className="-mr-2 inline-flex size-11 press items-center justify-center rounded-control text-muted-foreground opacity-100 transition-colors duration-fast ease-standard hover:text-destructive can-hover:opacity-0 can-hover:group-focus-within:opacity-100 can-hover:group-hover:opacity-100"
          >
            <svg viewBox="0 0 14 14" className="size-3.5 fill-none stroke-current stroke-[1.6]">
              <path d="M3 3l8 8M11 3l-8 8" />
            </svg>
          </button>
        </form>
      </SwipeRow>
    </li>
  );
}

/**
 * One captured note, and the ways it can be organised (D-164, V4 Phase 3 §3.3).
 *
 * A row of one-tap category buttons rather than a dropdown: filing is meant to cost less than
 * writing the thing did, and a select on a phone is a modal wheel. Filing keeps the text and
 * moves the category, so a note becomes an ordinary entry in the timeline.
 *
 * **Tags are the second, additive way in.** §2.3's whole complaint was that filing was the
 * *only* way to organise a note, and it only reaches five fixed categories — "a recipe I want
 * to try" fits none of them. `TagInput` sits beside the category row rather than replacing it:
 * tapping a category still files (moving the row out of this pile), and typing a tag still
 * tags without filing (`tagLogEntry` — the entry stays right here, findable by tag instead).
 * They can be combined in the same visit, but neither requires the other.
 *
 * **It does not open the form to add fields.** The log has no edit path anywhere — a mistake is
 * deleted and re-logged — and inventing one here would be a second way to change a stored entry
 * with different rules from the first. If a note needs numbers on it, delete it and log it
 * properly; the pile exists so the thought survives until then, not to become an editor.
 */
function UnsortedRow({
  entry,
  tagSuggestions,
}: {
  entry: EntryView;
  tagSuggestions: readonly string[];
}) {
  const [state, file] = useActionState<ActionState | null, FormData>(fileLogEntry, null);
  const [tagState, tag] = useActionState<ActionState | null, FormData>(tagLogEntry, null);

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

      <form action={tag} className="mt-2 flex items-end gap-2">
        <input type="hidden" name="id" value={entry.id} />
        <div className="min-w-0 flex-1 rounded-md border border-border bg-background/40 px-2 py-1">
          <TagInput label="Tag without filing" suggestions={tagSuggestions} />
        </div>
        <button
          type="submit"
          className="min-h-8 shrink-0 rounded-md border border-border px-2.5 font-mono text-[0.6rem] text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
        >
          Tag
        </button>
      </form>
      {tagState && (
        <p className={`mt-1 text-xs ${tagState.ok ? "text-primary" : "text-destructive"}`}>
          {tagState.message}
        </p>
      )}
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
function Unsorted({
  entries,
  tagSuggestions,
}: {
  entries: EntryView[];
  tagSuggestions: readonly string[];
}) {
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
          <UnsortedRow key={entry.id} entry={entry} tagSuggestions={tagSuggestions} />
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
  tagSuggestions = [],
  initialCategory,
}: {
  entries: EntryView[];
  /** Notes captured but not yet filed (D-164). */
  unsorted?: EntryView[];
  loggedToday: string[];
  /** Recent values per category, for the one-tap chips (§1.6, D-155). */
  chips?: Record<string, ChipSets>;
  /** The distinct-tags vocabulary, for `TagInput`'s autocomplete (V4 Phase 3, §3.2). */
  tagSuggestions?: readonly string[];
  /** Which tab to open on, from `?category=` — already validated by the page (§3.5). */
  initialCategory?: string;
}) {
  // The icon's long-press shortcuts arrive at `/private/log?category=…` and the page resolves
  // that to a known tab before it gets here, so an unknown key can never reach this state
  // (§3.5, D-178). Initial state only — switching tabs afterwards is the user's business and
  // must not be fought by the URL.
  const [active, setActive] = useState(initialCategory ?? TAB_CATEGORIES[0].key);

  /**
   * Open on the category last used (§5.5, Q393).
   *
   * In an effect rather than in the initial state, and that is not a style choice:
   * `localStorage` cannot be read while the server renders, so seeding state from it is a
   * hydration mismatch. The first paint is the first tab, and the remembered one arrives a
   * frame later — which is invisible, because the tabs are client-switched and nothing is
   * fetched when one changes.
   *
   * `?category=` **wins**. It comes from the icon's long-press shortcut, which is an explicit
   * "open the log on training"; a remembered tab overruling that would make the shortcut
   * unreliable exactly when it is used deliberately.
   */
  useEffect(() => {
    if (initialCategory) return;
    const last = readLastCategory(
      typeof window === "undefined" ? undefined : window.localStorage,
      TAB_CATEGORIES,
    );
    if (last) setActive(last);
  }, [initialCategory]);

  /** One place a tab is chosen, so remembering it cannot fall out of step with switching. */
  const choose = (key: string) => {
    setActive(key);
    writeLastCategory(typeof window === "undefined" ? undefined : window.localStorage, key);
  };
  const [, undo] = useActionState<ActionState | null, FormData>(undoLogEntry, null);

  /**
   * A removed entry offers its undo in a toast (§5.5, extending D-264 to this list).
   *
   * The task list moved off the inline row in §5.2 and this one did not, so the same two
   * problems were still live here: the row rendered *below* a list that is as long as the day
   * has been, and it stayed until it was used, so yesterday's undo was still on screen waiting
   * to restore the wrong entry. The toast is bottom-anchored and expires.
   *
   * `undo` is the same Server Action the row dispatched. A second path to restore an entry is a
   * second thing that can be wrong about which entry it restores.
   */
  const offerUndo = useCallback(
    (id: number) => {
      notify.undoable("Entry removed.", () => {
        const data = new FormData();
        data.set("id", String(id));
        // Not from a `<form action>`, so React needs the transition told explicitly — without
        // it `isPending` never updates and nothing downstream can show the undo in flight.
        startTransition(() => undo(data));
      });
    },
    [undo],
  );

  const category = TAB_CATEGORIES.find((c) => c.key === active) ?? TAB_CATEGORIES[0];
  const missing = TAB_CATEGORIES.filter((c) => !loggedToday.includes(c.key));

  return (
    <div className="space-y-6">
      {/* Above the tabs and outside them, so the fastest path through this page is type-and-send
          with nothing to choose first. */}
      {/* The action this page exists for, and what the fold gate measures here (§3.2). */}
      <QuickCapture firstAction />

      {unsorted.length > 0 && <Unsorted entries={unsorted} tagSuggestions={tagSuggestions} />}

      <div>
        {/*
          Wraps rather than scrolls (D-164).

          It used to be one horizontally-scrolling line, which kept the row to a single row of
          pixels and hid whatever did not fit — on a 360px phone that was the last two
          categories, with nothing on screen to say they were there. A tab you cannot see is a
          tab that does not get used. Two short rows cost about 30px and hide nothing.
        */}
        {/* No negative margin: it made this row 8px wider than its parent, which is the one
            thing `scripts/diag-widths.mjs` counts as a fault — and one permanent offender is
            enough to make a gate that exits 1 on every run and therefore never gets read.
            Found while adding the Training routes to that gate (V4 Phase 2++ Stage 8). */}
        <div className="flex flex-wrap gap-1">
          {TAB_CATEGORIES.map((c) => {
            const done = loggedToday.includes(c.key);
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => choose(c.key)}
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
        <LogForm category={category} chips={chips[category.key]} tagSuggestions={tagSuggestions} />
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
                onClick={() => choose(c.key)}
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
              <EntryRow key={entry.id} entry={entry} onUndo={offerUndo} />
            ))}
          </ul>
        ) : (
          <Empty>Nothing logged yet today.</Empty>
        )}
      </div>
    </div>
  );
}
