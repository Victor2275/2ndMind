"use client";

import { useCallback, useEffect, useState } from "react";

import { requestSync } from "@/components/site/sync-runner";
import {
  approximateAge,
  describeOp,
  orderForReview,
  summariseOutbox,
  type OpView,
  type OutboxSummary,
} from "@/lib/sync/outbox-view";
import { allOps, getLastSyncAt, openSyncDb, requeue, type SyncDb } from "@/lib/sync/store";

/**
 * The screen for entries that have not arrived (V3 §1.7).
 *
 * Everything here reads IndexedDB, so it works with no signal — which is the only condition
 * under which it is *certain* to be needed. That is also why it is a client component with no
 * server data at all: a page about unsent things must not itself need the network.
 *
 * **Nothing is discarded.** There is no delete button, and that is a decision rather than an
 * omission (D-160). An entry in this list is the only copy of something he wrote; the app
 * offering to throw it away, at the exact moment it is being unhelpful, is how a log stops
 * being trusted. A stuck op is held forever and retried when asked.
 *
 * Nothing sensitive may be hard-coded here — this compiles into `/_next/static/chunks/`, which
 * is served without authentication. The entry text it renders arrives from IndexedDB at
 * runtime, which is per-device and never in the bundle.
 */

const PANEL = "rounded-lg border border-border bg-card/60 p-4";

type Loaded = {
  views: OpView[];
  summary: OutboxSummary;
  /**
   * How long ago the last successful flush was, measured when the outbox was read.
   *
   * Held as an age rather than a timestamp so nothing calls `Date.now()` during render — an
   * impure read that makes two renders of the same state disagree. It goes stale between the
   * ten-second refreshes, by up to ten seconds, on a line that is deliberately coarse.
   */
  lastSyncAgeMs: number | null;
};

export function OutboxConsole() {
  const [state, setState] = useState<Loaded | "loading" | "unavailable">("loading");
  const [busy, setBusy] = useState<string | null>(null);

  const read = useCallback(async (db: SyncDb) => {
    const now = Date.now();
    const ops = await allOps(db);
    const lastSyncAt = await getLastSyncAt(db);
    setState({
      views: orderForReview(ops.map((op) => describeOp(op, now))),
      summary: summariseOutbox(ops, now),
      lastSyncAgeMs: lastSyncAt === null ? null : Math.max(0, now - lastSyncAt),
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    let db: SyncDb | null = null;

    const refresh = async () => {
      try {
        db ??= await openSyncDb();
        if (!cancelled) await read(db);
      } catch {
        // Private browsing, or a blocked upgrade. Say so rather than rendering an empty list,
        // which would read as "everything is fine".
        if (!cancelled) setState("unavailable");
      }
    };

    void refresh();

    // A flush started elsewhere changes this list, and there is no event for "the outbox
    // changed". Polling is the honest option and the interval is generous: this screen is
    // open for seconds at a time, and the cost of being ten seconds stale is nothing.
    const timer = window.setInterval(() => void refresh(), 10_000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [read]);

  const retry = useCallback(
    async (opId: string) => {
      setBusy(opId);
      try {
        const db = await openSyncDb();
        await requeue(db, opId);
        requestSync();
        // Long enough for a fast round trip to have finished, so the row usually disappears
        // rather than sitting there looking like the button did nothing.
        await new Promise((resolve) => setTimeout(resolve, 1_200));
        await read(db);
      } catch {
        // The list is still correct; the retry simply did not happen.
      } finally {
        setBusy(null);
      }
    },
    [read],
  );

  if (state === "loading") {
    return <p className="mt-6 text-sm text-muted-foreground">Reading the outbox…</p>;
  }

  if (state === "unavailable") {
    return (
      <div className={`mt-6 ${PANEL}`}>
        <p className="text-sm font-medium text-foreground">
          This browser will not open the local database.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Private browsing does this. Entries written here are held in memory only and are lost when
          the tab closes, so log from the installed app rather than a private window.
        </p>
      </div>
    );
  }

  const { views, summary, lastSyncAgeMs } = state;

  return (
    <div className="mt-6 space-y-4">
      <div className={PANEL}>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p className="text-sm text-foreground">
            {views.length === 0
              ? "Everything you have written is on the server."
              : summary.failed > 0
                ? `${summary.failed} ${summary.failed === 1 ? "entry needs" : "entries need"} you. ${summary.pending} still waiting.`
                : `${summary.pending} waiting to send.`}
          </p>
          <p className="font-mono text-[0.65rem] text-muted-foreground">
            {lastSyncAgeMs === null
              ? "never synced on this device"
              : `last synced ${approximateAge(lastSyncAgeMs)} ago`}
          </p>
        </div>

        {views.length > 0 && (
          <button
            type="button"
            onClick={() => requestSync()}
            className="mt-3 min-h-10 rounded-md border border-primary/50 px-3 text-sm text-primary transition-colors hover:border-primary hover:bg-primary/10"
          >
            Try again now
          </button>
        )}
      </div>

      {summary.urgency === "stale" && (
        <p className="rounded-lg border border-highlight/40 bg-highlight/10 px-4 py-3 text-sm text-foreground">
          Something has been waiting {approximateAge(summary.oldestMs ?? 0)}. Nothing is lost — it
          is on this phone and it will keep trying — but a whole day usually means the app has not
          had a real connection, rather than a slow one.
        </p>
      )}

      {views.map((view) => (
        <OpRow key={view.opId} view={view} busy={busy === view.opId} onRetry={retry} />
      ))}
    </div>
  );
}

function OpRow({
  view,
  busy,
  onRetry,
}: {
  view: OpView;
  busy: boolean;
  onRetry: (opId: string) => void;
}) {
  return (
    <div
      className={`${PANEL} ${view.needsYou ? "border-destructive/40 bg-destructive/5" : ""}`}
      data-state={view.state}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="eyebrow text-muted-foreground">
          {view.verb} · {view.kind}
        </span>
        <span className="font-mono text-[0.65rem] text-muted-foreground tabular-nums">
          {approximateAge(view.ageMs)} old
          {view.attempts > 0 && ` · ${view.attempts} ${view.attempts === 1 ? "try" : "tries"}`}
        </span>
      </div>

      {view.title && <p className="mt-1.5 text-sm text-foreground">{view.title}</p>}

      {view.problem ? (
        <>
          <p className="mt-2 text-sm text-muted-foreground">{view.problem}</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => onRetry(view.opId)}
            className="mt-3 min-h-10 rounded-md border border-primary/50 px-3 text-sm text-primary transition-colors hover:border-primary hover:bg-primary/10 disabled:opacity-60"
          >
            {busy ? "Sending…" : "Send it again"}
          </button>
        </>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          Waiting for a connection. It will go on its own.
        </p>
      )}
    </div>
  );
}
