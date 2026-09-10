"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { TrendChart } from "@/components/site/chart";
import { ExerciseEditForm } from "@/components/site/exercise-edit-form";
import { MuscleMap } from "@/components/site/muscle-map";
import { SYNC_DONE_EVENT } from "@/components/site/sync-runner";
import { localCatalogue, localEfforts, mergeCatalogue, withLocal } from "@/lib/athletics/local";
import type { LocalExercise } from "@/lib/athletics/local";
import {
  ergRecords,
  estimateOneRepMax,
  formatDuration,
  formatSplit,
  isWorkingSet,
  strengthRecords,
  type Effort,
} from "@/lib/athletics/prs";
import { archiveExercise, deleteExercise, unarchiveExercise } from "@/lib/athletics/session";
import { e1rmSeries } from "@/lib/athletics/trends";

/** 100 down to 50 in steps of 5 — the range a programming table actually uses. */
const PERCENTS = [100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50];

const DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "UTC" });

/**
 * One exercise, in full — figure, how-to, every logged set, an e1RM trend and a 1RM percentage
 * table for a lift, or the per-distance record table for an erg/water piece (V4 Phase 2++
 * Stage 4).
 *
 * `slug` is `seedKey ?? name`, URL-encoded — see `exercise-list.tsx`'s `exerciseHref`. Looked up
 * against the same merged bundle-plus-mirror catalogue every other athletics screen reads, so
 * this page works before the first sync completes, same as everywhere else in this app.
 */
export function ExerciseDetail({ slug }: { slug: string }) {
  const [mirrored, setMirrored] = useState<LocalExercise[]>([]);
  const [efforts, setEfforts] = useState<Effort[]>([]);
  const [generation, setGeneration] = useState(0);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    const bump = () => setGeneration((n) => n + 1);
    window.addEventListener(SYNC_DONE_EVENT, bump);
    return () => window.removeEventListener(SYNC_DONE_EVENT, bump);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void withLocal(async (db) => {
      const [list, history] = await Promise.all([localCatalogue(db), localEfforts(db)]);
      if (cancelled) return;
      setMirrored(list);
      setEfforts(history);
    });
    return () => {
      cancelled = true;
    };
  }, [generation]);

  const catalogue = useMemo(() => mergeCatalogue(mirrored), [mirrored]);
  const decoded = decodeURIComponent(slug);
  const entry = catalogue.find((e) => e.seedKey === decoded || e.name === decoded) ?? null;

  const history = useMemo(
    () => (entry ? efforts.filter((e) => e.exercise === entry.name) : []),
    [efforts, entry],
  );

  async function onArchiveToggle() {
    if (!entry?.clientId) return;
    setBusy(true);
    setProblem(null);
    const editable = {
      clientId: entry.clientId,
      seedKey: entry.seedKey,
      name: entry.name,
      modality: entry.modality,
      equipment: entry.equipment,
      primaryMuscles: entry.primaryMuscles,
      secondaryMuscles: entry.secondaryMuscles,
      aliases: entry.aliases,
      howTo: entry.howTo,
      notes: entry.notes,
      restSeconds: entry.restSeconds,
      source: entry.seedKey ? "seed" : "manual",
      userEditedFields: entry.userEditedFields,
    };
    const result = entry.archivedAt
      ? await unarchiveExercise(editable)
      : await archiveExercise(editable);
    setBusy(false);
    if (!result.ok) setProblem(result.message);
    else setGeneration((n) => n + 1);
  }

  async function onDelete() {
    if (!entry?.clientId) return;
    if (!window.confirm(`Delete "${entry.name}" permanently? This cannot be undone.`)) return;
    setBusy(true);
    setProblem(null);
    const result = await deleteExercise({
      clientId: entry.clientId,
      seedKey: entry.seedKey,
      name: entry.name,
      modality: entry.modality,
      equipment: entry.equipment,
      primaryMuscles: entry.primaryMuscles,
      secondaryMuscles: entry.secondaryMuscles,
      aliases: entry.aliases,
      howTo: entry.howTo,
      notes: entry.notes,
      restSeconds: entry.restSeconds,
      source: entry.seedKey ? "seed" : "manual",
      userEditedFields: entry.userEditedFields,
    });
    setBusy(false);
    if (!result.ok) setProblem(result.message);
  }

  if (!entry) {
    return (
      <p className="rounded-md border border-border bg-card/40 px-4 py-6 text-sm text-muted-foreground">
        Not found on this device yet — it may still be syncing.
      </p>
    );
  }

  if (editing) {
    return (
      <ExerciseEditForm
        initial={entry}
        onCancel={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          setGeneration((n) => n + 1);
        }}
      />
    );
  }

  const strength = entry.modality === "lift" ? strengthRecords(history)[0] : null;
  const erg = entry.modality === "erg" || entry.modality === "water" ? ergRecords(history) : null;
  const e1rmPoints = entry.modality === "lift" ? e1rmSeries(history, entry.name) : [];
  const bestE1rm = strength?.bestE1rm?.e1rm ?? null;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col items-start gap-4 sm:flex-row">
        <MuscleMap primary={entry.primaryMuscles} secondary={entry.secondaryMuscles} size={200} />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight">
            {entry.name}
            {entry.archivedAt && (
              <span className="ml-2 rounded border border-border/70 px-1.5 py-0.5 align-middle font-mono text-xs text-muted-foreground">
                archived
              </span>
            )}
          </h1>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {entry.modality} · {entry.equipment}
            {entry.primaryMuscles.length > 0 && ` · ${entry.primaryMuscles.join(", ")}`}
            {entry.secondaryMuscles.length > 0 && ` (+ ${entry.secondaryMuscles.join(", ")})`}
          </p>
          {entry.aliases.length > 0 && (
            <p className="mt-1 font-mono text-[0.65rem] text-muted-foreground">
              Also: {entry.aliases.join(", ")}
            </p>
          )}

          <p className="mt-4 text-sm leading-relaxed text-foreground">
            {entry.howTo || "No description yet."}
          </p>
          {entry.notes && <p className="mt-2 text-sm text-muted-foreground">{entry.notes}</p>}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="min-h-10 rounded-md border border-border px-3 text-sm text-foreground transition-colors hover:border-primary/50"
            >
              Edit
            </button>
            {entry.clientId && (
              <>
                <button
                  type="button"
                  onClick={() => void onArchiveToggle()}
                  disabled={busy}
                  className="min-h-10 rounded-md border border-border px-3 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
                >
                  {entry.archivedAt ? "Unarchive" : "Archive"}
                </button>
                {entry.archivedAt && (
                  <button
                    type="button"
                    onClick={() => void onDelete()}
                    disabled={busy}
                    className="min-h-10 rounded-md border border-destructive/50 px-3 text-sm text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-60"
                  >
                    Delete permanently
                  </button>
                )}
              </>
            )}
          </div>
          {problem && <p className="mt-2 text-sm text-destructive">{problem}</p>}
        </div>
      </div>

      {strength && (
        <section>
          <h2 className="text-lg font-bold tracking-tight">Records</h2>
          <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-border bg-card/70 p-3">
              <dt className="eyebrow text-muted-foreground">Heaviest</dt>
              <dd className="tabular mt-1 font-mono text-lg text-primary">
                {strength.heaviest
                  ? `${strength.heaviest.weightLbs} × ${strength.heaviest.reps}`
                  : "—"}
              </dd>
            </div>
            <div className="rounded-lg border border-border bg-card/70 p-3">
              <dt className="eyebrow text-muted-foreground">Est. 1RM</dt>
              <dd className="tabular mt-1 font-mono text-lg text-foreground">{bestE1rm ?? "—"}</dd>
            </div>
            <div className="rounded-lg border border-border bg-card/70 p-3">
              <dt className="eyebrow text-muted-foreground">Working sets</dt>
              <dd className="tabular mt-1 font-mono text-lg text-foreground">
                {strength.workingSets}
              </dd>
            </div>
            <div className="rounded-lg border border-border bg-card/70 p-3">
              <dt className="eyebrow text-muted-foreground">Last done</dt>
              <dd className="tabular mt-1 font-mono text-sm text-foreground">
                {DAY.format(strength.lastPerformed)}
              </dd>
            </div>
          </dl>

          {e1rmPoints.length > 1 && (
            <div className="mt-4 rounded-lg border border-border bg-card/70 p-4">
              <TrendChart
                labels={e1rmPoints.map((p) => p.day)}
                series={[
                  {
                    label: "Est. 1RM",
                    color: "var(--primary)",
                    values: e1rmPoints.map((p) => p.value),
                  },
                ]}
                format={(v) => `${Math.round(v)}`}
                caption={`Estimated one-rep max for ${entry.name} per training day`}
              />
            </div>
          )}

          {bestE1rm !== null && (
            <div className="mt-4 overflow-x-auto rounded-lg border border-border bg-card/70">
              <table className="w-full min-w-[24rem] text-left">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-2 eyebrow text-muted-foreground">% of 1RM</th>
                    <th className="px-4 py-2 eyebrow text-muted-foreground">Weight</th>
                  </tr>
                </thead>
                <tbody>
                  {PERCENTS.map((pct) => (
                    <tr key={pct} className="border-b border-border/60 last:border-0">
                      <td className="tabular px-4 py-1.5 font-mono text-sm text-muted-foreground">
                        {pct}%
                      </td>
                      <td className="tabular px-4 py-1.5 font-mono text-sm text-foreground">
                        {Math.round(bestE1rm * (pct / 100))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {erg && erg.length > 0 && (
        <section>
          <h2 className="text-lg font-bold tracking-tight">Records by distance</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Ranked by split rather than finishing time, so each distance is judged against itself —
            the collapse from twenty-two erg names to three (V4 Phase 2++ Stage 3) survives this for
            free, since a PR was always bucketed by distance, not by name.
          </p>
          <div className="mt-3 overflow-x-auto rounded-lg border border-border bg-card/70">
            <table className="w-full min-w-[28rem] text-left">
              <thead>
                <tr className="border-b border-border">
                  {["Distance", "Time", "Split /500m", "Date"].map((h) => (
                    <th key={h} className="px-4 py-2 eyebrow text-muted-foreground">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {erg.map((record) => (
                  <tr key={record.distanceM} className="border-b border-border/60 last:border-0">
                    <td className="tabular px-4 py-2 font-mono text-xs text-muted-foreground">
                      {record.distanceM}m
                    </td>
                    <td className="tabular px-4 py-2 font-mono text-xs text-muted-foreground">
                      {formatDuration(record.durationS)}
                    </td>
                    <td className="tabular px-4 py-2 font-mono text-sm text-primary">
                      {formatSplit(record.splitPer500S)}
                    </td>
                    <td className="tabular px-4 py-2 font-mono text-[0.65rem] text-muted-foreground">
                      {DAY.format(record.performedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section>
        <h2 className="text-lg font-bold tracking-tight">Every logged set</h2>
        {history.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Nothing logged yet on this device.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border rounded-lg border border-border bg-card/70">
            {[...history]
              .sort((a, b) => b.performedAt.getTime() - a.performedAt.getTime())
              .map((set, i) => {
                const e1rm =
                  set.weightLbs !== null && set.reps !== null
                    ? estimateOneRepMax(set.weightLbs, set.reps)
                    : null;
                return (
                  <li key={i} className="flex flex-wrap items-baseline gap-x-3 px-4 py-2 text-sm">
                    <span className="tabular font-mono text-[0.65rem] text-muted-foreground">
                      {DAY.format(set.performedAt)}
                    </span>
                    <span className="text-foreground">
                      {set.weightLbs !== null && set.reps !== null
                        ? `${set.weightLbs} × ${set.reps}`
                        : set.distanceM !== null
                          ? `${set.distanceM}m${set.durationS ? ` in ${formatDuration(set.durationS)}` : ""}`
                          : "—"}
                    </span>
                    {!isWorkingSet(set) && (
                      <span className="rounded border border-border/70 px-1.5 py-0.5 font-mono text-[0.55rem] text-muted-foreground">
                        {set.setType}
                      </span>
                    )}
                    {e1rm !== null && (
                      <span className="tabular font-mono text-[0.6rem] text-muted-foreground">
                        e1RM {e1rm}
                      </span>
                    )}
                  </li>
                );
              })}
          </ul>
        )}
      </section>

      <Link
        href="/private/athletics/exercises"
        className="font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        ← all exercises
      </Link>
    </div>
  );
}
