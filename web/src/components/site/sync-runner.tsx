"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { reportError } from "@/lib/errors/client";
import { alertIfStuck } from "@/lib/push/local-alert";
import { buzzFailed } from "@/lib/haptics";
import { BUDGET } from "@/lib/net/deadline";
import { reachabilityStore, startWatching } from "@/lib/net/reachability";
import { backoffMs, flush, httpPoster } from "@/lib/sync/engine";
import { summariseOutbox, type OutboxSummary } from "@/lib/sync/outbox-view";
import { allOps, openSyncDb, pendingBatch, pendingCount, type SyncDb } from "@/lib/sync/store";

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
 * **`offline` mounts it on the cached shell** (D-175). Until 2026-09-05 this ran only inside the
 * private layout, so an entry written with the radio off sat in the outbox until the live app
 * was opened — even once signal returned, and even though the person was looking at the app.
 * That is what Victor hit: his airplane-mode entries reached Neon only after he navigated back
 * to `/private`.
 *
 * It cannot simply be mounted there as-is. `flush` posts **even with an empty outbox**,
 * deliberately, because that empty POST is how changes made on the laptop reach the phone — and
 * `/cached` is a static route anyone can open. Mounting it unguarded would make every stranger
 * who loads that URL fire one authenticated call that 401s. So `offline` gates the whole run on
 * there being something queued: with an empty outbox it makes no request at all, and a device
 * with a queue is by definition a device that has signed in. Pull is given up in that mode,
 * which is the trade Victor chose — the shell keeps showing the snapshot it has, and says how
 * old it is.
 *
 * Nothing sensitive may appear in this file — it compiles into `/_next/static/chunks/`, which
 * is served without authentication.
 */

/** Ask for a flush from anywhere: `window.dispatchEvent(new Event(SYNC_EVENT))`. */
export const SYNC_EVENT = "2ndmind:sync";

/**
 * Fired when a run finishes, whatever the outcome.
 *
 * Pull-to-refresh needs it (§3.3): a gesture that asks for a sync has to stop spinning when the
 * sync stops, and the alternative — hiding the indicator after a fixed delay — is an animation
 * that lies about whether anything happened. Success and failure both fire it; *what* happened
 * is already told by the badge and, on a real failure, by the phone buzzing.
 */
export const SYNC_DONE_EVENT = "2ndmind:sync-done";

export function requestSync() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SYNC_EVENT));
}

/** How many times to go round when the server says there is more waiting. */
const MAX_PAGES = 20;

/**
 * When to conclude a run has wedged and release the mutex anyway (Phase N4).
 *
 * `runningRef` is what stops two flushes overlapping, and it is only cleared in `finally`. So
 * anything that never settles inside `run` disables syncing **for the life of the page** — and
 * the symptom is the worst kind: no error, no badge change, "Send now" simply does nothing, and
 * the outbox quietly grows until the app is reloaded. That is what a stalled POST used to do.
 *
 * The deadline on `httpPoster` fixes the network case at its source, so this is belt and braces
 * for the rest — IndexedDB blocking on an upgrade, or a bug in a future branch of `flush`.
 *
 * Derived rather than picked, so it cannot start firing during legitimate work when a budget is
 * tuned: the longest honest run is every page taking its full sync budget, plus room for the
 * database work between them. Releasing the mutex early is safe even if this is wrong — every op
 * carries an idempotency key and the outbox dedupes, so the cost of two overlapping flushes is
 * one wasted request, against a sync that is otherwise dead until reload.
 */
const MAX_RUN_MS = MAX_PAGES * BUDGET.sync + 30_000;

export function SyncRunner({ offline = false }: { offline?: boolean } = {}) {
  const [outbox, setOutbox] = useState<OutboxSummary | null>(null);

  /**
   * What the connection is actually doing (Phase N7).
   *
   * Read here rather than in a component of its own because this is already the one place in
   * the app that talks about the network, and two fixed pills competing for the same corner is
   * how a quiet signal becomes clutter. `useSyncExternalStore` rather than an effect: the store
   * has no server value, and the neutral server snapshot is what keeps this from being a
   * hydration mismatch on every private page.
   */
  const reachability = useSyncExternalStore(
    reachabilityStore.subscribe,
    reachabilityStore.getSnapshot,
    reachabilityStore.getServerSnapshot,
  );

  // Watching is started here and nowhere else. It is reference-counted, so mounting the runner
  // on both the live app and the cached shell is safe.
  useEffect(() => startWatching(), []);

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
      const watchdog = setTimeout(() => {
        runningRef.current = false;
      }, MAX_RUN_MS);
      try {
        dbRef.current ??= await openSyncDb();
        const db = dbRef.current;

        // On the shell, nothing queued means nothing to do — not even the empty POST that
        // pulls, because this page is reachable without a session. See the note above.
        if (offline && (await pendingCount(db)) === 0) {
          setOutbox(summariseOutbox(await allOps(db)));
          return;
        }

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

            // A pattern deliberately unlike the save tick (§3.3): the point is that a failure
            // cannot be mistaken for a success through a pocket. Only when something is
            // actually waiting to be sent — a failed empty pull is the network's business, not
            // something to buzz a pocket about.
            if (batch.length > 0) buzzFailed();
            nextAttemptRef.current = Date.now() + backoffMs(batch[0]?.attempts ?? 1);
            break;
          }

          pausedForAuthRef.current = false;
          nextAttemptRef.current = 0;
          if (outcome.status !== "synced" || !outcome.hasMore) break;
        }

        if (!cancelled) {
          const summary = summariseOutbox(await allOps(db));
          setOutbox(summary);
          // Raised by the app about itself, not pushed by the server — which could not know
          // (§4.1, D-185). Only for ops that have actually failed, and only when the count
          // rises, so one unchanged problem does not fire on every flush.
          void alertIfStuck(summary);
        }
      } catch (error) {
        // IndexedDB can be unavailable outright — private browsing, a blocked upgrade. Sync
        // failing must never take the page down with it.
        //
        // It must also not fail *silently*, which is what it did until D-165. This catch is the
        // exact shape of failure §2.4 exists for: the phone stops syncing, nothing on screen
        // changes, and the outbox quietly grows for a week.
        void reportError(error);
      } finally {
        clearTimeout(watchdog);
        runningRef.current = false;
        window.dispatchEvent(new Event(SYNC_DONE_EVENT));
      }
    }

    const onVisible = () => {
      if (document.visibilityState === "visible") void run(false);
    };
    /**
     * The radio came back (Phase N4).
     *
     * The backoff is cleared first, deliberately. Backoff exists to stop the app hammering a
     * network that is not working — and `online` is the one event that says *that has changed*,
     * which makes the remaining delay stale evidence about a connection that no longer exists.
     *
     * Without this the reconnect trigger is swallowed whenever the last attempt failed within
     * the backoff window, and the queue then waits for the next foreground or a manual tap. It
     * is a narrow race and it was reproducible: `npm run e2e` reached "back online" with one op
     * held, dispatched `online`, and watched nothing happen — while a manual "Send now" a
     * moment later emptied the outbox at once.
     *
     * Only `online` gets this. Foregrounding the app is not evidence about the network, so
     * `visibilitychange` still respects the delay.
     */
    const onOnline = () => {
      nextAttemptRef.current = 0;
      void run(false);
    };
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
  }, [offline]);

  const queued = outbox && outbox.urgency !== "none";

  /**
   * What the connection is doing, when it is worth saying (Phase N7).
   *
   * The app is genuinely fine on a stalled connection — screens render from IndexedDB and
   * entries queue — it just *looks* broken, because everything that would normally be instant
   * takes three seconds and then comes from disk. One quiet line is the difference between
   * "this is slow" and "this is broken", and it costs nothing when the connection is fine.
   *
   * The wording claims only what is true. It is tempting to say everything is saved on the
   * device, and on the cached shell that is exactly right — but a form under `/private` posts
   * to a Server Action, and until every write goes through the outbox there is no local copy to
   * promise. So it describes reading, which holds in both places, and says nothing about
   * writing. See D-206.
   */
  const connection =
    reachability.state === "unreachable"
      ? "No connection — showing this phone's copy"
      : reachability.state === "degraded"
        ? "Connection is poor — showing this phone's copy"
        : null;

  // Nothing to say when the outbox is empty and the connection is fine, which is almost always.
  if (!queued && !connection) return null;

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
   *
   * **A poor connection is never one of the loud states.** It is not a fault and there is
   * nothing to do about it, so it takes the quiet tone even when it is the only thing being
   * said — the noisy colours are reserved for something that needs a person.
   */
  const tone =
    outbox?.urgency === "failed"
      ? "border-destructive/60 text-destructive"
      : outbox?.urgency === "stale"
        ? "border-highlight/60 text-highlight"
        : "border-border text-muted-foreground hover:text-foreground";

  const dot =
    outbox?.urgency === "failed"
      ? "bg-destructive"
      : outbox?.urgency === "stale"
        ? "bg-highlight"
        : "bg-primary";

  // Above the phone tab bar, below the update prompt, and never over the centre of the
  // screen: a log entry in progress must survive anything the app says about itself.
  const className = `fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 flex min-h-10 max-w-[min(20rem,calc(100vw-2rem))] items-center gap-2 rounded-full border bg-card/95 px-3 text-left font-mono text-xs shadow-lg backdrop-blur-md transition-colors sm:bottom-6 print:hidden ${tone}`;
  const body = (
    <>
      <span aria-hidden className={`size-1.5 shrink-0 rounded-full ${dot}`} />
      {/* The queue is the more specific thing to say, so it leads. The connection line is
          context for it, and on its own when there is nothing waiting. */}
      <span className="min-w-0">
        {queued ? outbox.label : connection}
        {queued && connection && <span className="block text-muted-foreground">{connection}</span>}
      </span>
    </>
  );

  // A document navigation on the shell, for the reason set out in `private-tabbar.tsx`: a
  // client transition asks a server for the next page, and there is no server here. The worker
  // answers /private/sync with the shell's own "Not sent" view.
  return offline ? (
    <a href="/private/sync" className={className}>
      {body}
    </a>
  ) : (
    <Link href="/private/sync" className={className}>
      {body}
    </Link>
  );
}
