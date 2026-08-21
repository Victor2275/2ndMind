"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  addTrackerItem,
  removeTrackerItem,
  toggleTrackerItem,
} from "@/app/private/academics/actions";
import type { ActionState } from "@/lib/sprint-goals";
import type { ChecklistItem } from "@/lib/vault/checklist";

function AddButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md border border-primary/50 px-3 py-1.5 font-mono text-xs text-primary transition-all duration-300 hover:border-primary hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Saving…" : "Add"}
    </button>
  );
}

/** One row. Two separate forms so ticking and deleting are independent submissions. */
function Row({ item }: { item: ChecklistItem }) {
  const [toggleState, toggle] = useActionState<ActionState | null, FormData>(
    toggleTrackerItem,
    null,
  );
  const [removeState, remove] = useActionState<ActionState | null, FormData>(
    removeTrackerItem,
    null,
  );
  const error = [toggleState, removeState].find((s) => s && !s.ok);

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
      <form action={toggle} className="flex min-w-0 flex-1 items-center gap-3">
        <input type="hidden" name="item" value={item.text} />
        <input type="hidden" name="done" value={String(!item.done)} />
        <button
          type="submit"
          aria-label={item.done ? `Reopen ${item.text}` : `Mark ${item.text} done`}
          className={`grid size-4 shrink-0 place-items-center rounded border transition-colors ${
            item.done
              ? "border-primary bg-primary/20 text-primary"
              : "border-border hover:border-primary/60"
          }`}
        >
          {item.done && (
            <svg viewBox="0 0 12 12" className="size-2.5 fill-none stroke-current stroke-2">
              <path d="M2 6.5 4.5 9 10 3" />
            </svg>
          )}
        </button>
        <span
          className={`min-w-0 flex-1 truncate text-sm ${
            item.done ? "text-muted-foreground line-through" : "text-foreground"
          }`}
        >
          {item.text}
        </span>
      </form>

      <form action={remove}>
        <input type="hidden" name="item" value={item.text} />
        <button
          type="submit"
          aria-label={`Remove ${item.text}`}
          className="font-mono text-[0.65rem] text-muted-foreground transition-colors hover:text-destructive"
        >
          remove
        </button>
      </form>

      {error && (
        <p role="alert" className="w-full font-mono text-[0.65rem] text-destructive">
          {error.message}
        </p>
      )}
    </li>
  );
}

export function AcademicTracker({ items }: { items: ChecklistItem[] }) {
  const [state, action] = useActionState<ActionState | null, FormData>(addTrackerItem, null);

  return (
    <div>
      {items.length > 0 ? (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card/70">
          {items.map((item) => (
            <Row key={item.text} item={item} />
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-border bg-card/70 px-4 py-3 text-sm text-muted-foreground">
          Nothing tracked. This is for midterms and multi-week projects that outlive one
          sprint — Canvas still owns the week-to-week deadlines.
        </p>
      )}

      <form action={action} className="mt-4 flex flex-wrap items-center gap-2">
        <input
          name="item"
          required
          placeholder="CS 131 midterm, week 5"
          className="min-w-0 flex-1 rounded-md border border-border bg-card/70 px-3 py-1.5 text-sm text-foreground transition-colors focus:border-primary/60 focus:outline-none"
        />
        <AddButton />
      </form>

      {state && (
        <p
          role="status"
          className={`mt-2 font-mono text-xs ${state.ok ? "text-primary" : "text-destructive"}`}
        >
          {state.message}{" "}
          {state.ok && state.url && (
            <a href={state.url} className="underline underline-offset-4">
              view commit
            </a>
          )}
        </p>
      )}
    </div>
  );
}
