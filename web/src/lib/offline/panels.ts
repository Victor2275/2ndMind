import { summarise } from "@/lib/log/categories";
import type { LocalRecord } from "@/lib/sync/store";

/**
 * What the phone can show with no signal, derived from the local mirror (V3 §2.1).
 *
 * Pure: mirrored rows in, panels out. The reading of IndexedDB is `read.ts`; everything here
 * is arithmetic over plain objects, which is what makes the interesting parts — what counts as
 * "today" in a timezone, which task is overdue, whether a screen is too stale to trust —
 * testable without a browser.
 *
 * **The governing rule: a cached screen must read as cached.** Never as current. Every panel
 * built here carries the age of the data in it, and the page renders that age rather than
 * deciding it is small enough to omit. A dashboard that looks live and is three days old is
 * worse than one that says it is three days old, because the first one gets acted on.
 *
 * This is a subset of the online pages on purpose, and the subset is exactly *what has been
 * mirrored*. Calendar events and vault documents are not in the local store at all — no amount
 * of care here can render them — so the page says so instead of showing an empty panel that
 * reads as "nothing on today".
 */

/** Local rows carry the server's shape, which is JSON out of a column. */
type Row = Record<string, unknown>;

export type CachedTask = {
  id: string;
  title: string;
  dueAt: string | null;
  courseCode: string | null;
  domain: string | null;
  overdue: boolean;
};

export type CachedEntry = {
  id: string;
  category: string;
  occurredAt: string;
  line: string;
};

export type CachedSet = {
  exercise: string;
  performedAt: string;
  weightLbs: number | null;
  reps: number | null;
  distanceM: number | null;
  durationS: number | null;
};

/**
 * How old the local copy is, and therefore how loudly to say so.
 *
 * `fresh` still shows its age — the threshold changes the tone, never whether the age appears.
 */
export type Freshness = {
  lastSyncAt: number | null;
  ageMs: number | null;
  level: "never" | "fresh" | "aging" | "stale";
};

export const AGING_MS = 6 * 60 * 60 * 1000;
export const STALE_MS = 48 * 60 * 60 * 1000;

export function freshnessOf(lastSyncAt: number | null, now = Date.now()): Freshness {
  if (lastSyncAt === null) return { lastSyncAt: null, ageMs: null, level: "never" };
  const ageMs = Math.max(0, now - lastSyncAt);
  const level = ageMs >= STALE_MS ? "stale" : ageMs >= AGING_MS ? "aging" : "fresh";
  return { lastSyncAt, ageMs, level };
}

/* ------------------------------------------------------------------ tasks */

/**
 * Open tasks due by the end of today, soonest first.
 *
 * "Today" is a local-day boundary, not `now + 24h`. A task due at 9pm is due today at 8am and
 * at 8pm; a rolling window would make it appear and vanish depending on when the phone was
 * looked at, which is the kind of thing that quietly destroys trust in a list.
 */
export function dueToday(records: readonly LocalRecord[], now = new Date()): CachedTask[] {
  const end = endOfLocalDay(now);

  return records
    .map((record) => record.row)
    .filter((row) => !row.doneAt)
    .filter((row) => typeof row.dueAt === "string" && Date.parse(row.dueAt) <= end)
    .map((row) => toTask(row, now))
    .sort((a, b) => (a.dueAt ?? "").localeCompare(b.dueAt ?? ""));
}

/** Open tasks with no due date — the backlog, newest first. */
export function undated(records: readonly LocalRecord[], now = new Date()): CachedTask[] {
  return records
    .map((record) => record.row)
    .filter((row) => !row.doneAt && !row.dueAt)
    .map((row) => toTask(row, now));
}

/** Open tasks carrying a course code, grouped by course. */
export function byCourse(
  records: readonly LocalRecord[],
  now = new Date(),
): { course: string; tasks: CachedTask[] }[] {
  const groups = new Map<string, CachedTask[]>();

  for (const record of records) {
    const row = record.row;
    if (row.doneAt) continue;
    const course = typeof row.courseCode === "string" ? row.courseCode.trim() : "";
    if (course === "") continue;
    const list = groups.get(course) ?? [];
    list.push(toTask(row, now));
    groups.set(course, list);
  }

  return [...groups.entries()]
    .map(([course, tasks]) => ({
      course,
      tasks: tasks.sort((a, b) => (a.dueAt ?? "￿").localeCompare(b.dueAt ?? "￿")),
    }))
    .sort((a, b) => a.course.localeCompare(b.course));
}

function toTask(row: Row, now: Date): CachedTask {
  const dueAt = typeof row.dueAt === "string" ? row.dueAt : null;
  return {
    id: String(row.clientId ?? row.id ?? ""),
    title: typeof row.title === "string" ? row.title : "",
    dueAt,
    courseCode: typeof row.courseCode === "string" ? row.courseCode : null,
    domain: typeof row.domain === "string" ? row.domain : null,
    overdue: dueAt !== null && Date.parse(dueAt) < now.getTime(),
  };
}

/* ------------------------------------------------------------------- log */

/** Everything logged on the given local day, newest first. */
export function loggedOn(records: readonly LocalRecord[], now = new Date()): CachedEntry[] {
  const start = startOfLocalDay(now);
  const end = endOfLocalDay(now);

  return records
    .map((record) => record.row)
    .filter((row) => {
      const at = typeof row.occurredAt === "string" ? Date.parse(row.occurredAt) : NaN;
      return Number.isFinite(at) && at >= start && at <= end;
    })
    .map((row) => ({
      id: String(row.clientId ?? row.id ?? ""),
      category: String(row.category ?? ""),
      occurredAt: String(row.occurredAt ?? ""),
      line: summarise(
        String(row.category ?? ""),
        isRecord(row.data) ? row.data : {},
        typeof row.note === "string" ? row.note : "",
      ),
    }))
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

/* -------------------------------------------------------------- athletics */

/**
 * The most recent training, from both sources — the same merge `allEfforts()` does on the
 * server (D-159), done again here because the phone has no server to ask.
 *
 * Kept as a list of sets rather than recomputed into records: an offline PR board would have
 * to agree exactly with the online one, and two implementations of `strengthRecords` drifting
 * apart is a worse outcome than not showing PRs offline at all.
 */
export function recentSets(
  logs: readonly LocalRecord[],
  sets: readonly LocalRecord[],
  workouts: readonly LocalRecord[],
  limit = 20,
): CachedSet[] {
  const dates = new Map<string, string>();
  for (const workout of workouts) {
    const row = workout.row;
    if (typeof row.id === "number" && typeof row.performedAt === "string") {
      dates.set(String(row.id), row.performedAt);
    }
  }

  const all: CachedSet[] = [];

  for (const record of sets) {
    const row = record.row;
    const performedAt = dates.get(String(row.workoutId));
    if (!performedAt) continue; // Its session has not been mirrored yet.
    all.push({
      exercise: typeof row.exercise === "string" ? row.exercise : "",
      performedAt,
      weightLbs: numberOrNull(row.weightLbs),
      reps: numberOrNull(row.reps),
      distanceM: numberOrNull(row.distanceM),
      durationS: numberOrNull(row.durationS),
    });
  }

  for (const record of logs) {
    const row = record.row;
    if (row.category !== "athletics") continue;
    const data = isRecord(row.data) ? row.data : {};
    const exercise = typeof data.exercise === "string" ? data.exercise.trim() : "";
    if (exercise === "") continue;
    const performedAt = typeof row.occurredAt === "string" ? row.occurredAt : "";

    for (const set of Array.isArray(data.sets) ? data.sets : []) {
      if (!isRecord(set)) continue;
      all.push({
        exercise,
        performedAt,
        weightLbs: numberOrNull(set.weightLbs),
        reps: numberOrNull(set.reps),
        distanceM: numberOrNull(set.distance),
        durationS: numberOrNull(set.duration),
      });
    }
  }

  return all.sort((a, b) => b.performedAt.localeCompare(a.performedAt)).slice(0, limit);
}

/** The latest weigh-in, or null. Keyed by day, so string order is chronological order. */
export function latestWeight(
  records: readonly LocalRecord[],
): { measuredOn: string; weightLbs: number } | null {
  let best: { measuredOn: string; weightLbs: number } | null = null;

  for (const record of records) {
    const row = record.row;
    const measuredOn = typeof row.measuredOn === "string" ? row.measuredOn : null;
    const weightLbs = numberOrNull(row.weightLbs);
    if (measuredOn === null || weightLbs === null) continue;
    if (best === null || measuredOn > best.measuredOn) best = { measuredOn, weightLbs };
  }

  return best;
}

/** Rehab items ticked on the given local day. */
export function rehabDoneOn(records: readonly LocalRecord[], now = new Date()): string[] {
  const day = localDay(now);
  return records
    .map((record) => record.row)
    .filter((row) => row.completedOn === day && typeof row.slug === "string")
    .map((row) => String(row.slug))
    .sort();
}

/* ------------------------------------------------------------------ dates */

/**
 * The local day, as `YYYY-MM-DD`.
 *
 * `toISOString()` would answer in UTC, and from 5pm in California onward that is already
 * tomorrow — which would file an evening's rehab under the wrong day and make "logged today"
 * empty every evening. The same trap `recordBodyweightAction` and the log form each already
 * document.
 */
export function localDay(now: Date): string {
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function startOfLocalDay(now: Date): number {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return start.getTime();
}

function endOfLocalDay(now: Date): number {
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return end.getTime();
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * The newest stored AI summary the phone has, whatever its age (V3 §3.6).
 *
 * Age is not a filter here, it is a label. The summary is rendered with the day it describes,
 * which is the same rule the rest of this screen follows for its data — a cached screen says
 * how old it is rather than hiding what it has. D-124 persisted these precisely so they could
 * outlive the call that produced them; refusing to show one because it is from Tuesday would
 * undo that.
 *
 * `daily` only. A weekly summary describing a week is a different claim from a daily one
 * describing today, and mixing them under one heading would make the date do work it cannot.
 */
export function latestSummary(
  records: { row: Record<string, unknown>; deletedAt: string | null }[],
): { periodStart: string; summary: string } | null {
  const daily = records
    .filter((r) => r.deletedAt === null && r.row.kind === "daily")
    .map((r) => ({
      periodStart: String(r.row.periodStart ?? ""),
      summary: String(r.row.summary ?? ""),
    }))
    .filter((r) => r.periodStart !== "" && r.summary !== "")
    .sort((a, b) => b.periodStart.localeCompare(a.periodStart));

  return daily[0] ?? null;
}
