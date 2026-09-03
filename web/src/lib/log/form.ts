import {
  MAX_WEIGHT_LBS,
  MIN_WEIGHT_LBS,
  parseDistanceToMetres,
  parseTimeToSeconds,
} from "@/lib/athletics/forms";
import { SCALE_MAX, SCALE_MIN, type Field, type RowGroup } from "@/lib/log/categories";

/**
 * Form-value coercion for log entries.
 *
 * A plain module, not part of `app/private/log/actions.ts`, for two reasons. A `"use server"`
 * module may only export async functions — exporting this from there is a build error, not a
 * lint nit (AGENTS.md rule 4). And this is the half of the write path with branching worth
 * testing: the action itself is session check, insert, revalidate.
 */

/**
 * Reads one field out of the form, converting to the type the category declared.
 *
 * `prefix` is how a repeated row addresses its own copy of a field: the second set's weight
 * posts as `sets.1.weightLbs`. Every branch below reads through it, including the distance
 * unit — a row whose unit select was found under the un-prefixed name would take row zero's
 * unit, and 500 metres would silently become 500 miles.
 */
export function readField(formData: FormData, field: Field, prefix = ""): unknown {
  const key = `${prefix}${field.name}`;
  const raw = formData.get(key);

  if (field.type === "bool") return raw === "on";
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
      const unit = String(formData.get(`${key}Unit`) ?? "m");
      return parseDistanceToMetres(value, unit);
    }
    default:
      return value;
  }
}

/**
 * Takes the weigh-in out of an entry's data, if there is one (D-159).
 *
 * **Mutates `data`.** That is the point: bodyweight is the second input to every
 * bodyweight-adjusted erg split, so a copy of it sitting in a log entry's JSON is a number
 * that can disagree with the chart, and the two would be reconciled by hand or not at all. It
 * goes to `bodyweight_entries` and nowhere else.
 *
 * A rejected weight does not reject the entry. He is standing at a rack; losing three sets
 * because a decimal point went in the wrong place would be the wrong trade.
 */
export function takeBodyweight(data: Record<string, unknown>): {
  weight: number | null;
  problem: string | null;
} {
  const raw = data.bodyweightLbs;
  delete data.bodyweightLbs;

  if (raw === null || raw === undefined || raw === "") return { weight: null, problem: null };
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return { weight: null, problem: "That bodyweight is not a number, so it was not recorded." };
  }
  if (raw < MIN_WEIGHT_LBS || raw > MAX_WEIGHT_LBS) {
    return {
      weight: null,
      problem: `A bodyweight has to be between ${MIN_WEIGHT_LBS} and ${MAX_WEIGHT_LBS} lb, so it was not recorded.`,
    };
  }

  // Two decimals, matching `recordBodyweightAction`. A scale reads to a tenth; the rest is a
  // floating-point artefact that would render as 178.30000000000001.
  return { weight: Math.round(raw * 100) / 100, problem: null };
}

/**
 * Reads the repeated rows — the sets.
 *
 * Blank rows are dropped rather than stored as empty objects, which is what makes it safe for
 * the form to render a spare row: tapping "add set" and not using it costs nothing. The
 * indexes are read from the form rather than counted, because removing the middle row leaves
 * a gap and a loop that stopped at the first missing index would silently drop everything
 * after it.
 *
 * Capped at `group.max`. A Server Action is a POST endpoint with a guessable id, so a
 * thousand rows is something the server refuses rather than something the form declines to
 * offer.
 */
export function readRows(formData: FormData, group: RowGroup): Record<string, unknown>[] {
  const indexes = new Set<number>();
  for (const key of formData.keys()) {
    const match = key.match(new RegExp(`^${group.name}\\.(\\d+)\\.`));
    if (match) indexes.add(Number(match[1]));
  }

  const rows: Record<string, unknown>[] = [];
  for (const index of [...indexes].sort((a, b) => a - b)) {
    const row: Record<string, unknown> = {};
    for (const field of group.fields) {
      const value = readField(formData, field, `${group.name}.${index}.`);
      if (value !== null && value !== false) row[field.name] = value;
    }

    // A row holding only its `setType` default is an empty row with a select in it.
    const meaningful = Object.keys(row).filter((name) => name !== "setType");
    if (meaningful.length > 0) rows.push(row);
    if (rows.length >= group.max) break;
  }

  return rows;
}
