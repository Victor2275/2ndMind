/**
 * The exercise catalogue's seed (V4 Phase 2.1).
 *
 * ## Why this is a file and not a fixture in the database
 *
 * The phone mirrors this table so fuzzy search works with no signal, and the seed has to be
 * identical on both sides — so it is written once, here, and `scripts/seed-exercises.mjs`
 * inserts it. A list typed straight into a migration would be invisible to the client bundle
 * and would need a second copy.
 *
 * ## Why it is curated rather than derived
 *
 * The obvious move was to seed from the exercise names already in the database. Measured on
 * 2026-09-08: **one distinct name**, because training has been logged as free text through the
 * quick log rather than as sessions. Deriving from history would have produced a catalogue with
 * one row in it, so the seed is authored — about 150 movements chosen to cover what a barbell,
 * dumbbell, machine and erg session actually contains, at a size that can be read through and
 * corrected rather than trusted.
 *
 * ## `modality` is the load-bearing field
 *
 * It decides what the session form asks for. A lift wants weight and reps; an erg piece wants
 * distance, duration and a stroke rate; water work wants distance and duration. Asking for all
 * five every time is exactly what made the old form slow, and Q392 asks for three taps per set.
 *
 * ## What `muscles` turned into
 *
 * It was a grouping key with a diagram pencilled in against it. Phase 2.9 built that diagram —
 * `components/site/muscle-map.tsx` — and it reads this array directly, which is why the closed
 * vocabulary below matters more than it did: a typo here is now a body region that never lights
 * up rather than a group with one member. The demonstration clips 2.10 asked for are **not**
 * here and will not be: there is no lawfully reusable set of them, so Victor's call was a written
 * description instead, which lives in `how-to.ts`.
 */

/** What the session form should ask for. */
export type Modality = "lift" | "erg" | "water" | "conditioning";

export type CatalogueEntry = {
  name: string;
  modality: Modality;
  /** Primary movers, lowercase. Empty where the idea does not apply. */
  muscles: string[];
  /** How it is loaded, for grouping and for the eventual diagrams. */
  equipment: string;
};

/**
 * Muscle names are a closed list on purpose.
 *
 * Free text here would give "quads", "quadriceps" and "Quads" as three groups the moment
 * anything tried to group by them — and the diagrams this is a hook for need to map a name to a
 * region. A test asserts every entry below uses one of these.
 */
export const MUSCLES = [
  "chest",
  "back",
  "lats",
  "traps",
  "shoulders",
  "biceps",
  "triceps",
  "forearms",
  "quads",
  "hamstrings",
  "glutes",
  "calves",
  "core",
  "lower back",
  "full body",
] as const;

export type Muscle = (typeof MUSCLES)[number];

const lift = (name: string, equipment: string, ...muscles: Muscle[]): CatalogueEntry => ({
  name,
  modality: "lift",
  muscles,
  equipment,
});

/**
 * Erg, water and conditioning entries carry muscles too, as of Phase 2.9.
 *
 * They used to be empty, with the note "empty for erg and conditioning, where it means little".
 * That was true while `muscles` was only a grouping key. It stopped being true the moment the
 * body map read the same field: an empty array renders a figure with nothing lit, which does not
 * say "this is a whole-body piece", it says "we do not know" — and for a 2k, which is the single
 * most demanding thing in this catalogue, that is the wrong answer on the screen.
 *
 * The three genuinely empty ones are mobility, stretching and foam rolling, where nothing is
 * being loaded and the blank figure is the honest picture.
 */
const ROWING: Muscle[] = ["quads", "glutes", "back", "lats", "core"];
const PADDLING: Muscle[] = ["lats", "back", "core", "shoulders"];

const erg = (name: string, ...muscles: Muscle[]): CatalogueEntry => ({
  name,
  modality: "erg",
  muscles: muscles.length > 0 ? muscles : ROWING,
  equipment: "machine-erg",
});

const water = (name: string, ...muscles: Muscle[]): CatalogueEntry => ({
  name,
  modality: "water",
  muscles: muscles.length > 0 ? muscles : PADDLING,
  equipment: "boat",
});

const conditioning = (name: string, equipment = "", ...muscles: Muscle[]): CatalogueEntry => ({
  name,
  modality: "conditioning",
  muscles,
  equipment,
});

export const CATALOGUE: CatalogueEntry[] = [
  // ---------------------------------------------------------------- barbell, lower
  lift("Back Squat", "barbell", "quads", "glutes"),
  lift("Front Squat", "barbell", "quads", "core"),
  lift("Box Squat", "barbell", "quads", "glutes"),
  lift("Pause Squat", "barbell", "quads", "glutes"),
  lift("Deadlift", "barbell", "hamstrings", "glutes", "lower back"),
  lift("Sumo Deadlift", "barbell", "glutes", "quads", "lower back"),
  lift("Romanian Deadlift", "barbell", "hamstrings", "glutes"),
  lift("Deficit Deadlift", "barbell", "hamstrings", "lower back"),
  lift("Rack Pull", "barbell", "back", "lower back"),
  lift("Good Morning", "barbell", "hamstrings", "lower back"),
  lift("Hip Thrust", "barbell", "glutes", "hamstrings"),
  lift("Barbell Lunge", "barbell", "quads", "glutes"),
  lift("Barbell Step Up", "barbell", "quads", "glutes"),
  lift("Barbell Calf Raise", "barbell", "calves"),

  // ---------------------------------------------------------------- barbell, upper
  lift("Bench Press", "barbell", "chest", "triceps"),
  lift("Incline Bench Press", "barbell", "chest", "shoulders"),
  lift("Decline Bench Press", "barbell", "chest", "triceps"),
  lift("Close Grip Bench Press", "barbell", "triceps", "chest"),
  lift("Paused Bench Press", "barbell", "chest", "triceps"),
  lift("Overhead Press", "barbell", "shoulders", "triceps"),
  lift("Push Press", "barbell", "shoulders", "triceps"),
  lift("Barbell Row", "barbell", "back", "lats"),
  lift("Pendlay Row", "barbell", "back", "lats"),
  lift("Barbell Shrug", "barbell", "traps"),
  lift("Barbell Curl", "barbell", "biceps"),
  lift("EZ Bar Curl", "barbell", "biceps"),
  lift("Skullcrusher", "barbell", "triceps"),
  lift("Barbell Upright Row", "barbell", "shoulders", "traps"),

  // ---------------------------------------------------------------- olympic
  lift("Power Clean", "barbell", "full body"),
  lift("Hang Clean", "barbell", "full body"),
  lift("Clean and Jerk", "barbell", "full body"),
  lift("Snatch", "barbell", "full body"),
  lift("Power Snatch", "barbell", "full body"),
  lift("Clean Pull", "barbell", "back", "hamstrings"),
  lift("High Pull", "barbell", "traps", "shoulders"),

  // ---------------------------------------------------------------- dumbbell
  lift("Dumbbell Bench Press", "dumbbell", "chest", "triceps"),
  lift("Incline Dumbbell Press", "dumbbell", "chest", "shoulders"),
  lift("Dumbbell Fly", "dumbbell", "chest"),
  lift("Dumbbell Shoulder Press", "dumbbell", "shoulders", "triceps"),
  lift("Arnold Press", "dumbbell", "shoulders"),
  lift("Lateral Raise", "dumbbell", "shoulders"),
  lift("Front Raise", "dumbbell", "shoulders"),
  lift("Rear Delt Fly", "dumbbell", "shoulders", "back"),
  lift("Dumbbell Row", "dumbbell", "back", "lats"),
  lift("Chest Supported Row", "dumbbell", "back", "lats"),
  lift("Dumbbell Curl", "dumbbell", "biceps"),
  lift("Hammer Curl", "dumbbell", "biceps", "forearms"),
  lift("Incline Dumbbell Curl", "dumbbell", "biceps"),
  lift("Concentration Curl", "dumbbell", "biceps"),
  lift("Dumbbell Skullcrusher", "dumbbell", "triceps"),
  lift("Overhead Dumbbell Extension", "dumbbell", "triceps"),
  lift("Dumbbell Shrug", "dumbbell", "traps"),
  lift("Goblet Squat", "dumbbell", "quads", "glutes"),
  lift("Dumbbell Romanian Deadlift", "dumbbell", "hamstrings", "glutes"),
  lift("Dumbbell Lunge", "dumbbell", "quads", "glutes"),
  lift("Bulgarian Split Squat", "dumbbell", "quads", "glutes"),
  lift("Dumbbell Step Up", "dumbbell", "quads", "glutes"),
  lift("Farmer's Carry", "dumbbell", "forearms", "core"),
  lift("Dumbbell Calf Raise", "dumbbell", "calves"),

  // ---------------------------------------------------------------- machine and cable
  lift("Lat Pulldown", "cable", "lats", "biceps"),
  lift("Close Grip Pulldown", "cable", "lats", "biceps"),
  lift("Seated Cable Row", "cable", "back", "lats"),
  lift("Straight Arm Pulldown", "cable", "lats"),
  lift("Cable Fly", "cable", "chest"),
  lift("Cable Lateral Raise", "cable", "shoulders"),
  lift("Face Pull", "cable", "shoulders", "traps"),
  lift("Triceps Pushdown", "cable", "triceps"),
  lift("Rope Pushdown", "cable", "triceps"),
  lift("Cable Curl", "cable", "biceps"),
  lift("Cable Crunch", "cable", "core"),
  lift("Leg Press", "machine", "quads", "glutes"),
  lift("Hack Squat", "machine", "quads"),
  lift("Leg Extension", "machine", "quads"),
  lift("Lying Leg Curl", "machine", "hamstrings"),
  lift("Seated Leg Curl", "machine", "hamstrings"),
  lift("Seated Calf Raise", "machine", "calves"),
  lift("Standing Calf Raise", "machine", "calves"),
  lift("Chest Press Machine", "machine", "chest", "triceps"),
  lift("Shoulder Press Machine", "machine", "shoulders"),
  lift("Pec Deck", "machine", "chest"),
  lift("Machine Row", "machine", "back", "lats"),
  lift("Assisted Pull Up", "machine", "lats", "biceps"),
  lift("Back Extension", "machine", "lower back", "glutes"),
  lift("Hip Abduction", "machine", "glutes"),
  lift("Hip Adduction", "machine", "quads"),

  // ---------------------------------------------------------------- bodyweight
  lift("Pull Up", "bodyweight", "lats", "biceps"),
  lift("Chin Up", "bodyweight", "lats", "biceps"),
  lift("Wide Grip Pull Up", "bodyweight", "lats"),
  lift("Push Up", "bodyweight", "chest", "triceps"),
  lift("Diamond Push Up", "bodyweight", "triceps", "chest"),
  lift("Dip", "bodyweight", "triceps", "chest"),
  lift("Inverted Row", "bodyweight", "back", "lats"),
  lift("Pistol Squat", "bodyweight", "quads", "glutes"),
  lift("Nordic Curl", "bodyweight", "hamstrings"),
  lift("Glute Bridge", "bodyweight", "glutes"),
  lift("Plank", "bodyweight", "core"),
  lift("Side Plank", "bodyweight", "core"),
  lift("Hanging Leg Raise", "bodyweight", "core"),
  lift("Hollow Hold", "bodyweight", "core"),
  lift("Dead Bug", "bodyweight", "core"),
  lift("Bird Dog", "bodyweight", "core", "lower back"),
  lift("Russian Twist", "bodyweight", "core"),
  lift("Sit Up", "bodyweight", "core"),
  lift("Crunch", "bodyweight", "core"),
  lift("Mountain Climber", "bodyweight", "core"),
  lift("Burpee", "bodyweight", "full body"),
  lift("Jump Squat", "bodyweight", "quads", "glutes"),
  lift("Box Jump", "bodyweight", "quads", "calves"),
  lift("Broad Jump", "bodyweight", "quads", "glutes"),
  lift("Calf Raise", "bodyweight", "calves"),

  // ---------------------------------------------------------------- dragon boat specific
  lift("Cable Paddle Pull", "cable", "lats", "core"),
  lift("Single Arm Cable Row", "cable", "lats", "core"),
  lift("Landmine Rotation", "barbell", "core"),
  lift("Pallof Press", "cable", "core"),
  lift("Medicine Ball Slam", "other", "core", "full body"),
  lift("Medicine Ball Rotational Throw", "other", "core"),
  lift("Kettlebell Swing", "kettlebell", "glutes", "hamstrings"),
  lift("Turkish Get Up", "kettlebell", "full body"),
  lift("Renegade Row", "dumbbell", "back", "core"),

  // ---------------------------------------------------------------- erg pieces
  //
  // Named by the piece rather than the machine, because that is how a session is written down
  // and how a PR is compared: "2k" is a record, "Concept2" is not.
  erg("Erg 500m"),
  erg("Erg 1000m"),
  erg("Erg 2000m"),
  erg("Erg 5000m"),
  erg("Erg 6000m"),
  erg("Erg 10000m"),
  erg("Erg Half Marathon"),
  erg("Erg 1 Minute"),
  erg("Erg 4 Minutes"),
  erg("Erg 20 Minutes"),
  erg("Erg 30 Minutes"),
  erg("Erg 60 Minutes"),
  erg("Erg Intervals 250m"),
  erg("Erg Intervals 500m"),
  erg("Erg Intervals 750m"),
  erg("Erg Intervals 1000m"),
  erg("Erg Steady State"),
  erg("Erg Warmup"),
  // The two that are not a rowing stroke, and so do not take the default.
  erg("SkiErg 500m", "lats", "triceps", "core", "shoulders"),
  erg("SkiErg 1000m", "lats", "triceps", "core", "shoulders"),
  erg("BikeErg 2000m", "quads", "glutes", "calves"),
  erg("BikeErg 5000m", "quads", "glutes", "calves"),

  // ---------------------------------------------------------------- on the water
  water("Paddle 250m"),
  water("Paddle 500m"),
  water("Paddle 1000m"),
  water("Paddle 2000m"),
  water("Paddle Steady State"),
  water("Paddle Intervals"),
  water("Starts"),
  water("Race Piece"),
  water("Technical Paddle"),

  // ---------------------------------------------------------------- conditioning
  conditioning("Run", "outdoor", "quads", "hamstrings", "calves"),
  conditioning("Treadmill Run", "machine", "quads", "hamstrings", "calves"),
  conditioning("Sprint Intervals", "outdoor", "hamstrings", "quads", "glutes"),
  conditioning("Hill Sprints", "outdoor", "quads", "glutes", "calves"),
  conditioning("Stair Climb", "machine", "quads", "glutes", "calves"),
  conditioning("Cycling", "outdoor", "quads", "glutes", "calves"),
  conditioning("Swim", "pool", "lats", "shoulders", "back", "core"),
  conditioning("Jump Rope", "", "calves"),
  conditioning("Sled Push", "sled", "quads", "glutes", "calves"),
  conditioning("Sled Drag", "sled", "quads", "glutes", "hamstrings"),
  conditioning("Battle Ropes", "", "shoulders", "forearms", "core"),
  // Nothing is being loaded, so the figure stays blank rather than guessing.
  conditioning("Mobility"),
  conditioning("Stretching"),
  conditioning("Foam Rolling"),
];
