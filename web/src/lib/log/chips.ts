import { categoryByKey, chipFields, type Category, type Field } from "@/lib/log/categories";

/**
 * Recent values, offered as one-tap chips (V3 §1.6, D-155).
 *
 * The slow part of a training log is not deciding what to write, it is typing "Romanian
 * Deadlift" one-handed at a rack. A chip makes that one tap — and because a repeat set is
 * usually a repeat of the same numbers, the chip brings last time's weight and reps with it.
 *
 * **The chip prints what it will fill in.** That is the whole reason measurements may travel
 * this way when they may not be sticky (`categories.ts`): tapping "Bench Press · 185 × 5" is
 * a choice about a visible number, where a silently pre-filled 185 would be a number in the
 * log that nobody chose. Same data, and the difference between a convenience and a lie.
 *
 * Pure: entries in, chips out. The query that fetches the entries lives in `queries.ts`.
 */

export type Chip = {
  /** The value for the chip's own field. */
  value: string;
  /** Printed on the chip — the value plus whatever it carries. */
  label: string;
  /** Every form field this chip fills, already in the shape the input expects. */
  fills: Record<string, string>;
};

export type ChipSource = { category: string; data: Record<string, unknown> };

/** Chips per field name, for one category. */
export type ChipSets = Record<string, Chip[]>;

/** How many fit on one row of a 360px phone without wrapping to a third line. */
export const MAX_CHIPS = 6;

function seconds(value: number): string {
  const whole = Math.round(value);
  const minutes = Math.floor(whole / 60);
  return `${minutes}:${String(whole % 60).padStart(2, "0")}`;
}

/**
 * One carried value, in the form the input wants back.
 *
 * Durations are stored in seconds and shown as `m:ss`; distances are stored in metres and the
 * form's unit select already defaults to metres. Anything filled in in the wrong shape would
 * be re-parsed on save and silently change value — 7:12 becoming 432 seconds is fine, 432
 * going back in as "432" and being read as 7 minutes 12 is not.
 */
function fillValue(field: Field | undefined, raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === "" || raw === false) return null;
  if (field?.type === "duration" && typeof raw === "number") return seconds(raw);
  if (typeof raw === "number") return String(raw);
  if (typeof raw === "string") return raw;
  return null;
}

/** The same value, shortened for the chip's face. */
function displayValue(field: Field | undefined, raw: unknown): string | null {
  const value = fillValue(field, raw);
  if (value === null) return null;
  if (field?.type === "distance") return `${value}m`;
  return value;
}

export function chipsFor(
  category: Category,
  field: Field,
  entries: readonly ChipSource[],
  limit = MAX_CHIPS,
): Chip[] {
  const carried = (field.carries ?? [])
    .map((name) => category.fields.find((f) => f.name === name))
    .filter((f): f is Field => f !== undefined);

  const chips: Chip[] = [];
  const seen = new Set<string>();

  for (const entry of entries) {
    if (entry.category !== category.key) continue;

    const raw = entry.data[field.name];
    if (typeof raw !== "string") continue;
    const value = raw.trim();
    if (value === "") continue;

    // Case-insensitively, so "bench press" and "Bench Press" are one chip and the most recent
    // spelling wins. Two chips differing only in capitals would waste a third of the row.
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const fills: Record<string, string> = { [field.name]: value };
    const shown: string[] = [];
    const shownNames: string[] = [];

    for (const other of carried) {
      const filled = fillValue(other, entry.data[other.name]);
      if (filled === null) continue;
      fills[other.name] = filled;
      const display = displayValue(other, entry.data[other.name]);
      if (display !== null) {
        shown.push(display);
        shownNames.push(other.name);
      }
    }

    // "185 × 5" reads as a set; "185 · 5" reads as two unrelated numbers. Only weight-and-reps
    // gets the ×, and only when both are actually present — keying this off the *declared*
    // carries instead rendered an erg piece as "2000m × 7:12", which is not a multiplication
    // of anything.
    const isSet = shownNames.length === 2 && shownNames.join() === "weightLbs,reps";
    const numbers = shown.join(isSet ? " × " : " · ");

    chips.push({ value, fills, label: numbers ? `${value} · ${numbers}` : value });
    if (chips.length >= limit) break;
  }

  return chips;
}

/** Every chip set a category needs, keyed by field name. */
export function chipSetsFor(category: Category, entries: readonly ChipSource[]): ChipSets {
  const sets: ChipSets = {};
  for (const field of chipFields(category)) {
    const chips = chipsFor(category, field, entries);
    if (chips.length > 0) sets[field.name] = chips;
  }
  return sets;
}

/** Chip sets for every category at once, which is what the page hands the form. */
export function allChipSets(entries: readonly ChipSource[]): Record<string, ChipSets> {
  const byCategory: Record<string, ChipSets> = {};
  for (const key of new Set(entries.map((e) => e.category))) {
    const category = categoryByKey(key);
    if (!category) continue;
    const sets = chipSetsFor(category, entries);
    if (Object.keys(sets).length > 0) byCategory[key] = sets;
  }
  return byCategory;
}
