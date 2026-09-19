"use client";

import { Trash2Icon } from "lucide-react";
import { useEffect, useState } from "react";

import { requestSync } from "@/components/site/sync-runner";
import { Empty } from "@/components/site/states";
import type { Modality } from "@/lib/athletics/catalogue";
import { COLUMN_LABEL, FIELDS_FOR } from "@/lib/athletics/fields";
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
import { deleteSession, deleteSet, updateSession, updateSet } from "@/lib/athletics/session";

/**
 * A session's own page (Q402 follow-up).
 *
 * `RecentSessions` already does per-set, save-on-blur editing — this does not replace that, it
 * gives editing a real destination: its own URL, session-level fields (title, date, notes) that
 * `RecentSessions` never exposed even though `updateSession()` has existed since the aggregate op
 * landed, and one labeled field per column rather than a row of unlabeled boxes.
 *
 * Reads and writes IndexedDB, same as everything else about a session (D-216) — there is no
 * server-action path to fall back to, and none is needed: the outbox is the only path, online or
 * off, and this screen is exactly as good on a phone with no signal as it is at a desk.
 */
export function SessionEdit({ clientId }: { clientId: string }) {
  const [session, setSession] = useState<LocalSession | null | undefined>(undefined);
  const [modalityFor, setModalityFor] = useState<Map<string, Modality>>(new Map());
  const [generation, setGeneration] = useState(0);
  const reload = () => setGeneration((n) => n + 1);

  useEffect(() => {
    let alive = true;
    void withLocal(async (db) => {
      const [sessions, catalogue] = await Promise.all([localSessions(db), localCatalogue(db)]);
      return { sessions, catalogue };
    }).then((result) => {
      if (!alive) return;
      if (!result) {
        setSession(null);
        return;
      }
      setSession(result.sessions.find((s) => s.clientId === clientId) ?? null);
      setModalityFor(
        new Map(mergeCatalogue(result.catalogue).map((entry) => [entry.name, entry.modality])),
      );
    });
    return () => {
      alive = false;
    };
  }, [clientId, generation]);

  if (session === undefined) return null;

  if (session === null) {
    return (
      <Empty>
        Not found on this device. A session written elsewhere shows up here once it syncs — try
        again after a moment on a connection, or open it from{" "}
        <a
          href="/private/athletics/history"
          className="text-primary underline-offset-4 hover:underline"
        >
          History
        </a>
        .
      </Empty>
    );
  }

  return <SessionEditForm session={session} modalityFor={modalityFor} onChanged={reload} />;
}

const FIELD =
  "w-full rounded-md border border-border bg-card/60 px-2.5 py-1.5 text-sm text-foreground transition-colors focus:border-primary/60 focus:outline-none";
const LABEL = "eyebrow text-muted-foreground";

function toLocalDatetime(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function SessionEditForm({
  session,
  modalityFor,
  onChanged,
}: {
  session: LocalSession;
  modalityFor: Map<string, Modality>;
  onChanged: () => void;
}) {
  const [title, setTitle] = useState(session.title);
  const [performedAt, setPerformedAt] = useState(toLocalDatetime(session.performedAt));
  const [notes, setNotes] = useState(session.notes);
  const [state, setState] = useState<{ ok: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function saveSessionFields() {
    setSaving(true);
    const result = await updateSession({
      clientId: session.clientId,
      performedAt: new Date(performedAt),
      title,
      notes,
      exerciseNotes: session.exerciseNotes,
    });
    setSaving(false);
    setState(result);
    if (result.ok) {
      requestSync();
      onChanged();
    }
  }

  async function removeSession() {
    setDeleting(true);
    await deleteSession(session.clientId);
    requestSync();
    setDeleting(false);
  }

  // Grouped by exercise, in the order sets were logged — the same grouping the logger writes in,
  // so the page reads back the way it was entered rather than as one flat list.
  const byExercise = new Map<string, LocalSet[]>();
  for (const set of session.sets) {
    const list = byExercise.get(set.exercise) ?? [];
    list.push(set);
    byExercise.set(set.exercise, list);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-card/60 p-6">
        <h2 className="text-base font-semibold text-foreground">Session</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className={LABEL} htmlFor="edit-title">
              Title
            </label>
            <input
              id="edit-title"
              data-first-action=""
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className={`${FIELD} mt-1`}
            />
          </div>
          <div>
            <label className={LABEL} htmlFor="edit-when">
              When
            </label>
            <input
              id="edit-when"
              type="datetime-local"
              value={performedAt}
              onChange={(event) => setPerformedAt(event.target.value)}
              className={`${FIELD} mt-1 font-mono text-xs`}
            />
          </div>
        </div>
        <div className="mt-4">
          <label className={LABEL} htmlFor="edit-notes">
            Notes
          </label>
          <textarea
            id="edit-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            className={`${FIELD} mt-1 resize-y`}
          />
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void saveSessionFields()}
            disabled={saving}
            className="rounded-md border border-primary/50 px-4 py-2 text-sm text-primary transition-colors hover:border-primary hover:bg-primary/10 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => void removeSession()}
            disabled={deleting}
            className="rounded-md border border-border px-4 py-2 text-sm text-destructive transition-colors hover:border-destructive/50 hover:bg-destructive/10 disabled:opacity-60"
          >
            {deleting ? "Deleting…" : "Delete session"}
          </button>
          {state && (
            <p
              role="status"
              className={`text-xs ${state.ok ? "text-muted-foreground" : "text-destructive"}`}
            >
              {state.message}
            </p>
          )}
        </div>
      </section>

      {session.sets.length === 0 ? (
        <Empty>No sets on this session.</Empty>
      ) : (
        <section className="space-y-4">
          <h2 className="text-base font-semibold text-foreground">Sets</h2>
          {[...byExercise.entries()].map(([exercise, sets]) => (
            <div key={exercise} className="rounded-xl border border-border bg-card/60 p-6">
              <h3 className="text-sm font-semibold text-foreground">{exercise}</h3>
              <div className="mt-4 space-y-4">
                {sets.map((set) => (
                  <SetEditor
                    key={set.clientId}
                    sessionClientId={session.clientId}
                    set={set}
                    modality={modalityFor.get(exercise) ?? "lift"}
                    onChanged={onChanged}
                  />
                ))}
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

function SetEditor({
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
  const [notes, setNotes] = useState(set.notes);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function save() {
    const nextWeight = weight.trim() === "" ? null : Number(weight);
    const nextReps = reps.trim() === "" ? null : Number(reps);
    const nextDistance = distance.trim() === "" ? null : Number(distance);
    const nextDuration = duration.trim() === "" ? null : parseTimeToSeconds(duration);
    const nextSpm = spm.trim() === "" ? null : Number(spm);

    if (duration.trim() !== "" && nextDuration === null) {
      setProblem("Time doesn't parse — use m:ss, like 2:17.");
      return;
    }
    setProblem(null);

    setSaving(true);
    await updateSet(sessionClientId, {
      ...set,
      weightLbs: Number.isFinite(nextWeight as number) ? nextWeight : null,
      reps: Number.isFinite(nextReps as number) ? nextReps : null,
      distanceM: Number.isFinite(nextDistance as number) ? nextDistance : null,
      durationS: nextDuration,
      spm: Number.isFinite(nextSpm as number) ? nextSpm : null,
      notes,
    });
    setSaving(false);
    requestSync();
    onChanged();
  }

  async function remove() {
    await deleteSet(sessionClientId, set);
    requestSync();
    onChanged();
  }

  return (
    <div className="rounded-lg border border-border/70 bg-background/30 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs text-muted-foreground">Set {set.setIndex + 1}</span>
        <button
          type="button"
          onClick={() => void remove()}
          aria-label={`Delete set ${set.setIndex + 1}`}
          className="flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-destructive"
        >
          <Trash2Icon className="icon-sm" aria-hidden />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {columns.map((column) => (
          <div key={String(column)} className="min-w-0">
            <label className={LABEL} htmlFor={`edit-${set.clientId}-${String(column)}`}>
              {COLUMN_LABEL[column]}
            </label>
            <input
              id={`edit-${set.clientId}-${String(column)}`}
              value={
                column === "weightLbs"
                  ? weight
                  : column === "reps"
                    ? reps
                    : column === "distanceM"
                      ? distance
                      : column === "durationS"
                        ? duration
                        : spm
              }
              onChange={(event) => {
                const value = event.target.value;
                if (column === "weightLbs") setWeight(value);
                else if (column === "reps") setReps(value);
                else if (column === "distanceM") setDistance(value);
                else if (column === "durationS") setDuration(value);
                else setSpm(value);
              }}
              inputMode={column === "durationS" ? "text" : "decimal"}
              placeholder={column === "durationS" ? "m:ss" : undefined}
              className={`${FIELD} mt-1 font-mono`}
            />
          </div>
        ))}
      </div>

      <div className="mt-3">
        <label className={LABEL} htmlFor={`edit-${set.clientId}-notes`}>
          Note
        </label>
        <input
          id={`edit-${set.clientId}-notes`}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          className={`${FIELD} mt-1`}
        />
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="rounded-md border border-primary/50 px-3 py-1.5 text-xs text-primary transition-colors hover:border-primary hover:bg-primary/10 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save set"}
        </button>
        {problem && <p className="text-xs text-destructive">{problem}</p>}
      </div>
    </div>
  );
}
