import { toggleRehabAction } from "@/app/private/athletics/actions";
import type { RehabItem } from "@/lib/athletics/protocol";

/**
 * Today's lower-back protocol.
 *
 * A Server Component with one small form per item: no `"use client"`, no JavaScript, and it
 * works before hydration. Each tick is a POST that re-renders the list, which at four items a
 * day is the right trade — an optimistic client version would add a hydration boundary and a
 * loading state to save perhaps 200 ms on a page that is already streaming.
 *
 * The protocol text is *not* in this file. It is parsed from
 * `context/02_physical_performance/benchmarks_and_logs.md`, so Victor changing the protocol in
 * the vault changes this list with no deploy — and the site can never quietly prescribe
 * something the vault no longer says.
 */

export type RehabState = {
  items: RehabItem[];
  /** Slugs already ticked today. */
  done: Set<string>;
  /** The local day this list is for, posted back so the tick lands on the day shown. */
  day: string;
  /** Ticks per day over the trailing window, oldest first, for the streak line. */
  history: { day: string; count: number }[];
};

function Item({ item, day, done }: { item: RehabItem; day: string; done: boolean }) {
  return (
    <li>
      <form action={toggleRehabAction}>
        <input type="hidden" name="day" value={day} />
        <input type="hidden" name="slug" value={item.slug} />
        <button
          type="submit"
          aria-pressed={done}
          className={`flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors hover:bg-accent/40 ${
            done ? "text-muted-foreground" : "text-foreground"
          }`}
        >
          <span
            aria-hidden
            className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border font-mono text-[0.6rem] leading-none transition-colors ${
              done ? "border-primary bg-primary/20 text-primary" : "border-border text-transparent"
            }`}
          >
            ✓
          </span>
          <span className="min-w-0 flex-1">
            <span className={`block text-sm ${done ? "line-through" : ""}`}>{item.name}</span>
            {item.prescription && (
              <span className="tabular block font-mono text-[0.6rem] text-muted-foreground">
                {item.prescription}
              </span>
            )}
          </span>
        </button>
      </form>
    </li>
  );
}

export function RehabChecklist({ items, done, day, history }: RehabState) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No rehab protocol found in the vault. It is read from the{" "}
        <span className="text-foreground">Lower Back Rehab Protocol</span> block of{" "}
        <code className="font-mono text-xs">benchmarks_and_logs.md</code> — if that heading was
        renamed, this list goes quiet rather than guessing.
      </p>
    );
  }

  const complete = items.every((item) => done.has(item.slug));

  return (
    <div>
      <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card/60">
        {items.map((item) => (
          <Item key={item.slug} item={item} day={day} done={done.has(item.slug)} />
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="font-mono text-[0.6rem] text-muted-foreground">
          {complete ? (
            <span className="text-primary">All four done today.</span>
          ) : (
            `${done.size} of ${items.length} done today.`
          )}
        </p>

        {/* Fourteen days at a glance. Filled where the whole protocol was completed, part-way
            where some of it was — a half-done day should not read the same as a rest day. */}
        <span className="flex items-center gap-1" aria-hidden>
          {history.map((entry) => {
            const ratio = items.length === 0 ? 0 : entry.count / items.length;
            return (
              <span
                key={entry.day}
                title={`${entry.day}: ${entry.count}/${items.length}`}
                className={`h-2.5 w-2.5 rounded-sm ${
                  ratio >= 1 ? "bg-primary" : ratio > 0 ? "bg-primary/40" : "border border-border"
                }`}
              />
            );
          })}
        </span>
      </div>
    </div>
  );
}
