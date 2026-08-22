"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

import { addTask, removeTask, toggleTask, undoTask } from "@/app/private/actions";
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

function dueLabel(iso: string): { text: string; tone: string } {
  const days = daysUntil(iso);
  if (days < 0) return { text: `${Math.abs(days)}d overdue`, tone: "text-destructive" };
  if (days === 0) return { text: "today", tone: "text-primary" };
  if (days === 1) return { text: "tomorrow", tone: "text-highlight" };
  if (days <= 7) return { text: `${days}d`, tone: "text-muted-foreground" };
  return { text: iso.slice(0, 10), tone: "text-muted-foreground" };
}

const SOURCE_LABEL: Record<string, string> = {
  goal: "goal",
  canvas: "canvas",
  calendar: "calendar",
};

function TaskRow({ task, onUndo }: { task: TaskView; onUndo: (id: number) => void }) {
  const [, toggle] = useActionState<ActionState | null, FormData>(toggleTask, null);
  const [removeState, remove] = useActionState<ActionState | null, FormData>(removeTask, null);

  // In an effect, not during render: calling a parent's setState while rendering is a
  // React error and would re-render this subtree on a loop.
  useEffect(() => {
    if (removeState?.ok && removeState.undoId) onUndo(removeState.undoId);
  }, [removeState, onUndo]);

  const due = task.dueAt ? dueLabel(task.dueAt) : null;
  const badge = SOURCE_LABEL[task.source];

  return (
    <li className="group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-accent/30">
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

      {task.courseCode && (
        <span className="shrink-0 rounded border border-border px-1.5 py-0.5 font-mono text-[0.55rem] text-muted-foreground">
          {task.courseCode}
        </span>
      )}
      {badge && (
        <span className="shrink-0 rounded border border-border px-1.5 py-0.5 font-mono text-[0.55rem] text-muted-foreground">
          {badge}
        </span>
      )}
      {due && (
        <span className={`tabular shrink-0 font-mono text-[0.65rem] ${due.tone}`}>{due.text}</span>
      )}

      <form action={remove} className="shrink-0">
        <input type="hidden" name="id" value={task.id} />
        <button
          type="submit"
          aria-label={`Remove ${task.title}`}
          // Visible on hover for a mouse, always visible on touch where hover does not exist.
          className="text-muted-foreground opacity-100 transition-colors hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
        >
          <svg viewBox="0 0 14 14" className="size-3.5 fill-none stroke-current stroke-[1.6]">
            <path d="M3 3l8 8M11 3l-8 8" />
          </svg>
        </button>
      </form>
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
}: {
  tasks: TaskView[];
  emptyMessage: string;
  showAdd?: boolean;
}) {
  const [addState, add] = useActionState<ActionState | null, FormData>(addTask, null);
  const [, undo] = useActionState<ActionState | null, FormData>(undoTask, null);
  const [undoId, setUndoId] = useState<number | null>(null);

  return (
    <div>
      {tasks.length > 0 ? (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card/60">
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} onUndo={setUndoId} />
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          {emptyMessage}
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

      {showAdd && (
        <form action={add} className="mt-3 flex flex-wrap items-center gap-2">
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
