"use client";

import Link from "next/link";
import { PencilIcon, Trash2Icon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { requestSync } from "@/components/site/sync-runner";
import type { Modality } from "@/lib/athletics/catalogue";
import { FIELDS_FOR } from "@/lib/athletics/fields";
import { parseTimeToSeconds } from "@/lib/athletics/forms";
import {
  localCatalogue,
  localSessions,
  mergeCatalogue,
  withLocal,
  type LocalSession,
  type LocalSet,
} from "@/lib/athletics/local";
import { formatDuration } from "@/lib/athletics/prs";
import { deleteSession, deleteSet, updateSet } from "@/lib/athletics/session";

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

/** No width in it (D-219) — a call site states its own width exactly once. */
const CONTROL =
  "rounded-md border border-border bg-card/60 px-2 py-1 font-mono text-xs text-foreground transition-colors focus:border-primary/60 focus:outline-none";
const FIELD = `${CONTROL} w-20`;

/** How many to show. Enough to reach yesterday's session, not a history screen. */
const SHOWN = 8;

export function RecentSessions() {
  const [sessions, setSessions] = useState<LocalSession[] | null>(null);
  const [modalityFor, setModalityFor] = useState<Map<string, Modality>>(new Map());

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

    void withLocal(async (db) => {
      const [list, catalogue] = await Promise.all([localSessions(db), localCatalogue(db)]);
      return { list, catalogue };
    }).then((result) => {
      if (!alive || !result) return;
      setSessions(result.list);
      // Which columns a set should show — a lift's weight/reps, an erg piece's distance/time/spm
      // — is a property of the exercise, not the set. Read the same catalogue the logger reads
      // rather than guessing modality from which fields happen to be non-null.
      setModalityFor(
        new Map(mergeCatalogue(result.catalogue).map((entry) => [entry.name, entry.modality])),
      );
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
        <SessionCard
          key={session.clientId}
          session={session}
          modalityFor={modalityFor}
          onChanged={reload}
        />
      ))}
    </div>
  );
}

function SessionCard({
  session,
  modalityFor,
  onChanged,
}: {
  session: LocalSession;
  modalityFor: Map<string, Modality>;
  onChanged: () => void;
}) {
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
    // 7.1 text-floor allowlist (Q113). A session card: the title is `text-sm`, the date
    // and set count under it are the stamp on it.
    <section
      data-tiny-text="session card stamp: date and set count under the title"
      className="rounded-lg border border-border bg-card/40 p-3"
    >
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm text-foreground">{session.title || "Session"}</h3>
          <p className="font-mono text-[0.65rem] text-muted-foreground">
            {day} · {session.sets.length} {session.sets.length === 1 ? "set" : "sets"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Link
            href={`/private/athletics/sessions/${session.clientId}`}
            aria-label={`Edit session ${session.title || day}`}
            className="flex size-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
          >
            <PencilIcon className="icon-sm" aria-hidden />
          </Link>
          <button
            type="button"
            onClick={() => void remove()}
            disabled={busy}
            aria-label={`Delete session ${session.title || day}`}
            className="flex size-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-destructive disabled:opacity-60"
          >
            <Trash2Icon className="icon-sm" aria-hidden />
          </button>
        </div>
      </div>

      <ul className="mt-2 space-y-1">
        {session.sets.map((set) => (
          <SetRow
            key={set.clientId}
            sessionClientId={session.clientId}
            set={set}
            modality={modalityFor.get(set.exercise) ?? "lift"}
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
 *
 * Which fields show is read from the exercise's `modality` via the shared `FIELDS_FOR` table
 * (`lib/athletics/fields.ts`) — the same table the session logger uses — rather than always
 * showing weight/reps. An erg or water set showing only weight and reps boxes, both permanently
 * blank, was the concrete "my results aren't showing" bug: the fields that mattered (distance,
 * time, stroke rate) had no inputs here at all.
 */
function SetRow({
  sessionClientId,
  set,
  modality,
  onChanged,
}: {
  sessionClientId: string;
  set: LocalSet;
  modality: Modality;
  onChanged: () => void;
}) {
  const columns = FIELDS_FOR[modality];

  const [weight, setWeight] = useState(set.weightLbs === null ? "" : String(set.weightLbs));
  const [reps, setReps] = useState(set.reps === null ? "" : String(set.reps));
  const [distance, setDistance] = useState(set.distanceM === null ? "" : String(set.distanceM));
  const [duration, setDuration] = useState(
    set.durationS === null ? "" : formatDuration(set.durationS),
  );
  const [spm, setSpm] = useState(set.spm === null ? "" : String(set.spm));

  async function commit() {
    const nextWeight = weight.trim() === "" ? null : Number(weight);
    const nextReps = reps.trim() === "" ? null : Number(reps);
    const nextDistance = distance.trim() === "" ? null : Number(distance);
    const nextDuration = duration.trim() === "" ? null : parseTimeToSeconds(duration);
    const nextSpm = spm.trim() === "" ? null : Number(spm);

    // Didn't parse — leave the duration as it was rather than silently zeroing it out.
    if (duration.trim() !== "" && nextDuration === null) {
      setDuration(set.durationS === null ? "" : formatDuration(set.durationS));
      return;
    }

    if (
      nextWeight === set.weightLbs &&
      nextReps === set.reps &&
      nextDistance === set.distanceM &&
      nextDuration === set.durationS &&
      nextSpm === set.spm
    ) {
      return;
    }

    await updateSet(sessionClientId, {
      ...set,
      weightLbs: Number.isFinite(nextWeight as number) ? nextWeight : null,
      reps: Number.isFinite(nextReps as number) ? nextReps : null,
      distanceM: Number.isFinite(nextDistance as number) ? nextDistance : null,
      durationS: nextDuration,
      spm: Number.isFinite(nextSpm as number) ? nextSpm : null,
    });
    if (nextDuration !== null) setDuration(formatDuration(nextDuration));
    requestSync();
    onChanged();
  }

  async function remove() {
    await deleteSet(sessionClientId, set);
    requestSync();
    onChanged();
  }

  return (
    <li className="flex flex-wrap items-center gap-2">
      <span className="w-5 shrink-0 text-center font-mono text-xs text-muted-foreground">
        {set.setIndex + 1}
      </span>
      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{set.exercise}</span>

      {columns.map((column) => {
        if (column === "weightLbs") {
          return (
            <input
              key={column}
              value={weight}
              onChange={(event) => setWeight(event.target.value)}
              onBlur={() => void commit()}
              inputMode="decimal"
              aria-label={`${set.exercise} set ${set.setIndex + 1} weight`}
              className={FIELD}
            />
          );
        }
        if (column === "reps") {
          return (
            <input
              key={column}
              value={reps}
              onChange={(event) => setReps(event.target.value)}
              onBlur={() => void commit()}
              inputMode="numeric"
              aria-label={`${set.exercise} set ${set.setIndex + 1} reps`}
              className={FIELD}
            />
          );
        }
        if (column === "distanceM") {
          return (
            <input
              key={column}
              value={distance}
              onChange={(event) => setDistance(event.target.value)}
              onBlur={() => void commit()}
              inputMode="decimal"
              aria-label={`${set.exercise} set ${set.setIndex + 1} distance`}
              placeholder="m"
              className={FIELD}
            />
          );
        }
        if (column === "durationS") {
          return (
            <input
              key={column}
              value={duration}
              onChange={(event) => setDuration(event.target.value)}
              onBlur={() => void commit()}
              inputMode="text"
              aria-label={`${set.exercise} set ${set.setIndex + 1} time`}
              placeholder="m:ss"
              className={`${CONTROL} w-16`}
            />
          );
        }
        // spm
        return (
          <input
            key={column}
            value={spm}
            onChange={(event) => setSpm(event.target.value)}
            onBlur={() => void commit()}
            inputMode="numeric"
            aria-label={`${set.exercise} set ${set.setIndex + 1} stroke rate`}
            placeholder="spm"
            className={FIELD}
          />
        );
      })}

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
