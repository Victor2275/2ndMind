"use client";

import { startTransition, useActionState, useCallback, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";

import { BriefcaseIcon, DumbbellIcon, GraduationCapIcon } from "lucide-react";

import { addTask, removeTask, toggleTask, undoTask } from "@/app/private/actions";
import { useAnnounce } from "@/components/site/announcer";
import { SwipeRow } from "@/components/site/swipe-row";
import { Empty } from "@/components/site/states";
import { notify } from "@/components/site/toasts";
import { TagInput } from "@/components/site/tag-input";
import type { ActionState } from "@/lib/sprint-goals";

/**
 * The one task list (D-037). Sprint goals, coursework, and hand-typed to-dos are all rows
 * here, distinguished by their source rather than by living in separate systems.
 *
 * A Client Component, so nothing sensitive may be hard-coded in this file — it compiles into
 * `/_next/static/chunks/`, which is served without authentication.
 */

export type TaskView = {
  id: number;
  title: string;
  source: string;
  domain: string | null;
  courseCode: string | null;
  dueAt: string | null;
  done: boolean;
  tags: string[];
};

/** Days until due. Negative is overdue. Both sides floored to UTC midnight. */
function daysUntil(iso: string): number {
  const due = Date.parse(iso);
  if (Number.isNaN(due)) return 0;
  const d = new Date(due);
  const then = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const n = new Date();
  const now = Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate());
  return Math.round((then - now) / 86_400_000);
}

/**
 * The due label, and **overdue is loud without being red** (V4 §5.4, Q382).
 *
 * Victor's reasoning, verbatim: *red is for failure, late is not failure*. So overdue keeps
 * `highlight` — the amber the app already uses for "tomorrow" — and gets its emphasis from
 * weight and from the row's left edge instead of from hue. `destructive` stays what it has
 * always been in this app: something broke.
 *
 * `overdue` is returned rather than re-derived by the row, because two places computing
 * "is this late" is two places to get the boundary wrong.
 */
function dueLabel(iso: string): { text: string; tone: string; overdue: boolean } {
  const days = daysUntil(iso);
  if (days < 0)
    return {
      text: `${Math.abs(days)}d overdue`,
      tone: "text-highlight font-semibold",
      overdue: true,
    };
  if (days === 0) return { text: "today", tone: "text-primary", overdue: false };
  if (days === 1) return { text: "tomorrow", tone: "text-highlight", overdue: false };
  if (days <= 7) return { text: `${days}d`, tone: "text-muted-foreground", overdue: false };
  return { text: iso.slice(0, 10), tone: "text-muted-foreground", overdue: false };
}

const SOURCE_LABEL: Record<string, string> = {
  goal: "goal",
  canvas: "canvas",
  calendar: "calendar",
};

/**
 * Domains, as an icon **and** a word (V4 §5.4, Q381).
 *
 * The icons are the sidebar's, not a second set: Athletics and Academics are already those two
 * glyphs in the nav, and engineering tasks are the ones that belong to `/private/work`. A task
 * list that invented its own iconography would teach two vocabularies for one idea.
 *
 * The word is dropped below `phone` and the icon keeps an `aria-label`, so the row still says
 * which domain it is on a 360px screen where the title is what matters. That is the one place
 * this leans on the icon alone visually, and it is a label on a row, not a signal — rule 10 is
 * about status, and nothing here is status.
 */
const DOMAIN = {
  engineering: { Icon: BriefcaseIcon, label: "engineering" },
  athletics: { Icon: DumbbellIcon, label: "athletics" },
  academics: { Icon: GraduationCapIcon, label: "academics" },
} as const;

function DomainBadge({ domain }: { domain: string }) {
  const found = DOMAIN[domain as keyof typeof DOMAIN];
  if (!found) return null;
  const { Icon, label } = found;

  return (
    <span
      title={label}
      aria-label={label}
      className="flex shrink-0 items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[0.65rem] text-muted-foreground"
    >
      <Icon aria-hidden className="size-3" />
      <span className="phone-hidden">{label}</span>
    </span>
  );
}

function TaskRow({ task, onUndo }: { task: TaskView; onUndo: (id: number) => void }) {
  const [, toggle] = useActionState<ActionState | null, FormData>(toggleTask, null);
  const [removeState, remove] = useActionState<ActionState | null, FormData>(removeTask, null);
  useAnnounce(removeState);

  // In an effect, not during render: raising a toast during render is a setState on another
  // component's store, which React reports as an error and which would loop this subtree.
  //
  // The guard is `settled`, not `removeState?.ok`. Removing two tasks in a row can produce two
  // states that compare equal field by field, and an effect keyed on the object alone fires
  // again on any unrelated re-render — which would put a second undo toast on screen pointing
  // at a row that is already gone.
  const settled = useRef<ActionState | null>(null);
  useEffect(() => {
    if (!removeState || removeState === settled.current) return;
    settled.current = removeState;
    if (removeState.ok && removeState.undoId) onUndo(removeState.undoId);
  }, [removeState, onUndo]);

  const due = task.dueAt ? dueLabel(task.dueAt) : null;
  const badge = SOURCE_LABEL[task.source];

  /**
   * The swipe fires the same actions the two buttons do (§3.3, D-180).
   *
   * `useActionState`'s dispatch takes a `FormData` directly, so the gesture goes through
   * exactly the code path the buttons go through — including `onUndo`, which is why a swiped
   * delete gets the same undo toast a tapped one does. Building a second path for the gesture
   * would have been a second place for a delete to go wrong.
   */
  const submit = (action: (data: FormData) => void, fields: Record<string, string>) => () => {
    const data = new FormData();
    for (const [key, value] of Object.entries(fields)) data.set(key, value);
    action(data);
  };

  return (
    <li>
      <SwipeRow
        // The left edge is the other half of Q382's "loud, but not red". A 2px amber rule down
        // the row is visible in peripheral vision while scanning a list of fifteen, which a
        // word at the far right is not — and it costs the title nothing, because the padding
        // below compensates for it rather than the text moving.
        className={`group flex items-center gap-3 py-2.5 transition-colors hover:bg-accent/30 ${
          due?.overdue
            ? "border-l-2 border-highlight/70 bg-highlight/[0.04] pr-4 pl-[calc(1rem-2px)]"
            : "px-4"
        }`}
        onSwipeRight={submit(toggle, { id: String(task.id), done: String(!task.done) })}
        onSwipeLeft={submit(remove, { id: String(task.id) })}
        rightLabel={task.done ? "Reopen" : "Complete"}
        leftLabel="Remove"
      >
        <form action={toggle} className="flex min-w-0 flex-1 items-center gap-3">
          <input type="hidden" name="id" value={task.id} />
          <input type="hidden" name="done" value={String(!task.done)} />
          <button
            type="submit"
            aria-label={task.done ? `Reopen ${task.title}` : `Complete ${task.title}`}
            className={`grid size-[18px] shrink-0 place-items-center rounded-[5px] border transition-colors ${
              task.done
                ? "border-primary bg-primary/20 text-primary"
                : "border-border hover:border-primary/70"
            }`}
          >
            {task.done && (
              <svg viewBox="0 0 12 12" className="size-3 fill-none stroke-current stroke-[2.2]">
                <path d="M2 6.3 4.6 9 10 3.2" />
              </svg>
            )}
          </button>

          <span
            className={`min-w-0 flex-1 truncate text-sm ${
              task.done ? "text-muted-foreground line-through" : "text-foreground"
            }`}
          >
            {task.title}
          </span>
        </form>

        {/* The course code is the academics domain said more precisely, so the two never both
            appear: "PHYS 260" already tells you which domain this belongs to, and a row with
            three badges and a date before the title has run out of width at 360px. */}
        {task.courseCode ? (
          <span className="shrink-0 rounded border border-border px-1.5 py-0.5 font-mono text-[0.65rem] text-muted-foreground">
            {task.courseCode}
          </span>
        ) : (
          task.domain && <DomainBadge domain={task.domain} />
        )}
        {badge && (
          <span className="shrink-0 rounded border border-border px-1.5 py-0.5 font-mono text-[0.55rem] text-muted-foreground">
            {badge}
          </span>
        )}
        {due && (
          <span className={`tabular shrink-0 font-mono text-[0.65rem] ${due.tone}`}>
            {due.text}
          </span>
        )}

        {/*
          Free tags (V4 Phase 3, §3.4) — shown, not linked.

          The log page has a real `?tag=` browse (`listEntries`'s tag filter), because Today is
          explicitly fold-sensitive (D-083, D-132, D-182 all measured the first task's pixel
          position) and is not the screen to add a new filtered view to for one field. `#tag`
          here is a label a task carries, findable if you already know what you are looking
          for; a tappable filter for tasks specifically is future work, not this phase's.
        */}
        {task.tags.length > 0 && (
          <span className="hidden shrink-0 items-center gap-1 sm:flex">
            {task.tags.map((t) => (
              <span key={t} className="font-mono text-[0.6rem] text-muted-foreground">
                #{t}
              </span>
            ))}
          </span>
        )}

        <form action={remove} className="shrink-0">
          <input type="hidden" name="id" value={task.id} />
          <button
            type="submit"
            aria-label={`Remove ${task.title}`}
            // Visible on hover for a mouse, always visible on touch where hover does not exist.
            //
            // `can-hover:` rather than `sm:` (§5.3, Q194). The width was a proxy for "has a
            // mouse" and a touch tablet breaks it: over 640px, no hover, so the button was
            // invisible and had no way to be revealed. The variant is the capability itself.
            //
            // `size-11` is DESIGN.md §9's 44px. It was a bare 14px glyph with no padding —
            // the smallest tap target in the app, on a destructive action.
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

function AddButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="shrink-0 rounded-md border border-primary/50 px-3 py-1.5 font-mono text-xs text-primary transition-colors hover:border-primary hover:bg-primary/10 disabled:opacity-60"
    >
      {pending ? "…" : "Add"}
    </button>
  );
}

export function TaskList({
  tasks,
  emptyMessage,
  showAdd = true,
  firstAction = false,
  tagSuggestions = [],
}: {
  tasks: TaskView[];
  emptyMessage: string;
  showAdd?: boolean;
  /**
   * Marks this list as the thing `npm run shots` measures the fold to (§3.2).
   *
   * Off by default, and that default is the point. The attribute used to be unconditional, so
   * every list on a page carried it — four of them on Today — and "the first thing you can do"
   * quietly came to mean "any list at all". The gate then measured whichever happened to be
   * first in the document, which changed the moment anything was added above it (D-182).
   */
  firstAction?: boolean;
  /** The distinct-tags vocabulary, for `TagInput`'s autocomplete (V4 Phase 3, §3.2). */
  tagSuggestions?: readonly string[];
}) {
  const [addState, add] = useActionState<ActionState | null, FormData>(addTask, null);
  useAnnounce(addState);
  const [, undo] = useActionState<ActionState | null, FormData>(undoTask, null);

  /**
   * A removal offers its undo in a toast (§5.2, Q265, Q268).
   *
   * It was an inline row under the list — *"Removed. Undo"* — which had two problems on the
   * device this app is for. It appeared **below** the list, so on Today, where the list is
   * long, the confirmation for a row you just swiped rendered off screen. And it was permanent
   * until dismissed by using it, so the last removal's undo sat there indefinitely, which is
   * how the wrong thing gets restored.
   *
   * The toast is bottom-anchored, so it is in the same place whatever the list is doing, and
   * it expires — after eight seconds the removal is simply done, which is the honest state.
   *
   * `undo` is the same Server Action the row used. This is a different affordance for the same
   * operation, not a second delete path.
   */
  const offerUndo = useCallback(
    (id: number) => {
      notify.undoable("Task removed.", () => {
        const data = new FormData();
        data.set("id", String(id));
        // `startTransition`, because this dispatch does not come from a `<form action>`. React
        // warns otherwise — *"an async function with useActionState was called outside of a
        // transition"* — and the consequence is not cosmetic: outside a transition `isPending`
        // never updates, so nothing downstream could ever show the undo as in flight.
        startTransition(() => undo(data));
      });
    },
    [undo],
  );

  return (
    // `data-first-action` is read by scripts/shots.mjs to measure how far down the page the
    // first actionable item sits. It is the one thing /private has to answer quickly. The
    // attribute is on the list rather than on the panel around it so the number stays
    // comparable with D-083's 791px and D-132's 265px, which were measured here.
    //
    // Set by the caller, not by this component: only the list a page exists to show is the
    // answer. Backlog and Finished today are collapsed history and marking them made the gate
    // measure the bottom of the page (D-182).
    <div data-first-action={firstAction || undefined}>
      {tasks.length > 0 ? (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card/60">
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} onUndo={offerUndo} />
          ))}
        </ul>
      ) : (
        // The shared state (§5.1). This was a copy of the dashed box `Empty` used to be, so
        // Q275's rework reached every list in the app except the one on Today.
        <Empty>{emptyMessage}</Empty>
      )}

      {showAdd && (
        <form action={add} className="mt-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <input
              name="title"
              required
              placeholder="Add a task"
              className="min-w-0 flex-1 rounded-md border border-border bg-card/60 px-3 py-1.5 text-sm text-foreground transition-colors focus:border-primary/60 focus:outline-none"
            />
            <input
              type="date"
              name="dueAt"
              aria-label="Due date"
              className="shrink-0 rounded-md border border-border bg-card/60 px-2 py-1.5 font-mono text-xs text-muted-foreground focus:border-primary/60 focus:outline-none"
            />
            <AddButton />
          </div>
          <TagInput suggestions={tagSuggestions} />
        </form>
      )}

      {addState && !addState.ok && (
        <p role="alert" className="mt-2 font-mono text-xs text-destructive">
          {addState.message}
        </p>
      )}
    </div>
  );
}
