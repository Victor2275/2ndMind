"use client";

import { Trash2Icon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { localSessions, withLocal, type LocalSession, type LocalSet } from "@/lib/athletics/local";
import { deleteSession, deleteSet, updateSet } from "@/lib/athletics/session";
import { requestSync } from "@/components/site/sync-runner";

/**
 * What you already logged, and fixing it (Q402, `SYNC_DESIGN.md` §4a).
 *
 * ## Why editing is per-set rather than per-session
 *
 * §4a: *"after creation, sets are independent"*. Only the initial create is atomic. Correcting a
 * mistyped weight in set three sends **one op keyed by that set's own client id** — it does not
 * re-upload the session. That is not an optimisation: a session re-sent as a create would carry
 * whatever this screen happened to hold for every other set, and would quietly overwrite an edit
 * made on the laptop in between.
 *
 * ## It reads the phone
 *
 * Same source as the logger above it, so a session saved a moment ago is here immediately rather
 * than after the next sync — which on a phone in a gym is most of the time it will be looked at.
 *
 * Nothing sensitive may appear in this file — it compiles into `/_next/static/chunks/`.
 */

const FIELD =
  "w-20 rounded-md border border-border bg-card/60 px-2 py-1 font-mono text-xs text-foreground transition-colors focus:border-primary/60 focus:outline-none";

/** How many to show. Enough to reach yesterday's session, not a history screen. */
const SHOWN = 8;

export function RecentSessions() {
  const [sessions, setSessions] = useState<LocalSession[] | null>(null);

  /**
   * A counter rather than a callback that sets state.
   *
   * Bumping it re-runs the effect below, which is what does the reading. The obvious shape — a
   * `reload()` the children call directly — puts a `setState` inside the effect body, which
   * `react-hooks/set-state-in-effect` objects to and which does cause a second render on every
   * mount for a value that is about to be replaced anyway.
   */
  const [generation, setGeneration] = useState(0);
  const reload = useCallback(() => setGeneration((n) => n + 1), []);

  useEffect(() => {
    let alive = true;

    void withLocal((db) => localSessions(db)).then((list) => {
      if (alive) setSessions(list ?? []);
    });

    // A save on the logger above dispatches a sync request; listening to the same signal keeps
    // this list honest without it having to know about the form.
    const onDone = () => setGeneration((n) => n + 1);
    window.addEventListener("2ndmind:sync-done", onDone);
    return () => {
      alive = false;
      window.removeEventListener("2ndmind:sync-done", onDone);
    };
  }, [generation]);

  if (sessions === null) return null;
  if (sessions.length === 0) {
    return <p className="text-sm text-muted-foreground">No sessions on this device yet.</p>;
  }

  return (
    <div className="space-y-3">
      {sessions.slice(0, SHOWN).map((session) => (
        <SessionCard key={session.clientId} session={session} onChanged={reload} />
      ))}
    </div>
  );
}

function SessionCard({ session, onChanged }: { session: LocalSession; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);

  async function remove() {
    // No confirmation dialog: the delete is a tombstone and the row survives, so this is
    // recoverable in a way a `DELETE` would not be. Same call D-129 made for log entries.
    setBusy(true);
    await deleteSession(session.clientId);
    requestSync();
    setBusy(false);
    onChanged();
  }

  const day = session.performedAt.toISOString().slice(0, 10);

  return (
    <section className="rounded-lg border border-border bg-card/40 p-3">
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm text-foreground">{session.title || "Session"}</h3>
          <p className="font-mono text-[0.65rem] text-muted-foreground">
            {day} · {session.sets.length} {session.sets.length === 1 ? "set" : "sets"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void remove()}
          disabled={busy}
          aria-label={`Delete session ${session.title || day}`}
          className="flex size-10 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-destructive disabled:opacity-60"
        >
          <Trash2Icon className="icon-sm" aria-hidden />
        </button>
      </div>

      <ul className="mt-2 space-y-1">
        {session.sets.map((set) => (
          <SetRow
            key={set.clientId}
            sessionClientId={session.clientId}
            set={set}
            onChanged={onChanged}
          />
        ))}
      </ul>
    </section>
  );
}

/**
 * One set, editable in place.
 *
 * Saved on blur rather than behind a Save button. The correction being made here is one number,
 * usually while standing up, and a button would double the interactions for the case the whole
 * feature exists for.
 */
function SetRow({
  sessionClientId,
  set,
  onChanged,
}: {
  sessionClientId: string;
  set: LocalSet;
  onChanged: () => void;
}) {
  const [weight, setWeight] = useState(set.weightLbs === null ? "" : String(set.weightLbs));
  const [reps, setReps] = useState(set.reps === null ? "" : String(set.reps));

  async function commit() {
    const nextWeight = weight.trim() === "" ? null : Number(weight);
    const nextReps = reps.trim() === "" ? null : Number(reps);
    if (nextWeight === set.weightLbs && nextReps === set.reps) return;

    await updateSet(sessionClientId, {
      ...set,
      weightLbs: Number.isFinite(nextWeight as number) ? nextWeight : null,
      reps: Number.isFinite(nextReps as number) ? nextReps : null,
    });
    requestSync();
    onChanged();
  }

  async function remove() {
    await deleteSet(sessionClientId, set);
    requestSync();
    onChanged();
  }

  return (
    <li className="flex items-center gap-2">
      <span className="w-5 shrink-0 text-center font-mono text-xs text-muted-foreground">
        {set.setIndex + 1}
      </span>
      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{set.exercise}</span>

      <input
        value={weight}
        onChange={(event) => setWeight(event.target.value)}
        onBlur={() => void commit()}
        inputMode="decimal"
        aria-label={`${set.exercise} set ${set.setIndex + 1} weight`}
        className={FIELD}
      />
      <input
        value={reps}
        onChange={(event) => setReps(event.target.value)}
        onBlur={() => void commit()}
        inputMode="numeric"
        aria-label={`${set.exercise} set ${set.setIndex + 1} reps`}
        className={FIELD}
      />

      <button
        type="button"
        onClick={() => void remove()}
        aria-label={`Delete set ${set.setIndex + 1}`}
        className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-destructive"
      >
        <Trash2Icon className="icon-sm" aria-hidden />
      </button>
    </li>
  );
}
