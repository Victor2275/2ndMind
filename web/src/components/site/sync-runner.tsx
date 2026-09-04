"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { backoffMs, flush, httpPoster } from "@/lib/sync/engine";
import { summariseOutbox, type OutboxSummary } from "@/lib/sync/outbox-view";
import { allOps, openSyncDb, pendingBatch, type SyncDb } from "@/lib/sync/store";

/**
 * Decides *when* to sync (V3 §1.3, `docs/SYNC_DESIGN.md` §6). What happens on each outcome is
 * `lib/sync/engine.ts`; this file is only triggers, backoff and mutual exclusion.
 *
 * Three triggers, and each covers a case the others miss:
 *
 * - **Reconnect** (`online`). The obvious one, and the least reliable: `navigator.onLine` says
 *   the OS has an interface, not that anything is reachable. Hotel wifi with a captive portal
 *   reports online.
 * - **Foreground** (`visibilitychange`). What actually catches the common case — an installed
 *   PWA sits in the background for hours and the `online` event fires while nobody is looking,
 *   or never fires at all because the radio never went down.
 * - **Mount**, so opening the app syncs.
 *
 * Anything else that wants a flush dispatches `SYNC_EVENT` on `window` rather than importing
 * this component. §1.7's retry screen and Phase 3's pull-to-refresh both need that, and
 * neither should have to be wired through the private layout to get it.
 *
 * Nothing sensitive may appear in this file — it compiles into `/_next/static/chunks/`, which
 * is served without authentication.
 */

/** Ask for a flush from anywhere: `window.dispatchEvent(new Event(SYNC_EVENT))`. */
export const SYNC_EVENT = "2ndmind:sync";

export function requestSync() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SYNC_EVENT));
}

/** How many times to go round when the server says there is more waiting. */
const MAX_PAGES = 20;

export function SyncRunner() {
  const [outbox, setOutbox] = useState<OutboxSummary | null>(null);

  // Refs, not state: none of this should cause a render, and a re-render mid-flush would
  // restart the effect and run a second one.
  const dbRef = useRef<SyncDb | null>(null);
  const runningRef = useRef(false);
  const nextAttemptRef = useRef(0);
  const pausedForAuthRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function run(manual: boolean) {
      if (cancelled || runningRef.current) return;
      // A manual trigger ignores both the backoff and the auth pause: the user is asking, and
      // the most likely reason they are asking is that they just fixed the thing.
      if (!manual && Date.now() < nextAttemptRef.current) return;
      if (!manual && pausedForAuthRef.current) return;

      runningRef.current = true;
      try {
        dbRef.current ??= await openSyncDb();
        const db = dbRef.current;

        for (let page = 0; page < MAX_PAGES; page++) {
          const outcome = await flush(db, httpPoster, { online: navigator.onLine });
          if (cancelled) return;

          if (outcome.status === "auth") {
            // Stop the automatic loop. Retrying against a dead session burns ops for a problem
            // a sign-in fixes instantly, and the next foreground or manual trigger will retry.
            pausedForAuthRef.current = true;
            break;
          }

          if (outcome.status === "transient") {
            // Backoff is driven by the ops' own attempt counts, so a batch that has been
            // failing for a while waits longer than one that just started.
            const batch = await pendingBatch(db, 1);
            nextAttemptRef.current = Date.now() + backoffMs(batch[0]?.attempts ?? 1);
            break;
          }

          pausedForAuthRef.current = false;
          nextAttemptRef.current = 0;
          if (outcome.status !== "synced" || !outcome.hasMore) break;
        }

        if (!cancelled) setOutbox(summariseOutbox(await allOps(db)));
      } catch {
        // IndexedDB can be unavailable outright — private browsing, a blocked upgrade. Sync
        // failing must never take the page down with it.
      } finally {
        runningRef.current = false;
      }
    }

    const onVisible = () => {
      if (document.visibilityState === "visible") void run(false);
    };
    const onOnline = () => void run(false);
    const onManual = () => void run(true);

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    window.addEventListener(SYNC_EVENT, onManual);

    void run(false);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      window.removeEventListener(SYNC_EVENT, onManual);
    };
  }, []);

  // Nothing to say when the outbox is empty, which is almost always.
  if (!outbox || outbox.urgency === "none") return null;

  /**
   * The badge (§1.7). It escalates, and it never fades.
   *
   * A quiet count is a link to the screen rather than a retry button: tapping something that
   * silently either works or does not is worse than going somewhere that explains itself. The
   * two louder states are links for the same reason — the useful action for a rejected op is
   * reading why, and "try again" is on that page too.
   *
   * Colour carries the difference as well as the words, because this is read at a glance in a
   * gym. Failed is the only state that uses the destructive colour, and it is the only state
   * that will still be here tomorrow without a person.
   */
  const tone =
    outbox.urgency === "failed"
      ? "border-destructive/60 text-destructive"
      : outbox.urgency === "stale"
        ? "border-highlight/60 text-highlight"
        : "border-border text-muted-foreground hover:text-foreground";

  const dot =
    outbox.urgency === "failed"
      ? "bg-destructive"
      : outbox.urgency === "stale"
        ? "bg-highlight"
        : "bg-primary";

  return (
    <Link
      href="/private/sync"
      // Above the phone tab bar, below the update prompt, and never over the centre of the
      // screen: a log entry in progress must survive anything the app says about itself.
      className={`fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 flex min-h-10 items-center gap-2 rounded-full border bg-card/95 px-3 font-mono text-xs shadow-lg backdrop-blur-md transition-colors sm:bottom-6 print:hidden ${tone}`}
    >
      <span aria-hidden className={`size-1.5 rounded-full ${dot}`} />
      {outbox.label}
    </Link>
  );
}
