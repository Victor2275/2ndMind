"use client";

import { RefreshCwIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { SYNC_DONE_EVENT, requestSync } from "@/components/site/sync-runner";
import { openSyncDb, pendingCount, getLastSyncAt } from "@/lib/sync/store";

/**
 * Send now, and how much is waiting (V4 §4.4, and Q375's actual request).
 *
 * Manual sync used to live in the phone's More sheet, which Victor disliked: it is a control
 * that affects the app and is reached rarely, which is the definition he gave for what belongs
 * in settings.
 *
 * It reads IndexedDB directly rather than taking props, for the same reason `/private/sync`
 * does: the count is local state and asking a server for it would make the one screen that
 * explains a failed connection depend on a connection.
 *
 * **It does not report success or failure itself.** `SyncRunner` owns the flush and its
 * outcomes; this asks for one and re-reads the count when it finishes. Two components reporting
 * on the same flush is how you get a screen that says "sent" next to a queue that still has
 * three things in it.
 *
 * Nothing sensitive may appear in this file; it compiles into `/_next/static/chunks/`.
 */

type Status = { pending: number; lastSyncAt: number | null } | "loading" | "unavailable";

function ago(ms: number): string {
  const seconds = Math.round((Date.now() - ms) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

export function SettingsSync() {
  const [status, setStatus] = useState<Status>("loading");
  const [busy, setBusy] = useState(false);

  const read = useCallback(async () => {
    try {
      const db = await openSyncDb();
      const [pending, lastSyncAt] = await Promise.all([pendingCount(db), getLastSyncAt(db)]);
      setStatus({ pending, lastSyncAt });
    } catch {
      // A private window, or a browser with IndexedDB switched off. Saying so is better than
      // rendering a zero that looks like an empty queue.
      setStatus("unavailable");
    }
  }, []);

  useEffect(() => {
    void read();
    // Re-read when a flush finishes, wherever it was started from — this component, the runner's
    // own reconnect handler, or a pull-to-refresh on another screen.
    const onDone = () => {
      setBusy(false);
      void read();
    };
    window.addEventListener(SYNC_DONE_EVENT, onDone);
    return () => window.removeEventListener(SYNC_DONE_EVENT, onDone);
  }, [read]);

  if (status === "unavailable") {
    return (
      <p className="text-xs text-muted-foreground">
        This browser will not let the app store anything locally, so nothing is queued here.
      </p>
    );
  }

  const pending = status === "loading" ? null : status.pending;
  const lastSyncAt = status === "loading" ? null : status.lastSyncAt;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0 text-xs text-muted-foreground">
        {pending === null ? (
          <span className="text-faint-foreground">Checking…</span>
        ) : pending === 0 ? (
          <>
            Everything has been sent.
            {lastSyncAt && (
              <span className="tabular font-mono text-faint-foreground">
                {" "}
                Last {ago(lastSyncAt)}.
              </span>
            )}
          </>
        ) : (
          <>
            {/* Not alarming, deliberately (Q426): a queue is the normal state offline, and a
                red badge on the ordinary case trains you to ignore it on the real one. */}
            <Link href="/private/sync" className="link-wipe text-foreground hover:text-primary">
              <span className="tabular font-mono">{pending}</span>{" "}
              {pending === 1 ? "entry" : "entries"} waiting
            </Link>
            {lastSyncAt && (
              <span className="tabular font-mono text-faint-foreground">
                {" "}
                · last {ago(lastSyncAt)}
              </span>
            )}
          </>
        )}
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          requestSync();
          // A floor on the spinner. A flush with an empty outbox returns in single-digit
          // milliseconds, and a button that flickers reads as one that did nothing.
          window.setTimeout(() => setBusy(false), 600);
        }}
        className="flex min-h-10 items-center gap-2 rounded-md border border-border px-3 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-60"
      >
        <RefreshCwIcon className={`size-3.5 ${busy ? "animate-spin" : ""}`} aria-hidden />
        {busy ? "Sending…" : "Send now"}
      </button>
    </div>
  );
}
