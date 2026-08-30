/**
 * Personal records, derived on read.
 *
 * Nothing here is persisted. A stored PR is a cached answer that goes wrong the moment a
 * workout is corrected or deleted, and the failure is invisible — the number simply stays
 * high forever. Recomputing over a few thousand sets costs nothing at this scale.
 */

export type Effort = {
  exercise: string;
  performedAt: Date;
  setType: string;
  weightLbs: number | null;
  reps: number | null;
  distanceM: number | null;
  durationS: number | null;
  /** Strokes per minute, erg work only. Checked against the vault's per-distance targets. */
  spm: number | null;
};

export type StrengthRecord = {
  exercise: string;
  heaviest: { weightLbs: number; reps: number; performedAt: Date } | null;
  bestE1rm: { e1rm: number; weightLbs: number; reps: number; performedAt: Date } | null;
  byReps: { reps: number; weightLbs: number; performedAt: Date }[];
  lastPerformed: Date;
  workingSets: number;
};

export type ErgRecord = {
  exercise: string;
  distanceM: number;
  durationS: number;
  splitPer500S: number;
  performedAt: Date;
};

/**
 * Epley. Above roughly 12 reps the estimate drifts far enough that a high-rep set can
 * outrank a genuine heavy single, which would put a set of 20 at the top of a strength
 * board. Capped rather than extrapolated.
 */
export const E1RM_REP_CAP = 12;

export function estimateOneRepMax(weightLbs: number, reps: number): number | null {
  if (weightLbs <= 0 || reps <= 0 || reps > E1RM_REP_CAP) return null;
  return Math.round(weightLbs * (1 + reps / 30) * 10) / 10;
}

/** A working set is one that counts. Warmups and drop sets are logged but never ranked. */
export function isWorkingSet(effort: Effort): boolean {
  const type = effort.setType.toLowerCase();
  return type !== "warmup" && type !== "warm up" && type !== "drop";
}

function isStrength(e: Effort): boolean {
  return e.weightLbs !== null && e.weightLbs > 0 && e.reps !== null && e.reps > 0;
}

function isErg(e: Effort): boolean {
  return e.distanceM !== null && e.distanceM > 0 && e.durationS !== null && e.durationS > 0;
}

export function strengthRecords(efforts: Effort[]): StrengthRecord[] {
  const groups = new Map<string, Effort[]>();
  for (const effort of efforts) {
    if (!isWorkingSet(effort) || !isStrength(effort)) continue;
    const list = groups.get(effort.exercise);
    if (list) list.push(effort);
    else groups.set(effort.exercise, [effort]);
  }

  const records: StrengthRecord[] = [];

  for (const [exercise, sets] of groups) {
    let heaviest: StrengthRecord["heaviest"] = null;
    let bestE1rm: StrengthRecord["bestE1rm"] = null;
    const perReps = new Map<number, { weightLbs: number; performedAt: Date }>();
    let lastPerformed = sets[0].performedAt;

    for (const set of sets) {
      const weightLbs = set.weightLbs!;
      const reps = set.reps!;

      // Strictly greater, so the *first* time a weight was hit keeps the record rather than
      // the most recent repeat of it.
      if (!heaviest || weightLbs > heaviest.weightLbs) {
        heaviest = { weightLbs, reps, performedAt: set.performedAt };
      }

      const e1rm = estimateOneRepMax(weightLbs, reps);
      if (e1rm !== null && (!bestE1rm || e1rm > bestE1rm.e1rm)) {
        bestE1rm = { e1rm, weightLbs, reps, performedAt: set.performedAt };
      }

      const existing = perReps.get(reps);
      if (!existing || weightLbs > existing.weightLbs) {
        perReps.set(reps, { weightLbs, performedAt: set.performedAt });
      }

      if (set.performedAt > lastPerformed) lastPerformed = set.performedAt;
    }

    records.push({
      exercise,
      heaviest,
      bestE1rm,
      byReps: [...perReps.entries()]
        .map(([reps, v]) => ({ reps, ...v }))
        .sort((a, b) => a.reps - b.reps),
      lastPerformed,
      workingSets: sets.length,
    });
  }

  return records.sort(
    (a, b) =>
      b.lastPerformed.getTime() - a.lastPerformed.getTime() || a.exercise.localeCompare(b.exercise),
  );
}

/**
 * Best erg piece per exercise and distance. Ranked by split rather than elapsed time so a
 * 2k and a 5k are each judged against themselves — the vault's goal is a *split* target
 * ("sub-2:00 weight-adjusted 500m"), not a finishing time.
 */
export function ergRecords(efforts: Effort[]): ErgRecord[] {
  const best = new Map<string, ErgRecord>();

  for (const effort of efforts) {
    if (!isWorkingSet(effort) || !isErg(effort)) continue;
    const distanceM = effort.distanceM!;
    const durationS = effort.durationS!;
    // Round to the nearest 100 m so a GPS-ish 4998 m and a 5000 m piece compare as one.
    const bucket = Math.round(distanceM / 100) * 100;
    const key = `${effort.exercise}::${bucket}`;
    const splitPer500S = (durationS / distanceM) * 500;

    const existing = best.get(key);
    if (!existing || splitPer500S < existing.splitPer500S) {
      best.set(key, {
        exercise: effort.exercise,
        distanceM: bucket,
        durationS,
        splitPer500S,
        performedAt: effort.performedAt,
      });
    }
  }

  return [...best.values()].sort(
    (a, b) => a.exercise.localeCompare(b.exercise) || a.distanceM - b.distanceM,
  );
}

/** Seconds as m:ss.t — the form an erg monitor shows. */
export function formatSplit(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  const minutes = Math.floor(seconds / 60);
  const rest = seconds - minutes * 60;
  return `${minutes}:${rest.toFixed(1).padStart(4, "0")}`;
}

/** Seconds as h:mm:ss or m:ss. Used for elapsed piece time, not split. */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}
