import Papa from "papaparse";

/**
 * Hevy CSV import.
 *
 * Pure: no database, no filesystem. Everything hard about this format is decided here and
 * tested directly, so the import route is left with nothing but the insert.
 *
 * Three properties matter more than the rest:
 *
 * 1. A Hevy export is *cumulative* — every export contains the full history. Importing
 *    twice must therefore be a no-op, which is what `externalId` is for.
 * 2. Hevy exports in the account's own units. A kg export read as pounds turns a 100 kg
 *    squat into a 100 lb squat and quietly destroys the PR history, so units are resolved
 *    from the column names rather than assumed.
 * 3. Warmup sets are real rows. Counting them as working sets is harmless; counting them
 *    toward a PR is not, so `setType` is preserved rather than normalised away.
 */

const LBS_PER_KG = 2.2046226218;
const METRES_PER_MILE = 1609.344;

export type ParsedSet = {
  exercise: string;
  setIndex: number;
  setType: string;
  weightLbs: number | null;
  reps: number | null;
  distanceM: number | null;
  durationS: number | null;
  rpe: number | null;
};

export type ParsedWorkout = {
  externalId: string;
  performedAt: Date;
  title: string;
  notes: string;
  sets: ParsedSet[];
};

export type ImportPlan = {
  workouts: ParsedWorkout[];
  /** Human-readable problems. Never thrown: a bad row should not lose a good file. */
  errors: string[];
  rowsRead: number;
  rowsSkipped: number;
};

/** Blank, "-", and whitespace all mean "absent" in a Hevy export. */
function text(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value).trim();
  return s === "-" ? "" : s;
}

function num(value: unknown): number | null {
  const s = text(value);
  if (s === "") return null;
  // Reject "12abc" outright rather than letting parseFloat return 12.
  const parsed = Number(s.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function int(value: unknown): number | null {
  const parsed = num(value);
  return parsed === null ? null : Math.trunc(parsed);
}

/**
 * Hevy has used several date shapes across versions: ISO, "2025-01-01 10:30:00", and
 * "1 Jan 2025, 10:30". Rather than guess a locale, try the unambiguous forms and report
 * anything else — a misread date silently reorders someone's entire training history.
 */
export function parseHevyDate(raw: string): Date | null {
  const s = text(raw);
  if (s === "") return null;

  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (iso) {
    const [, y, mo, d, h, mi, sec] = iso;
    const date = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, sec ? +sec : 0));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const MONTHS = [
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec",
  ];
  const long = s.match(/^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4}),?\s+(\d{1,2}):(\d{2})/);
  if (long) {
    const [, d, monthName, y, h, mi] = long;
    const month = MONTHS.indexOf(monthName.slice(0, 3).toLowerCase());
    if (month === -1) return null;
    const date = new Date(Date.UTC(+y, month, +d, +h, +mi));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

/** Deterministic and stable across exports: the same session always yields the same id. */
export function workoutExternalId(performedAt: Date, title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `hevy:${performedAt.toISOString()}:${slug}`;
}

type Units = { weight: "lbs" | "kg" | null; distance: "miles" | "km" | "m" | null };

/** Units come from which column Hevy chose to emit, not from a setting we cannot see. */
export function detectUnits(headers: string[]): Units {
  const has = (name: string) => headers.some((h) => h.toLowerCase() === name);
  return {
    weight: has("weight_lbs") ? "lbs" : has("weight_kg") ? "kg" : null,
    distance: has("distance_miles")
      ? "miles"
      : has("distance_km")
        ? "km"
        : has("distance_meters")
          ? "m"
          : null,
  };
}

function toPounds(value: number | null, units: Units): number | null {
  if (value === null) return null;
  return units.weight === "kg" ? Math.round(value * LBS_PER_KG * 100) / 100 : value;
}

function toMetres(value: number | null, units: Units): number | null {
  if (value === null) return null;
  if (units.distance === "miles") return Math.round(value * METRES_PER_MILE * 100) / 100;
  if (units.distance === "km") return Math.round(value * 1000 * 100) / 100;
  return value;
}

function pick(row: Record<string, unknown>, ...names: string[]): unknown {
  for (const name of names) {
    if (row[name] !== undefined) return row[name];
  }
  return undefined;
}

export function parseHevyCsv(csv: string): ImportPlan {
  // Excel and Hevy both write a UTF-8 BOM; left in place it becomes part of the first
  // header name, so "title" arrives as "﻿title" and every lookup misses.
  const cleaned = csv.replace(/^﻿/, "");

  const result = Papa.parse<Record<string, unknown>>(cleaned, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  const errors: string[] = [];
  const headers = result.meta.fields ?? [];

  if (!headers.includes("exercise_title")) {
    return {
      workouts: [],
      errors: [
        `This does not look like a Hevy export: no "exercise_title" column. Found: ${
          headers.join(", ") || "no columns at all"
        }`,
      ],
      rowsRead: 0,
      rowsSkipped: 0,
    };
  }

  const units = detectUnits(headers);
  const rows = result.data;
  const byWorkout = new Map<string, ParsedWorkout>();
  let skipped = 0;

  rows.forEach((row, i) => {
    const startRaw = text(pick(row, "start_time", "date"));
    const performedAt = parseHevyDate(startRaw);
    if (!performedAt) {
      skipped += 1;
      // +2 rather than +1: row 1 of the file is the header, so this matches what a
      // spreadsheet shows when Victor goes looking for the offending line.
      if (errors.length < 10) {
        errors.push(`Row ${i + 2}: unreadable start_time ${JSON.stringify(startRaw)}`);
      }
      return;
    }

    const exercise = text(row["exercise_title"]);
    if (exercise === "") {
      skipped += 1;
      if (errors.length < 10) errors.push(`Row ${i + 2}: no exercise name`);
      return;
    }

    const title = text(row["title"]) || "Workout";
    const externalId = workoutExternalId(performedAt, title);

    let workout = byWorkout.get(externalId);
    if (!workout) {
      workout = {
        externalId,
        performedAt,
        title,
        notes: text(pick(row, "description", "workout_notes")),
        sets: [],
      };
      byWorkout.set(externalId, workout);
    }

    workout.sets.push({
      exercise,
      setIndex: int(row["set_index"]) ?? workout.sets.length,
      setType: text(row["set_type"]).toLowerCase() || "normal",
      weightLbs: toPounds(num(pick(row, "weight_lbs", "weight_kg")), units),
      reps: int(row["reps"]),
      distanceM: toMetres(
        num(pick(row, "distance_miles", "distance_km", "distance_meters")),
        units,
      ),
      durationS: int(pick(row, "duration_seconds", "duration_s")),
      rpe: num(row["rpe"]),
    });
  });

  const workouts = [...byWorkout.values()].sort(
    (a, b) => a.performedAt.getTime() - b.performedAt.getTime(),
  );

  if (result.errors.length > 0 && errors.length < 10) {
    errors.push(`CSV parser reported ${result.errors.length} malformed row(s).`);
  }

  return { workouts, errors, rowsRead: rows.length, rowsSkipped: skipped };
}
