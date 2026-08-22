import { z } from "zod";

/**
 * Form contracts for athletics.
 *
 * Kept out of the `"use server"` module because such a module may only export async
 * functions — exporting a schema or a constant from it is a build error, which is how
 * `GOAL_LABELS` ended up in `sprint-goals.ts`.
 */

export type ActionState = { ok: boolean; message: string; detail?: string[] };

/** A set as typed into the manual log. Everything optional except the exercise name. */
export const setInputSchema = z.object({
  exercise: z.string().trim().min(1, "Name the exercise."),
  weightLbs: z.number().positive().nullable(),
  reps: z.number().int().positive().nullable(),
  distanceM: z.number().positive().nullable(),
  durationS: z.number().int().positive().nullable(),
  /** Erg only. Without it stored on the set, the vault's SPM targets have nothing to check. */
  spm: z.number().int().positive().nullable(),
  setType: z.string().trim().default("normal"),
});

export type SetInput = z.infer<typeof setInputSchema>;

/** "" and absent both mean "not recorded" — never zero, which would be a real measurement. */
function optionalNumber(raw: FormDataEntryValue | null): number | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Accepts "2:17", "2:17.4", "137", or "18:50" and returns seconds. Erg monitors show
 * m:ss and typing that in is the natural thing to do, so the form must not demand seconds.
 */
export function parseTimeToSeconds(raw: string): number | null {
  const value = raw.trim();
  if (value === "") return null;

  const parts = value.split(":");
  if (parts.length > 3) return null;

  let seconds = 0;
  for (const part of parts) {
    // Reject "2:1a" rather than letting Number("1a") make it NaN and slip through as 0.
    if (!/^\d+(\.\d+)?$/.test(part.trim())) return null;
    seconds = seconds * 60 + Number(part);
  }

  return Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds) : null;
}

/** Metres from a number plus a unit selector, so the form can offer m / km / mi. */
export function parseDistanceToMetres(raw: string, unit: string): number | null {
  const value = Number(raw.trim());
  if (!Number.isFinite(value) || value <= 0) return null;
  if (unit === "km") return Math.round(value * 1000 * 100) / 100;
  if (unit === "mi") return Math.round(value * 1609.344 * 100) / 100;
  return Math.round(value * 100) / 100;
}

/**
 * Pulls the repeated set rows out of a FormData. The form posts parallel arrays
 * (`exercise[]`, `weight[]`, …) so a session with any number of sets is one submission.
 */
export function readSetsFromForm(formData: FormData): SetInput[] {
  const exercises = formData.getAll("exercise");
  const sets: SetInput[] = [];

  exercises.forEach((exercise, i) => {
    const name = typeof exercise === "string" ? exercise.trim() : "";
    if (name === "") return; // a blank row is how someone leaves a spare row unused

    const durationRaw = formData.getAll("duration")[i];
    const distanceRaw = formData.getAll("distance")[i];
    const unitRaw = formData.getAll("distanceUnit")[i];

    sets.push({
      exercise: name,
      weightLbs: optionalNumber(formData.getAll("weight")[i] ?? null),
      reps: optionalNumber(formData.getAll("reps")[i] ?? null),
      distanceM:
        typeof distanceRaw === "string"
          ? parseDistanceToMetres(distanceRaw, typeof unitRaw === "string" ? unitRaw : "m")
          : null,
      durationS: typeof durationRaw === "string" ? parseTimeToSeconds(durationRaw) : null,
      spm: optionalNumber(formData.getAll("spm")[i] ?? null),
      setType: (formData.getAll("setType")[i] as string) || "normal",
    });
  });

  return sets;
}
