"use server";

import { revalidatePath } from "next/cache";

import { readSetsFromForm, type ActionState } from "@/lib/athletics/forms";
import { parseHevyCsv } from "@/lib/athletics/hevy";
import { deleteWorkout, importWorkouts, logWorkout } from "@/lib/athletics/queries";
import { requireSession } from "@/lib/auth/dal";
import { db, isDatabaseConfigured } from "@/lib/db/client";

/**
 * Athletics write actions.
 *
 * Same rule as the vault actions: `requireSession()` first, every time. A Server Action is
 * a POST endpoint with a guessable id, so sitting behind a protected page protects nothing.
 * Training data is health data — the one category of this vault that must never leak.
 */

/** Hevy exports are a few hundred KB; a 5 MB ceiling is generous and bounds memory. */
const MAX_CSV_BYTES = 5 * 1024 * 1024;

function describe(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("DATABASE_URL")) return message;
  if (message.includes("relation") && message.includes("does not exist")) {
    return "The athletics tables are missing. Run `npm run db:migrate` against the database.";
  }
  return message;
}

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
