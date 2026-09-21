"use server";

import { revalidatePath } from "next/cache";

import {
  MAX_WEIGHT_LBS,
  MIN_WEIGHT_LBS,
  readSetsFromForm,
  type ActionState,
} from "@/lib/athletics/forms";
import { parseHevyCsv } from "@/lib/athletics/hevy";
import {
  clearPlanOverride,
  deleteWorkout,
  importWorkouts,
  logWorkout,
  recordBodyweight,
  setPlanOverride,
  toggleRehab,
} from "@/lib/athletics/queries";
import type { SessionType } from "@/lib/athletics/challenge";
import { requireSession } from "@/lib/auth/dal";
import { db, isDatabaseConfigured } from "@/lib/db/client";
import { describeDbError } from "@/lib/db/describe";

/**
 * Athletics write actions.
 *
 * Same rule as the vault actions: `requireSession()` first, every time. A Server Action is
 * a POST endpoint with a guessable id, so sitting behind a protected page protects nothing.
 * Training data is health data — the one category of this vault that must never leak.
 */

/** Hevy exports are a few hundred KB; a 5 MB ceiling is generous and bounds memory. */
const MAX_CSV_BYTES = 5 * 1024 * 1024;

const describe = (error: unknown) => describeDbError(error, { subject: "The athletics tables" });

function requireDatabase(): ActionState | null {
  return isDatabaseConfigured()
    ? null
    : {
        ok: false,
        message: "DATABASE_URL is not set, so there is nowhere to save this.",
      };
}

export async function importHevyCsv(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  await requireSession();

  const missing = requireDatabase();
  if (missing) return missing;

  const file = formData.get("csv");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Choose a CSV export first." };
  }
  if (file.size > MAX_CSV_BYTES) {
    return {
      ok: false,
      message: `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB, over the 5 MB limit.`,
    };
  }

  try {
    const plan = parseHevyCsv(await file.text());

    // No workouts and errors means the file was wrong; report that rather than "imported 0".
    if (plan.workouts.length === 0) {
      return {
        ok: false,
        message: "Nothing importable in that file.",
        detail: plan.errors.slice(0, 5),
      };
    }

    const result = await importWorkouts(db(), plan.workouts);

    revalidatePath("/private/athletics");

    // Skipped is the normal case on a re-import, so it is stated plainly rather than as a
    // warning — the whole point is that importing twice is safe.
    const parts = [`${result.insertedWorkouts} new session(s), ${result.insertedSets} sets`];
    if (result.skippedWorkouts > 0) {
      parts.push(`${result.skippedWorkouts} already stored and left alone`);
    }
    if (plan.rowsSkipped > 0) parts.push(`${plan.rowsSkipped} row(s) unreadable`);

    return { ok: true, message: parts.join(" · "), detail: plan.errors.slice(0, 5) };
  } catch (error) {
    return { ok: false, message: describe(error) };
  }
}

export async function logWorkoutAction(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  await requireSession();

  const missing = requireDatabase();
  if (missing) return missing;

  const dateRaw = formData.get("performedOn");
  const date = typeof dateRaw === "string" ? dateRaw.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, message: "Pick a date." };
  }

  const sets = readSetsFromForm(formData);
  if (sets.length === 0) {
    return { ok: false, message: "Add at least one set with an exercise name." };
  }

  try {
    // Noon UTC, not midnight: a midnight timestamp rendered in a timezone behind UTC shows
    // as the previous day, which would misdate every session Victor logs.
    const performedAt = new Date(`${date}T12:00:00Z`);

    await logWorkout(db(), {
      performedAt,
      title: String(formData.get("title") ?? "").trim() || "Session",
      notes: String(formData.get("notes") ?? "").trim(),
      sets: sets.map((s, i) => ({
        exercise: s.exercise,
        setIndex: i,
        setType: s.setType,
        weightLbs: s.weightLbs,
        reps: s.reps,
        distanceM: s.distanceM,
        durationS: s.durationS,
        // The column is an integer; a typed "72.5" would otherwise be rejected by Postgres
        // rather than by the form, which is the wrong place to find out.
        spm: s.spm === null ? null : Math.round(s.spm),
      })),
    });

    revalidatePath("/private/athletics");
    return { ok: true, message: `Logged ${sets.length} set(s) for ${date}.` };
  } catch (error) {
    return { ok: false, message: describe(error) };
  }
}

export async function deleteWorkoutAction(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  await requireSession();

  const missing = requireDatabase();
  if (missing) return missing;

  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return { ok: false, message: "That workout id makes no sense." };
  }

  try {
    await deleteWorkout(db(), id);
    revalidatePath("/private/athletics");
    return { ok: true, message: "Deleted, along with its sets." };
  } catch (error) {
    return { ok: false, message: describe(error) };
  }
}

/**
 * A bodyweight reading.
 *
 * Health data, and the one field Victor named as never publishable — so the same
 * `requireSession()` rule applies here as everywhere else in this module, and no public
 * route imports anything that can reach this table.
 *
 * The bounds are a typo guard, not a judgement: 700 catches a mis-keyed "2150", 50 catches a
 * kilogram entered into a pounds field.
 */

export async function recordBodyweightAction(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  await requireSession();

  const missing = requireDatabase();
  if (missing) return missing;

  const day = String(formData.get("measuredOn") ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return { ok: false, message: "Pick the day this was measured." };
  }

  const weight = Number(String(formData.get("weightLbs") ?? "").trim());
  if (!Number.isFinite(weight) || weight < MIN_WEIGHT_LBS || weight > MAX_WEIGHT_LBS) {
    return {
      ok: false,
      message: `A weight in pounds, between ${MIN_WEIGHT_LBS} and ${MAX_WEIGHT_LBS}.`,
    };
  }

  try {
    await recordBodyweight(db(), {
      measuredOn: day,
      weightLbs: Math.round(weight * 100) / 100,
      note: String(formData.get("note") ?? "").trim(),
    });

    revalidatePath("/private/athletics");
    return { ok: true, message: `Recorded ${weight} lb for ${day}.` };
  } catch (error) {
    return { ok: false, message: describe(error) };
  }
}

/**
 * Ticks one rehab item for one day.
 *
 * The day is posted with the form rather than read from the server clock. The clock is UTC,
 * so from 5pm in Los Angeles onward `new Date()` is already tomorrow there — which would file
 * every evening's rehab under the wrong day. The posted value is the Los Angeles day the page
 * was rendered for, which is also what the user was looking at when they tapped.
 */
export async function toggleRehabAction(formData: FormData): Promise<void> {
  await requireSession();
  if (!isDatabaseConfigured()) return;

  const day = String(formData.get("day") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || slug === "") return;

  await toggleRehab(db(), day, slug);
  revalidatePath("/private/athletics");
  revalidatePath("/private");
}

/* ------------------------------------------------------- challenge plan overrides */

/**
 * The hard ceiling on a planned day, in metres.
 *
 * A typo guard, not a judgement — the plan's own largest day is the 100k. 250,000 catches a
 * mis-keyed "100000" that gained a zero, and 0 is allowed because a genuine rest day is a
 * legitimate edit.
 */
const MAX_PLANNED_M = 250_000;

const SESSION_TYPES = [
  "base",
  "long",
  "quality",
  "strength",
  "water",
  "recovery",
  "test",
  "race",
  "epic",
];

/**
 * Changes one day of the challenge plan (D-276).
 *
 * The vault file is **not** rewritten. This writes a `plan_overrides` row, which
 * `applyOverrides` merges over the parsed plan on read — so the original stays visible beside
 * the change and reverting is one click.
 *
 * An empty field means "leave the vault's value", which is why every column is nullable and
 * why the form ships the vault's text as the placeholder rather than as the value: a
 * pre-filled input that is submitted unchanged would write a copy of the plan as an override
 * and badge an untouched day as edited.
 */
export async function savePlanDayAction(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  await requireSession();

  const missing = requireDatabase();
  if (missing) return missing;

  const day = String(formData.get("day") ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return { ok: false, message: "That day makes no sense." };
  }

  const type = String(formData.get("type") ?? "").trim();
  if (type !== "" && !SESSION_TYPES.includes(type)) {
    return { ok: false, message: `"${type}" is not one of the nine session types.` };
  }

  const metersRaw = String(formData.get("meters") ?? "").trim();
  let meters: number | null = null;
  if (metersRaw !== "") {
    const parsed = Number(metersRaw.replace(/[, ]/g, ""));
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > MAX_PLANNED_M) {
      return { ok: false, message: `A distance in metres, between 0 and ${MAX_PLANNED_M}.` };
    }
    meters = Math.round(parsed);
  }

  const name = String(formData.get("name") ?? "").trim();
  const detail = String(formData.get("detail") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();

  // Nothing filled in is a revert, not an empty override. Writing a row of nulls would leave a
  // day looking unchanged while carrying a row that the next edit would silently build on.
  if (name === "" && detail === "" && type === "" && meters === null && note === "") {
    try {
      await clearPlanOverride(db(), day);
      revalidatePath("/private/athletics/plan");
      revalidatePath("/private/athletics");
      revalidatePath("/private/athletics/log");
      revalidatePath("/private");
      return { ok: true, message: `${day} is back to the plan.` };
    } catch (error) {
      return { ok: false, message: describe(error) };
    }
  }

  try {
    await setPlanOverride(db(), {
      date: day,
      name: name === "" ? null : name,
      detail: detail === "" ? null : detail,
      type: type === "" ? null : (type as SessionType),
      meters,
      note,
    });

    revalidatePath("/private/athletics/plan");
    revalidatePath("/private/athletics");
    revalidatePath("/private/athletics/log");
    revalidatePath("/private");

    return { ok: true, message: `${day} changed.` };
  } catch (error) {
    return { ok: false, message: describe(error) };
  }
}

/** Drops one day's override, returning it to the vault's plan. */
export async function revertPlanDayAction(formData: FormData): Promise<void> {
  await requireSession();
  if (!isDatabaseConfigured()) return;

  const day = String(formData.get("day") ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return;

  await clearPlanOverride(db(), day);
  revalidatePath("/private/athletics/plan");
  revalidatePath("/private/athletics");
  revalidatePath("/private/athletics/log");
  revalidatePath("/private");
}
