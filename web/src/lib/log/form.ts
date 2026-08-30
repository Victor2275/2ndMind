import { parseDistanceToMetres, parseTimeToSeconds } from "@/lib/athletics/forms";
import { SCALE_MAX, SCALE_MIN, type Field } from "@/lib/log/categories";

/**
 * Form-value coercion for log entries.
 *
 * A plain module, not part of `app/private/log/actions.ts`, for two reasons. A `"use server"`
 * module may only export async functions — exporting this from there is a build error, not a
 * lint nit (AGENTS.md rule 4). And this is the half of the write path with branching worth
 * testing: the action itself is session check, insert, revalidate.
 */

/** Reads one field out of the form, converting to the type the category declared. */
export function readField(formData: FormData, field: Field): unknown {
  const raw = formData.get(field.name);

  if (field.type === "bool") return formData.get(field.name) === "on";
  if (typeof raw !== "string") return null;

  const value = raw.trim();
  if (value === "") return null;

  switch (field.type) {
    case "number": {
      const parsed = Number(value);
      // Reject "12abc" rather than letting a partial parse through as 12.
      return Number.isFinite(parsed) ? parsed : null;
    }
    case "scale": {
      // The form only ever submits 1-5, but a Server Action is a POST endpoint with a
      // guessable id, so the range is enforced here rather than trusted from the client.
      //
      // Out of range is dropped, not clamped. Clamping a 9 to a 5 would put a value in the
      // series that nobody chose, and the whole reason these fields exist is to be plotted —
      // a fabricated point is worse than a missing one.
      const parsed = Number(value);
      if (!Number.isInteger(parsed)) return null;
      return parsed >= SCALE_MIN && parsed <= SCALE_MAX ? parsed : null;
    }
    case "duration":
      // Accepts "2:17" as an erg monitor shows it, or bare seconds.
      return parseTimeToSeconds(value);
    case "distance": {
      const unit = String(formData.get(`${field.name}Unit`) ?? "m");
      return parseDistanceToMetres(value, unit);
    }
    default:
      return value;
  }
}
