/**
 * The one published answer to "what is the outbox doing" (V4 §4.5).
 *
 * `SyncRunner` has always computed this — it opens the database, flushes, and summarises what
 * is left — and until §4.5 it was the only thing that needed it, so the summary lived in that
 * component's `useState`. The persistent connection glyph Q375 asks for needs the same number
 * in the sidebar and in the phone title bar, and the three must never disagree.
 *
 * The alternative was each of them opening IndexedDB and summarising for itself, which is three
 * reads of the same table on every render pass and, worse, three answers that drift apart for
 * however long their timers are out of step. A published value has one writer — the runner,
 * which is the only component that knows when the picture has actually changed — and any number
 * of readers.
 *
 * Deliberately **not** a React context: the cached shell mounts the runner outside the private
 * layout, the glyph renders in two different subtrees at two different breakpoints, and a
 * provider spanning all of that would have to live at the root of the app, where it would be a
 * client boundary around every public page as well.
 *
 * Nothing here is sensitive — counts and states, no payloads. It compiles into client chunks.
 */

import type { OutboxSummary } from "@/lib/sync/outbox-view";

/** `null` means "nobody has looked yet", which is different from "the outbox is empty". */
let current: OutboxSummary | null = null;

const listeners = new Set<() => void>();

/**
 * Called by `SyncRunner` after every run.
 *
 * Identity matters: `useSyncExternalStore` bails out of a re-render when `getSnapshot` returns
 * the same reference, and `summariseOutbox` builds a fresh object each time. So the guard below
 * compares the fields that are actually rendered rather than the object — without it, every
 * flush on an idle phone re-renders the glyph in two places to paint the same pixels.
 */
export function publishOutbox(summary: OutboxSummary | null): void {
  if (same(current, summary)) return;
  current = summary;
  for (const listener of listeners) listener();
}

function same(a: OutboxSummary | null, b: OutboxSummary | null): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  return a.urgency === b.urgency && a.pending === b.pending && a.label === b.label;
}

export const outboxStore = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getSnapshot: (): OutboxSummary | null => current,
  /**
   * The server knows nothing about a device's outbox, and must not guess: rendering a count
   * server-side would mean the first painted frame claims a queue state it cannot have read.
   */
  getServerSnapshot: (): OutboxSummary | null => null,
};

/** Test seam. Clears both the value and the subscribers. */
export function resetOutboxStatus(): void {
  current = null;
  listeners.clear();
}
