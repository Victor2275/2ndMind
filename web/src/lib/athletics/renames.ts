/**
 * The v1 → v2 catalogue rename map (V4 Phase 2++ Stage 3).
 *
 * ## Why this file exists at all
 *
 * `workout_sets.exercise` is free text, not a foreign key — every logged set, every PR, every
 * Hevy import points at a *name*. Renaming the catalogue therefore means rewriting history, and
 * this is the map that does it: every one of the 164 names `catalogue-v1.names.json` pinned,
 * matched to where it lands in the ~140-entry v2 catalogue.
 *
 * ## Total, on purpose
 *
 * Every v1 name has exactly one entry here, including the (in this map, zero) cases where a name
 * would not have changed — `renames.test.ts` checks totality against the frozen fixture rather
 * than assuming an unlisted name needs nothing done. A name silently falling through would mean
 * `scripts/rename-exercises.mts` leaves it untouched forever, which is a quieter failure than a
 * crash: the catalogue looks migrated and one movement's history just never moved.
 *
 * ## `distanceM` / `durationS` / `pieceType`
 *
 * The collapsed erg and water entries are where these matter. `Erg 2000m` becomes `Row (Erg)` —
 * one name, many distances — and the distance that used to be *in the name* has to go somewhere,
 * or a 2k and a 5k become indistinguishable the moment the rename runs. It goes onto every set
 * being renamed, in the set's own `distance_m`/`duration_s`/`piece_type` columns (Stage 2). This
 * is the last moment that information exists as a fact about the *name* rather than the *set* —
 * after this runs, `Erg 2000m` does not exist to derive it from again.
 *
 * `pieceType` carries what `set_type` deliberately does not — see its column doc in `schema.ts`.
 */

export type Rename = {
  from: string;
  to: string;
  distanceM?: number;
  durationS?: number;
  pieceType?: string;
};

const MARATHON_M = 21_097;

export const RENAMES: Rename[] = [
  // ---------------------------------------------------------------- barbell, lower
  { from: "Back Squat", to: "Back Squat (Barbell)" },
  { from: "Front Squat", to: "Front Squat (Barbell)" },
  { from: "Box Squat", to: "Box Squat (Barbell)" },
  { from: "Pause Squat", to: "Pause Squat (Barbell)" },
  { from: "Deadlift", to: "Deadlift (Barbell)" },
  { from: "Sumo Deadlift", to: "Sumo Deadlift (Barbell)" },
  { from: "Romanian Deadlift", to: "Romanian Deadlift (Barbell)" },
  { from: "Deficit Deadlift", to: "Deficit Deadlift (Barbell)" },
  { from: "Rack Pull", to: "Rack Pull (Barbell)" },
  { from: "Good Morning", to: "Good Morning (Barbell)" },
  { from: "Hip Thrust", to: "Hip Thrust (Barbell)" },
  { from: "Barbell Lunge", to: "Lunge (Barbell)" },
  { from: "Barbell Step Up", to: "Step Up (Barbell)" },
  // Calf Raise ×5 → 4: this is the one that merges into the bodyweight entry below, since
  // "Standing Calf Raise" and "Calf Raise" (bodyweight) were the same movement differing only
  // in whether a machine was loading it — equipment is the sole difference, so they collapse.
  { from: "Barbell Calf Raise", to: "Calf Raise (Barbell)" },

  // ---------------------------------------------------------------- barbell, upper
  { from: "Bench Press", to: "Bench Press (Barbell)" },
  { from: "Incline Bench Press", to: "Incline Bench Press (Barbell)" },
  { from: "Decline Bench Press", to: "Decline Bench Press (Barbell)" },
  { from: "Close Grip Bench Press", to: "Close Grip Bench Press (Barbell)" },
  { from: "Paused Bench Press", to: "Paused Bench Press (Barbell)" },
  { from: "Overhead Press", to: "Overhead Press (Barbell)" },
  { from: "Push Press", to: "Push Press (Barbell)" },
  { from: "Barbell Row", to: "Row (Barbell)" },
  { from: "Pendlay Row", to: "Pendlay Row (Barbell)" },
  { from: "Barbell Shrug", to: "Shrug (Barbell)" },
  { from: "Barbell Curl", to: "Bicep Curl (Barbell)" },
  { from: "EZ Bar Curl", to: "EZ Bar Curl (Barbell)" },
  // Skullcrusher ×2 renamed, not collapsed — barbell and dumbbell stay distinct movements.
  { from: "Skullcrusher", to: "Skullcrusher (Barbell)" },
  { from: "Barbell Upright Row", to: "Upright Row (Barbell)" },

  // ---------------------------------------------------------------- olympic
  { from: "Power Clean", to: "Power Clean (Barbell)" },
  { from: "Hang Clean", to: "Hang Clean (Barbell)" },
  { from: "Clean and Jerk", to: "Clean and Jerk (Barbell)" },
  { from: "Snatch", to: "Snatch (Barbell)" },
  { from: "Power Snatch", to: "Power Snatch (Barbell)" },
  { from: "Clean Pull", to: "Clean Pull (Barbell)" },
  { from: "High Pull", to: "High Pull (Barbell)" },

  // ---------------------------------------------------------------- dumbbell
  { from: "Dumbbell Bench Press", to: "Bench Press (Dumbbell)" },
  { from: "Incline Dumbbell Press", to: "Incline Bench Press (Dumbbell)" },
  { from: "Dumbbell Fly", to: "Fly (Dumbbell)" },
  { from: "Dumbbell Shoulder Press", to: "Shoulder Press (Dumbbell)" },
  { from: "Arnold Press", to: "Arnold Press (Dumbbell)" },
  { from: "Lateral Raise", to: "Lateral Raise (Dumbbell)" },
  { from: "Front Raise", to: "Front Raise (Dumbbell)" },
  { from: "Rear Delt Fly", to: "Rear Delt Fly (Dumbbell)" },
  { from: "Dumbbell Row", to: "Row (Dumbbell)" },
  { from: "Chest Supported Row", to: "Chest Supported Row (Dumbbell)" },
  { from: "Dumbbell Curl", to: "Bicep Curl (Dumbbell)" },
  { from: "Hammer Curl", to: "Hammer Curl (Dumbbell)" },
  { from: "Incline Dumbbell Curl", to: "Incline Bicep Curl (Dumbbell)" },
  { from: "Concentration Curl", to: "Concentration Curl (Dumbbell)" },
  { from: "Dumbbell Skullcrusher", to: "Skullcrusher (Dumbbell)" },
  { from: "Overhead Dumbbell Extension", to: "Overhead Extension (Dumbbell)" },
  { from: "Dumbbell Shrug", to: "Shrug (Dumbbell)" },
  { from: "Goblet Squat", to: "Goblet Squat (Dumbbell)" },
  { from: "Dumbbell Romanian Deadlift", to: "Romanian Deadlift (Dumbbell)" },
  { from: "Dumbbell Lunge", to: "Lunge (Dumbbell)" },
  { from: "Bulgarian Split Squat", to: "Bulgarian Split Squat (Dumbbell)" },
  { from: "Dumbbell Step Up", to: "Step Up (Dumbbell)" },
  { from: "Farmer's Carry", to: "Farmer's Carry (Dumbbell)" },
  { from: "Dumbbell Calf Raise", to: "Calf Raise (Dumbbell)" },

  // ---------------------------------------------------------------- cable and machine
  { from: "Lat Pulldown", to: "Lat Pulldown (Cable)" },
  { from: "Close Grip Pulldown", to: "Close Grip Pulldown (Cable)" },
  { from: "Seated Cable Row", to: "Row (Cable)" },
  { from: "Straight Arm Pulldown", to: "Straight Arm Pulldown (Cable)" },
  { from: "Cable Fly", to: "Fly (Cable)" },
  { from: "Cable Lateral Raise", to: "Lateral Raise (Cable)" },
  { from: "Face Pull", to: "Face Pull (Cable)" },
  { from: "Triceps Pushdown", to: "Triceps Pushdown (Cable)" },
  { from: "Rope Pushdown", to: "Rope Pushdown (Cable)" },
  { from: "Cable Curl", to: "Bicep Curl (Cable)" },
  { from: "Cable Crunch", to: "Crunch (Cable)" },
  { from: "Leg Press", to: "Leg Press (Machine)" },
  { from: "Hack Squat", to: "Hack Squat (Machine)" },
  { from: "Leg Extension", to: "Leg Extension (Machine)" },
  { from: "Lying Leg Curl", to: "Leg Curl (Lying)" },
  { from: "Seated Leg Curl", to: "Leg Curl (Seated)" },
  // Kept separate from the standing/bodyweight merge below — soleus vs. gastrocnemius emphasis
  // is a real difference in what the exercise trains, not just which equipment is under it.
  { from: "Seated Calf Raise", to: "Calf Raise (Seated)" },
  { from: "Standing Calf Raise", to: "Calf Raise (Standing)" },
  { from: "Chest Press Machine", to: "Chest Press (Machine)" },
  { from: "Shoulder Press Machine", to: "Shoulder Press (Machine)" },
  { from: "Pec Deck", to: "Pec Deck (Machine)" },
  { from: "Machine Row", to: "Row (Machine)" },
  { from: "Assisted Pull Up", to: "Assisted Pull Up (Machine)" },
  { from: "Back Extension", to: "Back Extension (Machine)" },
  { from: "Hip Abduction", to: "Hip Abduction (Machine)" },
  { from: "Hip Adduction", to: "Hip Adduction (Machine)" },

  // ---------------------------------------------------------------- bodyweight
  { from: "Pull Up", to: "Pull Up (Bodyweight)" },
  { from: "Chin Up", to: "Chin Up (Bodyweight)" },
  { from: "Wide Grip Pull Up", to: "Wide Grip Pull Up (Bodyweight)" },
  { from: "Push Up", to: "Push Up (Bodyweight)" },
  { from: "Diamond Push Up", to: "Diamond Push Up (Bodyweight)" },
  { from: "Dip", to: "Dip (Bodyweight)" },
  { from: "Inverted Row", to: "Inverted Row (Bodyweight)" },
  { from: "Pistol Squat", to: "Pistol Squat (Bodyweight)" },
  { from: "Nordic Curl", to: "Nordic Curl (Bodyweight)" },
  { from: "Glute Bridge", to: "Glute Bridge (Bodyweight)" },
  { from: "Plank", to: "Plank (Bodyweight)" },
  { from: "Side Plank", to: "Side Plank (Bodyweight)" },
  { from: "Hanging Leg Raise", to: "Hanging Leg Raise (Bodyweight)" },
  { from: "Hollow Hold", to: "Hollow Hold (Bodyweight)" },
  { from: "Dead Bug", to: "Dead Bug (Bodyweight)" },
  { from: "Bird Dog", to: "Bird Dog (Bodyweight)" },
  { from: "Russian Twist", to: "Russian Twist (Bodyweight)" },
  { from: "Sit Up", to: "Sit Up (Bodyweight)" },
  { from: "Crunch", to: "Crunch (Bodyweight)" },
  { from: "Mountain Climber", to: "Mountain Climber (Bodyweight)" },
  { from: "Burpee", to: "Burpee (Bodyweight)" },
  { from: "Jump Squat", to: "Jump Squat (Bodyweight)" },
  { from: "Box Jump", to: "Box Jump (Bodyweight)" },
  { from: "Broad Jump", to: "Broad Jump (Bodyweight)" },
  // The other half of the Calf Raise ×5 → 4 merge — see "Standing Calf Raise" above.
  { from: "Calf Raise", to: "Calf Raise (Standing)" },

  // ---------------------------------------------------------------- dragon boat specific
  { from: "Cable Paddle Pull", to: "Paddle Pull (Cable)" },
  { from: "Single Arm Cable Row", to: "Single Arm Row (Cable)" },
  { from: "Landmine Rotation", to: "Landmine Rotation (Barbell)" },
  { from: "Pallof Press", to: "Pallof Press (Cable)" },
  { from: "Medicine Ball Slam", to: "Medicine Ball Slam (Other)" },
  { from: "Medicine Ball Rotational Throw", to: "Medicine Ball Rotational Throw (Other)" },
  { from: "Kettlebell Swing", to: "Kettlebell Swing (Kettlebell)" },
  { from: "Turkish Get Up", to: "Turkish Get Up (Kettlebell)" },
  { from: "Renegade Row", to: "Renegade Row (Dumbbell)" },

  // ---------------------------------------------------------------- erg: 22 rows -> 3
  //
  // 18 of the 22 were the same movement — an erg piece — with the distance or duration encoded
  // in the name. Collapsed to one `Row (Erg)`, with that distance/duration moved onto the set.
  // SkiErg and BikeErg are not a rowing stroke, so they collapse separately into their own name
  // rather than into `Row (Erg)`, which is what the original catalogue already got right.
  { from: "Erg 500m", to: "Row (Erg)", distanceM: 500 },
  { from: "Erg 1000m", to: "Row (Erg)", distanceM: 1000 },
  { from: "Erg 2000m", to: "Row (Erg)", distanceM: 2000 },
  { from: "Erg 5000m", to: "Row (Erg)", distanceM: 5000 },
  { from: "Erg 6000m", to: "Row (Erg)", distanceM: 6000 },
  { from: "Erg 10000m", to: "Row (Erg)", distanceM: 10_000 },
  { from: "Erg Half Marathon", to: "Row (Erg)", distanceM: MARATHON_M },
  { from: "Erg 1 Minute", to: "Row (Erg)", durationS: 60 },
  { from: "Erg 4 Minutes", to: "Row (Erg)", durationS: 240 },
  { from: "Erg 20 Minutes", to: "Row (Erg)", durationS: 1200 },
  { from: "Erg 30 Minutes", to: "Row (Erg)", durationS: 1800 },
  { from: "Erg 60 Minutes", to: "Row (Erg)", durationS: 3600 },
  { from: "Erg Intervals 250m", to: "Row (Erg)", distanceM: 250, pieceType: "interval" },
  { from: "Erg Intervals 500m", to: "Row (Erg)", distanceM: 500, pieceType: "interval" },
  { from: "Erg Intervals 750m", to: "Row (Erg)", distanceM: 750, pieceType: "interval" },
  { from: "Erg Intervals 1000m", to: "Row (Erg)", distanceM: 1000, pieceType: "interval" },
  { from: "Erg Steady State", to: "Row (Erg)", pieceType: "steady" },
  { from: "Erg Warmup", to: "Row (Erg)", pieceType: "warmup" },
  { from: "SkiErg 500m", to: "Ski Erg (Erg)", distanceM: 500 },
  { from: "SkiErg 1000m", to: "Ski Erg (Erg)", distanceM: 1000 },
  { from: "BikeErg 2000m", to: "Bike Erg (Erg)", distanceM: 2000 },
  { from: "BikeErg 5000m", to: "Bike Erg (Erg)", distanceM: 5000 },

  // ---------------------------------------------------------------- water: 9 rows -> 4
  //
  // The six distance/style paddle entries were one movement at different distances or paces —
  // the same shape as the erg collapse. Starts, Race Piece and Technical Paddle are not: they
  // are different *work* at the same or unknown distance, which is exactly what the new
  // `piece_type` column exists to carry without inventing three more names for it — but since
  // those three already had their own names pre-rename, they keep them rather than folding into
  // `Paddle (Boat)`, per Victor's answer that only the sole-equipment-difference cases collapse.
  { from: "Paddle 250m", to: "Paddle (Boat)", distanceM: 250 },
  { from: "Paddle 500m", to: "Paddle (Boat)", distanceM: 500 },
  { from: "Paddle 1000m", to: "Paddle (Boat)", distanceM: 1000 },
  { from: "Paddle 2000m", to: "Paddle (Boat)", distanceM: 2000 },
  { from: "Paddle Steady State", to: "Paddle (Boat)", pieceType: "steady" },
  { from: "Paddle Intervals", to: "Paddle (Boat)", pieceType: "interval" },
  { from: "Starts", to: "Starts (Boat)" },
  { from: "Race Piece", to: "Race Piece (Boat)" },
  { from: "Technical Paddle", to: "Technical Paddle (Boat)" },

  // ---------------------------------------------------------------- conditioning
  { from: "Run", to: "Run (Outdoor)" },
  { from: "Treadmill Run", to: "Run (Treadmill)" },
  { from: "Sprint Intervals", to: "Sprint Intervals (Outdoor)" },
  { from: "Hill Sprints", to: "Hill Sprints (Outdoor)" },
  { from: "Stair Climb", to: "Stair Climb (Machine)" },
  { from: "Cycling", to: "Cycling (Outdoor)" },
  { from: "Swim", to: "Swim (Pool)" },
  { from: "Jump Rope", to: "Jump Rope (Other)" },
  { from: "Sled Push", to: "Sled Push (Sled)" },
  { from: "Sled Drag", to: "Sled Drag (Sled)" },
  { from: "Battle Ropes", to: "Battle Ropes (Other)" },
  // Nothing is loaded, so there is no equipment to put in parentheses — bare names stay bare.
  { from: "Mobility", to: "Mobility" },
  { from: "Stretching", to: "Stretching" },
  { from: "Foam Rolling", to: "Foam Rolling" },
];

/** Every v2 name a v1 name lands on — used by `catalogue.ts` to assert nothing is orphaned. */
export const RENAME_TARGETS = new Set(RENAMES.map((r) => r.to));

/**
 * `renames.ts` ships in the client bundle too. `localCatalogue` (`lib/athletics/local.ts`) reads
 * this to normalize a v1 string at read time — a phone on a cached pre-rename build would
 * otherwise write new history under a dead name *after* the one-shot server-side rewrite has
 * already run. A plain lookup, not the full `Rename` shape: the client only ever needs "what do
 * I call this now", never the distance/duration migration, which is a one-time server-side act.
 */
export const RENAME_MAP: ReadonlyMap<string, string> = new Map(RENAMES.map((r) => [r.from, r.to]));

/** `v1 name -> v2 name`, or the name unchanged if it was never a v1 catalogue name at all — a
 *  Hevy import or a hand-typed entry the rename was never going to touch. */
export function normalizeExerciseName(name: string): string {
  return RENAME_MAP.get(name) ?? name;
}
