/**
 * The muscle vocabulary, split out of `catalogue.ts` (V4 Phase 2++, Stage 1).
 *
 * ## Why this moved
 *
 * `catalogue.ts` is rewritten wholesale in Stage 3 of Phase 2++ — new names, a `seedKey`, a
 * primary/secondary split. The vocabulary these names are drawn from is not part of that
 * rewrite; it is consumed by the figure (`muscle-map.tsx`), by the exercise browser's grouping
 * and filters, and by the AI-suggest route, none of which should have to change when the
 * catalogue's *entries* change. Splitting it out means Stage 1 (the figure) ships before Stage 3
 * (the rename) exists.
 *
 * ## Why the list grew from 15 to 21
 *
 * The old vocabulary was a grouping key with a diagram pencilled in against it — fine detail for
 * "chest and triceps, or chest and shoulders?", too coarse for a diagram that means to look
 * anatomical. Three splits and four additions, scoped by Victor's answer of 2026-09-09:
 *
 * - `core` splits into `abs` and `obliques` — a sit-up and a Russian twist are not the same
 *   region, and the reference image draws them separately.
 * - `shoulders` sheds `rear delts` — the posterior head reads on a back view; drawing it as
 *   "shoulders" again (which the old `BACK` map did, with the identical path front and back) is
 *   the anatomical error this split fixes.
 * - `rotator cuff`, `adductors`, `abductors` and `hip flexors` are added outright — small,
 *   specific regions the old 15-word list had no room for and the reference image draws.
 *
 * `core` is kept as a **legacy synonym**: Stage 1 ships against the catalogue's existing flat
 * `muscles` array, which still says `"core"` on every entry that used to. It expands to both
 * `abs` and `obliques` when drawn (see `expandLegacy` in `muscle-map.tsx`) so nothing goes dark.
 * Stage 3 re-tags the catalogue by hand and retires it.
 */

/** The regions the figure can draw, plus the `full body` sentinel and the `core` legacy synonym. */
export const MUSCLES = [
  "chest",
  "back",
  "lats",
  "traps",
  "shoulders",
  "rear delts",
  "rotator cuff",
  "biceps",
  "triceps",
  "forearms",
  "abs",
  "obliques",
  "lower back",
  "glutes",
  "quads",
  "hamstrings",
  "adductors",
  "abductors",
  "hip flexors",
  "calves",
  "full body",
  /** @deprecated Legacy synonym for `abs` + `obliques`. Retired in Phase 2++ Stage 3. */
  "core",
] as const;

export type Muscle = (typeof MUSCLES)[number];

/** The muscle names a person actually picks from — `full body` and the `core` synonym excluded. */
export const REGIONS = MUSCLES.filter(
  (m): m is Exclude<Muscle, "full body" | "core"> => m !== "full body" && m !== "core",
);

/** Hevy-style coarse grouping, for the exercise browser's sticky section headers and filters. */
export const GROUPS = [
  "Chest",
  "Back",
  "Shoulders",
  "Arms",
  "Core",
  "Glutes",
  "Legs",
  "Full Body",
] as const;

export type MuscleGroup = (typeof GROUPS)[number];

/** Every drawable region's coarse group. Exhaustive — a test asserts every `REGIONS` entry appears. */
export const GROUP_FOR: Record<Exclude<Muscle, "full body" | "core">, MuscleGroup> = {
  chest: "Chest",
  back: "Back",
  lats: "Back",
  traps: "Back",
  "lower back": "Back",
  shoulders: "Shoulders",
  "rear delts": "Shoulders",
  "rotator cuff": "Shoulders",
  biceps: "Arms",
  triceps: "Arms",
  forearms: "Arms",
  abs: "Core",
  obliques: "Core",
  glutes: "Glutes",
  quads: "Legs",
  hamstrings: "Legs",
  adductors: "Legs",
  abductors: "Legs",
  "hip flexors": "Legs",
  calves: "Legs",
};

/**
 * The closed equipment vocabulary (Victor's answer: closed, not free text).
 *
 * `""` is not in this list — the three loaded-nothing conditioning entries (mobility, stretching,
 * foam rolling) use it today and are folded into `"other"` in Stage 3's rewrite.
 */
/**
 * `exercises.primary_group`, derived rather than stored input — `apply.ts` calls this at write
 * time so the column can never drift from the muscles it is grouping by. The first recognised
 * name in `primaryMuscles` wins; an exercise with none (an unedited legacy row, or one whose
 * only muscle is the `full body` sentinel, which has no single group) gets `null`, which the
 * browser reads as "ungrouped" rather than guessing.
 */
export function primaryGroupOf(primaryMuscles: readonly string[]): MuscleGroup | null {
  const groupFor = GROUP_FOR as Record<string, MuscleGroup | undefined>;
  for (const muscle of primaryMuscles) {
    const group = groupFor[muscle];
    if (group) return group;
  }
  return null;
}

export const EQUIPMENT = [
  "barbell",
  "dumbbell",
  "kettlebell",
  "cable",
  "machine",
  "bodyweight",
  "erg",
  "boat",
  "sled",
  "outdoor",
  "pool",
  "other",
] as const;

export type Equipment = (typeof EQUIPMENT)[number];
