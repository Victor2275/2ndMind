import { adjustSeconds, weightOn, type BodyweightReading } from "./adjusted";
import type { PlannedDay, SpmTarget } from "./protocol";
import { estimateOneRepMax, isWorkingSet, type Effort } from "./prs";

/**
 * Series and comparisons derived from stored sets.
 *
 * Everything here is a pure function over rows the caller already loaded. That keeps it
 * testable without a database and keeps the page a single round trip: one read of every
 * effort, then several cheap passes, rather than one query per chart.
 *
 * Nothing is persisted, for the reason `prs.ts` gives — a stored aggregate silently keeps
 * reading high after the workout behind it is corrected.
 */

export type Point = { day: string; value: number };

/** Local calendar day for a timestamp. `en-CA` is the locale that formats as `YYYY-MM-DD`. */
const DAY_FORMAT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Los_Angeles",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function isoDay(date: Date): string {
  return DAY_FORMAT.format(date);
}

/** Sorted `YYYY-MM-DD` keys — string order is chronological order for ISO dates. */
function toPoints(byDay: Map<string, number>): Point[] {
  return [...byDay.entries()]
    .map(([day, value]) => ({ day, value }))
    .sort((a, b) => a.day.localeCompare(b.day));
}

export function bodyweightSeries(readings: BodyweightReading[]): Point[] {
  return readings
    .map((r) => ({ day: r.measuredOn, value: r.weightLbs }))
    .sort((a, b) => a.day.localeCompare(b.day));
}

/**
 * Best estimated 1RM per training day for one lift.
 *
 * Per-day best rather than a running maximum: a running maximum only ever goes up, which
 * makes a plateau and a deload look identical. The point of the chart is to show when a lift
 * stops moving.
 */
export function e1rmSeries(efforts: Effort[], exercise: string): Point[] {
  const byDay = new Map<string, number>();

  for (const effort of efforts) {
    if (effort.exercise !== exercise || !isWorkingSet(effort)) continue;
    if (effort.weightLbs === null || effort.reps === null) continue;

    const e1rm = estimateOneRepMax(effort.weightLbs, effort.reps);
    if (e1rm === null) continue;

    const day = isoDay(effort.performedAt);
    const best = byDay.get(day);
    if (best === undefined || e1rm > best) byDay.set(day, e1rm);
  }

  return toPoints(byDay);
}

/** Lifts with enough separate training days to be worth charting, most-trained first. */
export function chartableLifts(efforts: Effort[], minDays = 3): string[] {
  const days = new Map<string, Set<string>>();

  for (const effort of efforts) {
    if (!isWorkingSet(effort)) continue;
    if (effort.weightLbs === null || effort.reps === null) continue;
    const set = days.get(effort.exercise) ?? new Set<string>();
    set.add(isoDay(effort.performedAt));
    days.set(effort.exercise, set);
  }

  return [...days.entries()]
    .filter(([, set]) => set.size >= minDays)
    .sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0]))
    .map(([exercise]) => exercise);
}

export type SplitPoint = Point & { adjusted: number | null; distanceM: number };

/**
 * Best split per day for erg pieces near a distance, raw and weight-adjusted.
 *
 * Both lines, always. The adjusted line alone would let a lighter month read as a faster
 * month, and the raw line alone cannot be compared against the vault's goal.
 */
export function splitSeries(
  efforts: Effort[],
  distanceM: number,
  readings: BodyweightReading[],
  tolerance = 0.15,
): SplitPoint[] {
  const byDay = new Map<string, SplitPoint>();

  for (const effort of efforts) {
    if (!isWorkingSet(effort)) continue;
    if (effort.distanceM === null || effort.durationS === null) continue;
    if (effort.distanceM <= 0 || effort.durationS <= 0) continue;
    // Within tolerance of the nominal distance, so a 1,980 m piece counts toward the 2k.
    if (Math.abs(effort.distanceM - distanceM) / distanceM > tolerance) continue;

    const day = isoDay(effort.performedAt);
    const split = (effort.durationS / effort.distanceM) * 500;
    const existing = byDay.get(day);
    if (existing && existing.value <= split) continue;

    const weight = weightOn(readings, day);
    byDay.set(day, {
      day,
      value: split,
      adjusted: weight === null ? null : adjustSeconds(split, weight),
      distanceM: effort.distanceM,
    });
  }

  return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
}

/** Distances that have erg pieces on at least `minDays` separate days. */
export function chartableDistances(efforts: Effort[], minDays = 3): number[] {
  const days = new Map<number, Set<string>>();

  for (const effort of efforts) {
    if (!isWorkingSet(effort)) continue;
    if (effort.distanceM === null || effort.durationS === null) continue;
    if (effort.distanceM <= 0 || effort.durationS <= 0) continue;
    // Same 100 m bucketing the PR table uses, so the two agree on what "a 2k" is.
    const bucket = Math.round(effort.distanceM / 100) * 100;
    const set = days.get(bucket) ?? new Set<string>();
    set.add(isoDay(effort.performedAt));
    days.set(bucket, set);
  }

  return [...days.entries()]
    .filter(([, set]) => set.size >= minDays)
    .sort((a, b) => a[0] - b[0])
    .map(([bucket]) => bucket);
}

export type WeekVolume = {
  /** Monday of the week, `YYYY-MM-DD`. */
  weekStart: string;
  volumeLbs: number;
  metres: number;
  sessions: number;
};

/**
 * An ISO day shifted by whole days.
 *
 * Anchored at noon UTC so a `setUTCDate` across a DST boundary cannot land back on the same
 * calendar day — the classic off-by-one in date arithmetic done on midnight.
 */
export function shiftDay(day: string, days: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Monday of the week containing an ISO day, as an ISO day. */
export function weekStartOf(day: string): string {
  const date = new Date(`${day}T12:00:00Z`);
  const shift = (date.getUTCDay() + 6) % 7; // Monday-based
  date.setUTCDate(date.getUTCDate() - shift);
  return date.toISOString().slice(0, 10);
}

/**
 * Volume by week.
 *
 * Warmup sets are **included**, which Victor confirmed is what he wants: they are load the
 * body absorbed, even though they must never set a PR. This is the one place the two rules
 * differ, and `isWorkingSet` is deliberately not applied here.
 */
export function weeklyVolume(efforts: Effort[], weeks = 12): WeekVolume[] {
  const byWeek = new Map<string, WeekVolume>();
  const sessionDays = new Map<string, Set<string>>();

  for (const effort of efforts) {
    const day = isoDay(effort.performedAt);
    const weekStart = weekStartOf(day);

    const bucket = byWeek.get(weekStart) ?? { weekStart, volumeLbs: 0, metres: 0, sessions: 0 };
    bucket.volumeLbs += (effort.weightLbs ?? 0) * (effort.reps ?? 0);
    bucket.metres += effort.distanceM ?? 0;
    byWeek.set(weekStart, bucket);

    const days = sessionDays.get(weekStart) ?? new Set<string>();
    days.add(day);
    sessionDays.set(weekStart, days);
  }

  for (const [weekStart, days] of sessionDays) {
    const bucket = byWeek.get(weekStart);
    if (bucket) bucket.sessions = days.size;
  }

  return [...byWeek.values()].sort((a, b) => a.weekStart.localeCompare(b.weekStart)).slice(-weeks);
}

export type SpmFlag = {
  exercise: string;
  performedAt: Date;
  distanceM: number;
  spm: number;
  target: SpmTarget;
  status: "under" | "in range" | "over";
};

/**
 * Every erg piece with a stroke rate, checked against the vault's target for its distance.
 *
 * Nearest target on a ratio scale, not an absolute one: 500 m sits between the 200 m and
 * 2,000 m targets, and absolute distance would drag a 1,000 m piece toward the 2 k target
 * purely because 1,000 is numerically nearer 2,000 than 200.
 *
 * "over" is reported rather than treated as success. Rating above the 2 k band means the
 * stroke is short — which is the exact weakness the vault records ("maximum length/reach").
 */
export function flagSpm(efforts: Effort[], targets: SpmTarget[]): SpmFlag[] {
  if (targets.length === 0) return [];

  const flags: SpmFlag[] = [];

  for (const effort of efforts) {
    if (!isWorkingSet(effort)) continue;
    if (effort.spm === null || effort.spm <= 0) continue;
    if (effort.distanceM === null || effort.distanceM <= 0) continue;

    const distanceM = effort.distanceM;
    const target = targets.reduce((best, candidate) =>
      Math.abs(Math.log(distanceM / candidate.distanceM)) <
      Math.abs(Math.log(distanceM / best.distanceM))
        ? candidate
        : best,
    );

    flags.push({
      exercise: effort.exercise,
      performedAt: effort.performedAt,
      distanceM,
      spm: effort.spm,
      target,
      status:
        effort.spm < target.minSpm ? "under" : effort.spm > target.maxSpm ? "over" : "in range",
    });
  }

  return flags.sort((a, b) => b.performedAt.getTime() - a.performedAt.getTime());
}

export type PlanDay = {
  day: string;
  weekday: number;
  name: string;
  planned: string[];
  logged: number;
  /** Nothing logged on a day the plan calls for work, and the day has already passed. */
  missed: boolean;
  isFuture: boolean;
  isToday: boolean;
};

/**
 * The week's plan against what was actually logged.
 *
 * Deliberately coarse: it reports *whether* a day has a session, never which planned item was
 * done. Nothing in the data links a logged workout to a line of the programme, and guessing
 * from the title would quietly mark a rest-day walk as "Team Land Practice · done".
 *
 * A future day is never "missed" — the most common way this kind of view becomes useless is
 * showing the whole week red on a Monday morning.
 */
export function weekReview(
  plan: PlannedDay[],
  loggedDays: string[],
  weekStart: string,
  today: string,
): PlanDay[] {
  const counts = new Map<string, number>();
  for (const day of loggedDays) counts.set(day, (counts.get(day) ?? 0) + 1);

  const byWeekday = new Map(plan.map((entry) => [entry.weekday, entry]));
  const out: PlanDay[] = [];

  for (let i = 0; i < 7; i += 1) {
    const date = new Date(`${weekStart}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + i);
    const day = date.toISOString().slice(0, 10);
    const weekday = date.getUTCDay();
    const entry = byWeekday.get(weekday);
    const logged = counts.get(day) ?? 0;
    const isFuture = day > today;

    out.push({
      day,
      weekday,
      name: entry?.name ?? WEEKDAY_NAMES[weekday],
      planned: entry?.items ?? [],
      logged,
      missed: !isFuture && logged === 0 && (entry?.items.length ?? 0) > 0,
      isFuture,
      isToday: day === today,
    });
  }

  return out;
}

const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
