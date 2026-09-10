/**
 * The exercise catalogue's seed — rewritten wholesale for V4 Phase 2++ Stage 3.
 *
 * ## What changed, and why this is a rewrite rather than an edit
 *
 * Victor's audit, 2026-09-09: "2k erg and 5k erg both exist, which doesn't make sense." The real
 * shape of the problem was worse than the example — 31 of the original 164 rows were a distance
 * or duration parameter encoded in a name string, with an empty `distance_m` column sitting right
 * beside it doing nothing. Three things changed to fix that, and none of them can be done as a
 * patch over the old list:
 *
 * 1. **Naming becomes Hevy's `Movement (Equipment)`**, applied to every row, not just the ones
 *    that collapsed. A closed equipment vocabulary (`lib/athletics/muscles.ts`) makes the second
 *    half of that mean something consistent rather than fourteen free-text spellings of the same
 *    four words.
 * 2. **The erg and water pieces collapse.** 22 erg rows become 3 (`Row (Erg)`, `Ski Erg (Erg)`,
 *    `Bike Erg (Erg)`); 9 water rows become 4. The distance or duration that used to live in the
 *    name now lives on the *set* (`workout_sets.distance_m`/`duration_s`, already there since
 *    Phase 2) — Stage 2's `piece_type` carries the ones that were never a distance at all
 *    (`"steady"`, `"interval"`, `"warmup"`). `prs.ts` already buckets erg records by exercise
 *    *and* rounded distance (`Math.round(distanceM / 100) * 100`), so per-distance PRs survive
 *    the collapse for free.
 * 3. **Every entry gets a `seedKey`** — the identity Stage 3's rename keys on instead of `name`,
 *    so a future rename does not have to migrate history a second time.
 *
 * See `renames.ts` for the full v1 → v2 map and the one-time migration it drives, and
 * `scripts/rename-exercises.mts` for the script that applies it to logged history. This file is
 * the *destination* of that migration — the catalogue as it exists after the rename, which is
 * also the catalogue a fresh seed writes on day one.
 *
 * ## Primary and secondary muscles, and `aliases`
 *
 * Split for the redrawn figure (Stage 1) — a prime mover in `--primary`, an assist in the
 * lighter ramp step. `aliases` is derived automatically from `renames.ts` rather than hand-typed:
 * every v1 name that used to point here is folded in as an alias, so searching "Barbell Curl"
 * still finds "Bicep Curl (Barbell)" and searching "2k" still has a shot at "Row (Erg)". That
 * also means aliases cannot drift from the rename map — there is only one place that association
 * is written down.
 *
 * ## `howTo` — folded in from the deleted `how-to.ts`
 *
 * D-223's argument for text over a demonstration clip is unchanged; what moved is *where* the
 * text lives. It was a static map keyed by name, which meant an edit was a code change and a
 * rename broke the link silently. It is a column now (`exercises.how_to`), seeded from here,
 * editable from the exercise detail page (Stage 4) like everything else about a row. About a
 * third of the descriptions below are new rather than moved — a collapsed erg entry no longer
 * describes one distance, so its text had to stop being about one.
 */

/**
 * Relative imports, not `@/lib/...` — deliberately, and only in this file. `scripts/seed-
 * exercises.mts` and `scripts/rename-exercises.mts` import `CATALOGUE` under plain `node`, with
 * no bundler and no path-alias resolution, so anything this module imports has to resolve the
 * same way. `muscles.ts` and `renames.ts` are both leaf modules with no imports of their own, so
 * this is the only place the constraint bites.
 */
import type { Equipment, Muscle } from "./muscles.ts";
import { RENAMES } from "./renames.ts";

export { MUSCLES, type Muscle } from "./muscles.ts";

/** What the session form should ask for. */
export type Modality = "lift" | "erg" | "water" | "conditioning";

export type CatalogueEntry = {
  /**
   * The identity Stage 3's rename — and every rename after it — keys on instead of `name`.
   * Null for a row nobody seeded: one typed on the phone, or one the AI-add path proposed.
   */
  seedKey: string | null;
  name: string;
  modality: Modality;
  equipment: Equipment;
  /** Prime movers. Empty for the three conditioning entries that load nothing. */
  primaryMuscles: Muscle[];
  /** Assisting muscles — the figure's lighter, secondary highlight. Often empty. */
  secondaryMuscles: Muscle[];
  /** Names this movement used to be called, folded in from `renames.ts` — see the module doc. */
  aliases: string[];
  /** Setup, execution, common error, in two sentences. */
  howTo: string;
  /**
   * Which fields a person has edited by hand. Always empty on a bundle entry — the seed is never
   * "edited", it is authored — and read from the mirrored row's real column when this shape
   * comes from `localCatalogue`. `mergeCatalogue` (`session-logger.tsx`) is the reader that
   * matters: it is what tells the bundle not to clobber an edit on reload.
   */
  userEditedFields: string[];
};

/** Back-compat view some callers still want: the union of primary and secondary, unranked. */
export function allMuscles(entry: CatalogueEntry): Muscle[] {
  return [...entry.primaryMuscles, ...entry.secondaryMuscles];
}

const ALIASES_BY_NAME = new Map<string, string[]>();
for (const r of RENAMES) {
  if (r.from === r.to) continue;
  const list = ALIASES_BY_NAME.get(r.to) ?? [];
  if (!list.includes(r.from)) list.push(r.from);
  ALIASES_BY_NAME.set(r.to, list);
}
function aliasesFor(name: string): string[] {
  return ALIASES_BY_NAME.get(name) ?? [];
}

function lift(
  seedKey: string,
  name: string,
  equipment: Equipment,
  primary: Muscle[],
  secondary: Muscle[],
  howTo: string,
): CatalogueEntry {
  return {
    seedKey,
    name,
    modality: "lift",
    equipment,
    primaryMuscles: primary,
    secondaryMuscles: secondary,
    aliases: aliasesFor(name),
    userEditedFields: [],
    howTo,
  };
}

function erg(
  seedKey: string,
  name: string,
  primary: Muscle[],
  secondary: Muscle[],
  howTo: string,
): CatalogueEntry {
  return {
    seedKey,
    name,
    modality: "erg",
    equipment: "erg",
    primaryMuscles: primary,
    secondaryMuscles: secondary,
    aliases: aliasesFor(name),
    userEditedFields: [],
    howTo,
  };
}

function water(
  seedKey: string,
  name: string,
  primary: Muscle[],
  secondary: Muscle[],
  howTo: string,
): CatalogueEntry {
  return {
    seedKey,
    name,
    modality: "water",
    equipment: "boat",
    primaryMuscles: primary,
    secondaryMuscles: secondary,
    aliases: aliasesFor(name),
    userEditedFields: [],
    howTo,
  };
}

function conditioning(
  seedKey: string,
  name: string,
  equipment: Equipment,
  primary: Muscle[],
  secondary: Muscle[],
  howTo: string,
): CatalogueEntry {
  return {
    seedKey,
    name,
    modality: "conditioning",
    equipment,
    primaryMuscles: primary,
    secondaryMuscles: secondary,
    aliases: aliasesFor(name),
    userEditedFields: [],
    howTo,
  };
}

export const CATALOGUE: CatalogueEntry[] = [
  // ---------------------------------------------------------------- barbell, lower
  lift(
    "back-squat",
    "Back Squat (Barbell)",
    "barbell",
    ["quads"],
    ["glutes"],
    "Bar across your traps, feet about shoulder-width with the toes turned slightly out. Brace, sit down between your hips until the crease of the hip passes the knee, and drive up — the usual fault is the knees collapsing inward out of the hole.",
  ),
  lift(
    "front-squat",
    "Front Squat (Barbell)",
    "barbell",
    ["quads"],
    ["abs"],
    "Bar in the front rack across the delts, elbows high and pointed forward. Squat straight down with a vertical torso; the moment the elbows drop, the bar rolls forward and the rep turns into a good morning.",
  ),
  lift(
    "box-squat",
    "Box Squat (Barbell)",
    "barbell",
    ["quads"],
    ["glutes"],
    "Set a box at or just below parallel and squat back onto it, sitting rather than dropping. Pause without rocking, then drive up — bouncing off the box removes the whole point of it.",
  ),
  lift(
    "pause-squat",
    "Pause Squat (Barbell)",
    "barbell",
    ["quads"],
    ["glutes"],
    "A back squat held two to three seconds at the bottom with the brace intact. Stay tight through the pause; letting the air out at the bottom is what makes the ascent collapse.",
  ),
  lift(
    "deadlift",
    "Deadlift (Barbell)",
    "barbell",
    ["hamstrings"],
    ["glutes", "lower back"],
    "Bar over mid-foot, shins to the bar, chest up and lats set. Push the floor away and let the bar drag up your legs — the common error is hips shooting up first, which turns it into a stiff-legged pull.",
  ),
  lift(
    "sumo-deadlift",
    "Sumo Deadlift (Barbell)",
    "barbell",
    ["glutes"],
    ["quads", "lower back"],
    "Wide stance, hands inside the knees, toes turned out and knees tracking over them. Push the knees out as you drive the floor away; letting them cave in kills the leverage the wide stance bought.",
  ),
  lift(
    "romanian-deadlift",
    "Romanian Deadlift (Barbell)",
    "barbell",
    ["hamstrings"],
    ["glutes"],
    "Start standing, soften the knees, and push the hips straight back with the bar against your thighs. Stop when the hamstrings stop lengthening rather than when the bar reaches the floor.",
  ),
  lift(
    "deficit-deadlift",
    "Deficit Deadlift (Barbell)",
    "barbell",
    ["hamstrings"],
    ["lower back"],
    "A deadlift standing on a 1–2 inch platform, so the pull starts lower. Only useful if you can still reach the start position with a flat back — otherwise it trains the rounded position.",
  ),
  lift(
    "rack-pull",
    "Rack Pull (Barbell)",
    "barbell",
    ["back"],
    ["lower back"],
    "Bar set on pins at or just below the knee. Pull from a dead stop with the lats engaged; do not bounce it off the pins between reps.",
  ),
  lift(
    "good-morning",
    "Good Morning (Barbell)",
    "barbell",
    ["hamstrings"],
    ["lower back"],
    "Bar on the back as in a squat, soft knees, hips pushed back until the torso is near parallel. Keep the spine rigid — this is a hip hinge, not a back extension, and it is loaded lighter than it looks.",
  ),
  lift(
    "hip-thrust",
    "Hip Thrust (Barbell)",
    "barbell",
    ["glutes"],
    ["hamstrings"],
    "Shoulder blades on a bench, bar across the hips on a pad, feet flat and shins vertical at the top. Squeeze the glutes to full lockout and keep the ribs down; arching the lower back fakes the range.",
  ),
  lift(
    "lunge-barbell",
    "Lunge (Barbell)",
    "barbell",
    ["quads"],
    ["glutes"],
    "Bar on the back, step forward and drop the rear knee to just above the floor. Keep the front shin near vertical and push back through the front heel.",
  ),
  lift(
    "step-up-barbell",
    "Step Up (Barbell)",
    "barbell",
    ["quads"],
    ["glutes"],
    "Bar on the back, plant the whole front foot on a box at knee height and stand up through it. Do not push off the trailing foot — that turns it into an assisted rep.",
  ),
  lift(
    "calf-raise-barbell",
    "Calf Raise (Barbell)",
    "barbell",
    ["calves"],
    [],
    "Bar on the back, balls of the feet on a plate or step, heels hanging. Rise to full plantar flexion and lower under control through a full stretch; speed here removes the range.",
  ),

  // ---------------------------------------------------------------- barbell, upper
  lift(
    "bench-press",
    "Bench Press (Barbell)",
    "barbell",
    ["chest"],
    ["triceps"],
    "Shoulder blades pulled together and down, feet planted, bar over the mid-chest. Lower to touch and press back over the shoulders — flaring the elbows straight out is what makes this hurt.",
  ),
  lift(
    "incline-bench-press",
    "Incline Bench Press (Barbell)",
    "barbell",
    ["chest"],
    ["shoulders"],
    "Bench at 30–45°, bar to the upper chest just below the collarbone. Higher than 45° and it stops being a chest press and becomes a shoulder press.",
  ),
  lift(
    "decline-bench-press",
    "Decline Bench Press (Barbell)",
    "barbell",
    ["chest"],
    ["triceps"],
    "Bench declined 15–30°, bar to the lower chest. Get set before unracking; the decline makes an unracked bar much harder to control.",
  ),
  lift(
    "close-grip-bench-press",
    "Close Grip Bench Press (Barbell)",
    "barbell",
    ["triceps"],
    ["chest"],
    "Hands about shoulder-width, elbows tucked to roughly 30° from the ribs. Not narrower — a grip inside shoulder-width loads the wrists rather than the triceps.",
  ),
  lift(
    "paused-bench-press",
    "Paused Bench Press (Barbell)",
    "barbell",
    ["chest"],
    ["triceps"],
    "A bench press with a one to two second pause on the chest, no sinking and no bounce. The pause is the point: it removes the stretch reflex and shows what you can actually press.",
  ),
  lift(
    "overhead-press",
    "Overhead Press (Barbell)",
    "barbell",
    ["shoulders"],
    ["triceps"],
    "Bar on the front delts, elbows slightly in front, glutes and abs braced. Move the head back to let the bar pass, then push it overhead and shrug at the top; leaning back is a lower-back exercise.",
  ),
  lift(
    "push-press",
    "Push Press (Barbell)",
    "barbell",
    ["shoulders"],
    ["triceps"],
    "A short dip from the knees, then drive the bar off the legs and finish with the arms. The dip is a few inches and straight down — dipping forward sends the bar out in front of you.",
  ),
  lift(
    "row-barbell",
    "Row (Barbell)",
    "barbell",
    ["back"],
    ["lats"],
    "Hinge to about 45°, bar hanging at arm's length, pull to the lower ribs. Keep the torso angle fixed; standing up as you pull is how a row becomes a shrug.",
  ),
  lift(
    "pendlay-row",
    "Pendlay Row (Barbell)",
    "barbell",
    ["back"],
    ["lats"],
    "A row from a dead stop on the floor with the torso parallel to the ground. Every rep resets, which is what makes it strict and what makes it heavier than it feels.",
  ),
  lift(
    "shrug-barbell",
    "Shrug (Barbell)",
    "barbell",
    ["traps"],
    [],
    "Bar at arm's length, shrug straight up toward the ears and hold a beat. Rolling the shoulders adds nothing and grinds the joint.",
  ),
  lift(
    "bicep-curl-barbell",
    "Bicep Curl (Barbell)",
    "barbell",
    ["biceps"],
    [],
    "Shoulder-width grip, elbows pinned at your sides, curl without swinging. If the hips move, the bar is too heavy for what you are trying to train.",
  ),
  lift(
    "ez-bar-curl",
    "EZ Bar Curl (Barbell)",
    "barbell",
    ["biceps"],
    [],
    "As a barbell curl, on the cambered bar, which lets the wrists sit in a neutral-ish angle. Useful when a straight bar makes the wrists ache rather than as a different exercise.",
  ),
  lift(
    "skullcrusher-barbell",
    "Skullcrusher (Barbell)",
    "barbell",
    ["triceps"],
    [],
    "Lying, upper arms vertical, lower the bar to the forehead or just past it. Keep the elbows still — letting them drift back turns it into a pullover.",
  ),
  lift(
    "upright-row-barbell",
    "Upright Row (Barbell)",
    "barbell",
    ["shoulders"],
    ["traps"],
    "Hands slightly wider than shoulders, pull the bar to the lower chest, elbows leading. Do not pull higher than the collarbone; a narrow grip to the chin is the shoulder-impingement version.",
  ),

  // ---------------------------------------------------------------- olympic
  lift(
    "power-clean",
    "Power Clean (Barbell)",
    "barbell",
    ["full body"],
    [],
    "Deadlift position, accelerate through the hips, then pull under and catch on the front delts in a quarter squat. The arms bend last; pulling with the arms early kills the bar speed.",
  ),
  lift(
    "hang-clean",
    "Hang Clean (Barbell)",
    "barbell",
    ["full body"],
    [],
    "A clean starting from the hang at mid-thigh rather than the floor. Push the hips back to the start position and keep the bar against the legs before you explode.",
  ),
  lift(
    "clean-and-jerk",
    "Clean and Jerk (Barbell)",
    "barbell",
    ["full body"],
    [],
    "Clean the bar to the shoulders, stand, then dip and drive it overhead, splitting the feet to catch. Two movements with a full reset between them — treat it as such.",
  ),
  lift(
    "snatch",
    "Snatch (Barbell)",
    "barbell",
    ["full body"],
    [],
    "Wide grip, one pull from the floor to overhead, receiving in a full squat. The most technical lift here; load it only once the receiving position is comfortable empty.",
  ),
  lift(
    "power-snatch",
    "Power Snatch (Barbell)",
    "barbell",
    ["full body"],
    [],
    "A snatch caught above parallel rather than in a full squat. Lighter than a full snatch by definition, so use the bar speed rather than the number to judge it.",
  ),
  lift(
    "clean-pull",
    "Clean Pull (Barbell)",
    "barbell",
    ["back"],
    ["hamstrings"],
    "The clean's pull without the catch: extend fully and shrug, letting the bar rise on its own. Stop at extension — turning it into an upright row defeats the drill.",
  ),
  lift(
    "high-pull",
    "High Pull (Barbell)",
    "barbell",
    ["traps"],
    ["shoulders"],
    "Explode from the hip and pull the bar to chest height with the elbows above the bar. Speed is the point, not the height.",
  ),

  // ---------------------------------------------------------------- dumbbell
  lift(
    "bench-press-dumbbell",
    "Bench Press (Dumbbell)",
    "dumbbell",
    ["chest"],
    ["triceps"],
    "Bells at chest level, palms facing roughly forward, press up and slightly together. The wider range than a barbell is the reason to do it — lower to a real stretch.",
  ),
  lift(
    "incline-bench-press-dumbbell",
    "Incline Bench Press (Dumbbell)",
    "dumbbell",
    ["chest"],
    ["shoulders"],
    "Bench at 30°, bells to the upper chest, press without clashing them at the top. Getting the bells into position with a knee kick is part of the lift, not cheating.",
  ),
  lift(
    "fly-dumbbell",
    "Fly (Dumbbell)",
    "dumbbell",
    ["chest"],
    [],
    "Slight fixed bend in the elbow, open the arms in an arc until you feel the chest stretch. Never straighten the arms under load — that is a shoulder injury with a rep count.",
  ),
  lift(
    "shoulder-press-dumbbell",
    "Shoulder Press (Dumbbell)",
    "dumbbell",
    ["shoulders"],
    ["triceps"],
    "Seated or standing, bells at ear height, press overhead without arching. Keep the ribs down; the lower back should not be doing this.",
  ),
  lift(
    "arnold-press",
    "Arnold Press (Dumbbell)",
    "dumbbell",
    ["shoulders"],
    [],
    "Start with palms facing you at chin height, rotate outward as you press, reverse on the way down. Rotate smoothly — snapping the rotation under load is what makes shoulders complain.",
  ),
  lift(
    "lateral-raise-dumbbell",
    "Lateral Raise (Dumbbell)",
    "dumbbell",
    ["shoulders"],
    [],
    "Slight forward lean, raise the bells out to shoulder height with a small elbow bend. Lead with the elbows, not the hands, and stop at shoulder height.",
  ),
  lift(
    "front-raise-dumbbell",
    "Front Raise (Dumbbell)",
    "dumbbell",
    ["shoulders"],
    [],
    "Raise the bells straight in front to shoulder height, palms down or neutral. Swinging from the hips is the whole failure mode; go lighter than feels right.",
  ),
  lift(
    "rear-delt-fly-dumbbell",
    "Rear Delt Fly (Dumbbell)",
    "dumbbell",
    ["rear delts"],
    ["back"],
    "Hinged at the hips, arms hanging, open them out to the sides with soft elbows. Think about pulling the shoulder blades apart at the top, not squeezing them together.",
  ),
  lift(
    "row-dumbbell",
    "Row (Dumbbell)",
    "dumbbell",
    ["back"],
    ["lats"],
    "One hand and one knee on the bench, bell hanging, pull to the hip with the elbow close. Rotating the torso to finish the rep is the usual cheat.",
  ),
  lift(
    "chest-supported-row",
    "Chest Supported Row (Dumbbell)",
    "dumbbell",
    ["back"],
    ["lats"],
    "Chest on an incline bench, bells hanging, row to the ribs. The support is the point — nothing here can be moved with the lower back.",
  ),
  lift(
    "bicep-curl-dumbbell",
    "Bicep Curl (Dumbbell)",
    "dumbbell",
    ["biceps"],
    [],
    "Elbows at your sides, curl and supinate as you go. Alternating arms lets you go heavier per side without swinging.",
  ),
  lift(
    "hammer-curl",
    "Hammer Curl (Dumbbell)",
    "dumbbell",
    ["biceps"],
    ["forearms"],
    "Neutral grip throughout, elbows still, curl to the shoulder. Hits the brachialis and the forearm rather than the biceps peak.",
  ),
  lift(
    "incline-bicep-curl-dumbbell",
    "Incline Bicep Curl (Dumbbell)",
    "dumbbell",
    ["biceps"],
    [],
    "Seated on a 45–60° incline with the arms hanging behind the torso. That stretched start is the whole exercise; do not let the elbows drift forward.",
  ),
  lift(
    "concentration-curl",
    "Concentration Curl (Dumbbell)",
    "dumbbell",
    ["biceps"],
    [],
    "Seated, elbow braced against the inner thigh, curl slowly. Impossible to swing, which is why it is worth doing at the end.",
  ),
  lift(
    "skullcrusher-dumbbell",
    "Skullcrusher (Dumbbell)",
    "dumbbell",
    ["triceps"],
    [],
    "Lying, upper arms vertical, lower the bells beside the head with a neutral grip. Easier on the elbows than the bar version at the same load.",
  ),
  lift(
    "overhead-extension-dumbbell",
    "Overhead Extension (Dumbbell)",
    "dumbbell",
    ["triceps"],
    [],
    "One bell held overhead in both hands, lower behind the head, elbows pointed up and still. The overhead position is what loads the long head; letting the elbows flare loses it.",
  ),
  lift(
    "shrug-dumbbell",
    "Shrug (Dumbbell)",
    "dumbbell",
    ["traps"],
    [],
    "Bells at your sides, shrug straight up and hold. Straps are reasonable here — grip should not be what ends the set.",
  ),
  lift(
    "goblet-squat",
    "Goblet Squat (Dumbbell)",
    "dumbbell",
    ["quads"],
    ["glutes"],
    "One bell held at the chest, squat down between the knees with the elbows inside them. The front load keeps you upright, which is why it is the best squat to learn on.",
  ),
  lift(
    "romanian-deadlift-dumbbell",
    "Romanian Deadlift (Dumbbell)",
    "dumbbell",
    ["hamstrings"],
    ["glutes"],
    "Bells in front of the thighs, hinge back, keep them close to the legs. Letting the bells drift forward turns the hamstring stretch into a lower-back one.",
  ),
  lift(
    "lunge-dumbbell",
    "Lunge (Dumbbell)",
    "dumbbell",
    ["quads"],
    ["glutes"],
    "Bells at your sides, step forward, rear knee to just off the floor. Longer steps load the glute, shorter ones the quad — pick one and stay with it.",
  ),
  lift(
    "bulgarian-split-squat",
    "Bulgarian Split Squat (Dumbbell)",
    "dumbbell",
    ["quads"],
    ["glutes"],
    "Rear foot on a bench, front foot far enough forward that the shin stays near vertical. Brutal and worth it; the front foot too close is what makes it a knee exercise.",
  ),
  lift(
    "step-up-dumbbell",
    "Step Up (Dumbbell)",
    "dumbbell",
    ["quads"],
    ["glutes"],
    "Full front foot on a knee-height box, stand up through it without pushing off the back foot. Step down under control rather than dropping.",
  ),
  lift(
    "farmers-carry",
    "Farmer's Carry (Dumbbell)",
    "dumbbell",
    ["forearms"],
    ["abs"],
    "Heavy bells at your sides, ribs down, walk with a normal stride for distance or time. Do not shrug or lean — the point is holding a good posture under load.",
  ),
  lift(
    "calf-raise-dumbbell",
    "Calf Raise (Dumbbell)",
    "dumbbell",
    ["calves"],
    [],
    "One or two bells, balls of the feet on a step, full range up and down. Pause at the top; bouncing is most of what makes calf work feel useless.",
  ),

  // ---------------------------------------------------------------- cable and machine
  lift(
    "lat-pulldown",
    "Lat Pulldown (Cable)",
    "cable",
    ["lats"],
    ["biceps"],
    "Thighs under the pad, slight backward lean, pull the bar to the upper chest. Lead with the elbows and stop at the chest — pulling behind the neck is a shoulder problem.",
  ),
  lift(
    "close-grip-pulldown",
    "Close Grip Pulldown (Cable)",
    "cable",
    ["lats"],
    ["biceps"],
    "Neutral or narrow grip, pull to the sternum with the elbows tracking close to the body. More biceps and lower lat than the wide version.",
  ),
  lift(
    "row-cable",
    "Row (Cable)",
    "cable",
    ["back"],
    ["lats"],
    "Chest tall, knees soft, pull to the navel and let the shoulder blades come together. Rocking back and forth turns it into a lower-back exercise.",
  ),
  lift(
    "straight-arm-pulldown",
    "Straight Arm Pulldown (Cable)",
    "cable",
    ["lats"],
    [],
    "Arms almost straight, push the bar from head height down to the thighs in an arc. Elbows stay fixed; if they bend it is a pulldown.",
  ),
  lift(
    "fly-cable",
    "Fly (Cable)",
    "cable",
    ["chest"],
    [],
    "Cables set high, mid or low, arc the handles together in front with a fixed elbow bend. The constant tension is the reason to pick this over dumbbells.",
  ),
  lift(
    "lateral-raise-cable",
    "Lateral Raise (Cable)",
    "cable",
    ["shoulders"],
    [],
    "One arm, cable from the low pulley behind you, raise out to shoulder height. Loaded through the whole range, unlike a dumbbell, which is why it can be lighter.",
  ),
  lift(
    "face-pull",
    "Face Pull (Cable)",
    "cable",
    ["rear delts"],
    ["traps"],
    "Rope at face height, pull to the forehead and rotate the hands so the knuckles finish behind the ears. The rotation at the end is the part that matters for the shoulder.",
  ),
  lift(
    "triceps-pushdown",
    "Triceps Pushdown (Cable)",
    "cable",
    ["triceps"],
    [],
    "Elbows pinned to the ribs, push down to full extension, control the return. If the shoulders come forward the lats are helping.",
  ),
  lift(
    "rope-pushdown",
    "Rope Pushdown (Cable)",
    "cable",
    ["triceps"],
    [],
    "As the bar pushdown, splitting the rope apart at the bottom. The split is a small extra range at the point of peak contraction.",
  ),
  lift(
    "bicep-curl-cable",
    "Bicep Curl (Cable)",
    "cable",
    ["biceps"],
    [],
    "Low pulley, elbows at your sides, curl with the tension constant through the whole arc. No dead spot at the bottom, unlike a dumbbell.",
  ),
  lift(
    "crunch-cable",
    "Crunch (Cable)",
    "cable",
    ["abs"],
    [],
    "Kneeling, rope beside the head, crunch by flexing the spine rather than by pulling with the arms. The hips stay still — if they fold, it is a hip hinge with a rope in it.",
  ),
  lift(
    "leg-press",
    "Leg Press (Machine)",
    "machine",
    ["quads"],
    ["glutes"],
    "Feet mid-platform about shoulder-width, lower until the hips just begin to tuck. Never lock the knees hard at the top and never let the lower back round off the pad.",
  ),
  lift(
    "hack-squat",
    "Hack Squat (Machine)",
    "machine",
    ["quads"],
    [],
    "Back flat on the pad, feet slightly forward of the hips, descend under control. Quad-dominant by design — do not chase depth at the cost of the lower back.",
  ),
  lift(
    "leg-extension",
    "Leg Extension (Machine)",
    "machine",
    ["quads"],
    [],
    "Pad on the lower shin, extend to straight and pause. Control the negative; swinging the weight up is the whole reason people find this joint-unfriendly.",
  ),
  lift(
    "leg-curl-lying",
    "Leg Curl (Lying)",
    "machine",
    ["hamstrings"],
    [],
    "Hips flat on the pad, curl the heels to the glutes and lower slowly. Letting the hips rise is how you shorten the range without noticing.",
  ),
  lift(
    "leg-curl-seated",
    "Leg Curl (Seated)",
    "machine",
    ["hamstrings"],
    [],
    "Hips at 90°, which puts the hamstrings on stretch before you start. Generally the more productive of the two curls for that reason.",
  ),
  lift(
    "calf-raise-seated",
    "Calf Raise (Seated)",
    "machine",
    ["calves"],
    [],
    "Knees bent under the pad, full range through the ankle, pause at the top. The bent knee targets the soleus, which the standing version mostly misses.",
  ),
  lift(
    "calf-raise-standing",
    "Calf Raise (Standing)",
    "machine",
    ["calves"],
    [],
    "Balls of the feet on a step or a machine's platform, full range through the ankle. Pause at the top and lower under control through a real stretch at the bottom; speed here is what makes calf work feel useless.",
  ),
  lift(
    "chest-press-machine",
    "Chest Press (Machine)",
    "machine",
    ["chest"],
    ["triceps"],
    "Handles level with the mid-chest, press without shrugging the shoulders forward. Set the seat height first; everything else follows from it.",
  ),
  lift(
    "shoulder-press-machine",
    "Shoulder Press (Machine)",
    "machine",
    ["shoulders"],
    [],
    "Handles at ear height, press overhead, ribs down. A good place to train pressing when the lower back has had enough of standing work.",
  ),
  lift(
    "pec-deck",
    "Pec Deck (Machine)",
    "machine",
    ["chest"],
    [],
    "Forearms on the pads, bring the elbows together in front of the chest. Isolation only — go light and hold the squeeze.",
  ),
  lift(
    "row-machine",
    "Row (Machine)",
    "machine",
    ["back"],
    ["lats"],
    "Chest on the pad, pull the handles to the ribs, shoulder blades together at the end. The chest support means the load is honest.",
  ),
  lift(
    "assisted-pull-up",
    "Assisted Pull Up (Machine)",
    "machine",
    ["lats"],
    ["biceps"],
    "Knees on the pad, the counterweight makes it easier — a higher number is less assistance. Same rules as a pull up: full hang at the bottom, chin over at the top.",
  ),
  lift(
    "back-extension",
    "Back Extension (Machine)",
    "machine",
    ["lower back"],
    ["glutes"],
    "Hips on the pad, hinge down and come up to a straight line, no further. Hyperextending at the top is where this exercise earns its bad reputation.",
  ),
  lift(
    "hip-abduction",
    "Hip Abduction (Machine)",
    "machine",
    ["abductors"],
    [],
    "Seated, push the knees apart against the pads and return slowly. Small range, so the control is where the work is.",
  ),
  lift(
    "hip-adduction",
    "Hip Adduction (Machine)",
    "machine",
    ["adductors"],
    [],
    "Seated, bring the knees together against the pads. Worth doing for the groin resilience alone if you paddle or sprint.",
  ),

  // ---------------------------------------------------------------- bodyweight
  lift(
    "pull-up",
    "Pull Up (Bodyweight)",
    "bodyweight",
    ["lats"],
    ["biceps"],
    "Dead hang, overhand grip, pull until the chin clears the bar. Start each rep from a full hang — half-range reps are the usual way a set gets inflated.",
  ),
  lift(
    "chin-up",
    "Chin Up (Bodyweight)",
    "bodyweight",
    ["lats"],
    ["biceps"],
    "Underhand, shoulder-width, chin over the bar. More biceps than a pull up, and usually a few reps easier.",
  ),
  lift(
    "wide-grip-pull-up",
    "Wide Grip Pull Up (Bodyweight)",
    "bodyweight",
    ["lats"],
    [],
    "Grip wider than shoulders, pull the chest toward the bar. Harder and shorter-range; do not sacrifice the full hang for the extra width.",
  ),
  lift(
    "push-up",
    "Push Up (Bodyweight)",
    "bodyweight",
    ["chest"],
    ["triceps"],
    "Body in one line from head to heels, elbows at about 45°, chest to the floor. The hips sagging or piking is what turns it into an arm exercise.",
  ),
  lift(
    "diamond-push-up",
    "Diamond Push Up (Bodyweight)",
    "bodyweight",
    ["triceps"],
    ["chest"],
    "Hands together under the chest, elbows tracking back. Triceps-dominant and much harder than it looks at the same bodyweight.",
  ),
  lift(
    "dip",
    "Dip (Bodyweight)",
    "bodyweight",
    ["triceps"],
    ["chest"],
    "Lean forward slightly for chest, stay upright for triceps, lower until the upper arms are about parallel. Going deeper than the shoulders like is the fastest way to hurt them.",
  ),
  lift(
    "inverted-row",
    "Inverted Row (Bodyweight)",
    "bodyweight",
    ["back"],
    ["lats"],
    "Bar at hip height, body straight, pull the chest to the bar. Raise the feet to make it harder rather than adding weight.",
  ),
  lift(
    "pistol-squat",
    "Pistol Squat (Bodyweight)",
    "bodyweight",
    ["quads"],
    ["glutes"],
    "One leg, other leg extended forward, sit all the way down and stand up. Hold a light weight in front as a counterweight — it makes the balance easier, not the lift.",
  ),
  lift(
    "nordic-curl",
    "Nordic Curl (Bodyweight)",
    "bodyweight",
    ["hamstrings"],
    [],
    "Ankles anchored, fall forward as slowly as you can, catch with the hands. Even a partial negative is productive; the full rep is a long way off for most people.",
  ),
  lift(
    "glute-bridge",
    "Glute Bridge (Bodyweight)",
    "bodyweight",
    ["glutes"],
    [],
    "Shoulders on the floor, heels close, drive the hips up and squeeze at the top. Ribs down — do not use the lower back to reach lockout.",
  ),
  lift(
    "plank",
    "Plank (Bodyweight)",
    "bodyweight",
    ["abs"],
    [],
    "Forearms under the shoulders, body in one line, glutes and abs braced. Time is not the measure; the moment the hips sag the set is over.",
  ),
  lift(
    "side-plank",
    "Side Plank (Bodyweight)",
    "bodyweight",
    ["obliques"],
    [],
    "Elbow under the shoulder, hips stacked and lifted. Hold both sides for the same time even when one is obviously worse.",
  ),
  lift(
    "hanging-leg-raise",
    "Hanging Leg Raise (Bodyweight)",
    "bodyweight",
    ["abs"],
    ["hip flexors"],
    "Hang from the bar and raise the legs to horizontal or higher without swinging. Posteriorly tilt the pelvis at the top — otherwise this is a hip flexor exercise.",
  ),
  lift(
    "hollow-hold",
    "Hollow Hold (Bodyweight)",
    "bodyweight",
    ["abs"],
    [],
    "On your back, lower back pressed flat, arms and legs extended and lifted. Shorten the lever by tucking the knees if the back lifts off.",
  ),
  lift(
    "dead-bug",
    "Dead Bug (Bodyweight)",
    "bodyweight",
    ["abs"],
    [],
    "On your back, opposite arm and leg extended slowly with the ribs down. Slow is the whole exercise; speed here is just movement.",
  ),
  lift(
    "bird-dog",
    "Bird Dog (Bodyweight)",
    "bodyweight",
    ["abs"],
    ["lower back"],
    "On all fours, extend opposite arm and leg to a straight line and hold. Keep the hips square — a hip that rotates open has substituted for the work.",
  ),
  lift(
    "russian-twist",
    "Russian Twist (Bodyweight)",
    "bodyweight",
    ["obliques"],
    [],
    "Seated, leaning back, rotate the torso side to side under control. Rotate through the ribs, not just by waving the arms across.",
  ),
  lift(
    "sit-up",
    "Sit Up (Bodyweight)",
    "bodyweight",
    ["abs"],
    [],
    "Feet anchored or free, roll up one vertebra at a time. Yanking on the neck is the usual fault; cross the arms on the chest instead.",
  ),
  lift(
    "crunch-bodyweight",
    "Crunch (Bodyweight)",
    "bodyweight",
    ["abs"],
    [],
    "Lift the shoulder blades a few inches off the floor and squeeze. Short range on purpose — a long-range crunch is a sit up.",
  ),
  lift(
    "mountain-climber",
    "Mountain Climber (Bodyweight)",
    "bodyweight",
    ["abs"],
    ["hip flexors"],
    "Push-up position, drive the knees to the chest alternately without the hips rising. Conditioning and core together; keep the shoulders stacked over the hands.",
  ),
  lift(
    "burpee",
    "Burpee (Bodyweight)",
    "bodyweight",
    ["full body"],
    [],
    "Squat, kick back to a plank, chest to the floor, jump the feet in, stand and jump. Pace it — the first ten are free and the next ten are not.",
  ),
  lift(
    "jump-squat",
    "Jump Squat (Bodyweight)",
    "bodyweight",
    ["quads"],
    ["glutes"],
    "Quarter to half squat, jump as high as you can, land softly and absorb. Quality over count; once the landings get loud the set is done.",
  ),
  lift(
    "box-jump",
    "Box Jump (Bodyweight)",
    "bodyweight",
    ["quads"],
    ["calves"],
    "Jump onto a box, land in a quarter squat with the feet flat, step back down. Always step down — rebounding off a box is how shins meet its edge.",
  ),
  lift(
    "broad-jump",
    "Broad Jump (Bodyweight)",
    "bodyweight",
    ["quads"],
    ["glutes"],
    "Swing the arms, jump forward for distance, land in a stable squat. Measure the landing rather than the take-off if you want to compare sessions.",
  ),

  // ---------------------------------------------------------------- dragon boat specific
  lift(
    "paddle-pull-cable",
    "Paddle Pull (Cable)",
    "cable",
    ["lats"],
    ["abs"],
    "Set the cable high, take a staggered stance and pull down and back along the paddle's path, rotating through the trunk. It is a rotation and a hinge, not an arm pull.",
  ),
  lift(
    "single-arm-row-cable",
    "Single Arm Row (Cable)",
    "cable",
    ["lats"],
    ["abs"],
    "One arm, cable at chest height, row to the ribs and let the torso rotate slightly with it. The anti-rotation on the way out is half the value.",
  ),
  lift(
    "landmine-rotation",
    "Landmine Rotation (Barbell)",
    "barbell",
    ["obliques"],
    [],
    "Bar in a landmine, both hands on the end, arc it side to side from hip to hip. Pivot the back foot — rotating through a fixed knee is what hurts.",
  ),
  lift(
    "pallof-press",
    "Pallof Press (Cable)",
    "cable",
    ["obliques"],
    [],
    "Cable at chest height beside you, press straight out and resist the rotation. Nothing moves except the arms; the work is entirely in not turning.",
  ),
  lift(
    "med-ball-slam",
    "Medicine Ball Slam (Other)",
    "other",
    ["abs"],
    ["shoulders"],
    "Overhead, slam down through the whole body, catch on the bounce or pick it up. Full effort per rep — a submaximal slam trains nothing.",
  ),
  lift(
    "med-ball-rotational-throw",
    "Medicine Ball Rotational Throw (Other)",
    "other",
    ["obliques"],
    [],
    "Side on to a wall, rotate through the hips and throw. Speed is the goal, so keep the ball light and the sets short.",
  ),
  lift(
    "kettlebell-swing",
    "Kettlebell Swing (Kettlebell)",
    "kettlebell",
    ["glutes"],
    ["hamstrings"],
    "Hinge, hike the bell back between the legs, snap the hips to send it to chest height. The arms are ropes — lifting it with the shoulders is the standard error.",
  ),
  lift(
    "turkish-get-up",
    "Turkish Get Up (Kettlebell)",
    "kettlebell",
    ["full body"],
    [],
    "From lying to standing with a bell locked overhead, one step at a time, eyes on the bell. Learn it with a shoe on the fist before loading it at all.",
  ),
  lift(
    "renegade-row",
    "Renegade Row (Dumbbell)",
    "dumbbell",
    ["back"],
    ["abs"],
    "Push-up position on the bells, row one at a time while keeping the hips level. Widen the feet to make the anti-rotation manageable.",
  ),

  // ---------------------------------------------------------------- erg: 22 rows -> 3.
  // Distance and duration moved to the set (workout_sets.distance_m/duration_s), and what was
  // never a distance moved to piece_type — see renames.ts for the exact migration of each.
  erg(
    "row-erg",
    "Row (Erg)",
    ["quads", "glutes"],
    ["back", "lats", "abs"],
    "On the Concept2, drive with the legs first, then the back, then the arms — and the exact reverse on the recovery. Pick a rate and pressure for the piece you're doing and hold it; the standard mistake on any length is starting faster than the pace you can actually sustain.",
  ),
  erg(
    "ski-erg",
    "Ski Erg (Erg)",
    ["lats", "triceps"],
    ["abs", "shoulders"],
    "Double-pole from the hips, finishing the pull past them — the legs contribute far more than it looks like they do. Same discipline as rowing: pick a pace for the piece and hold it rather than starting hot.",
  ),
  erg(
    "bike-erg",
    "Bike Erg (Erg)",
    ["quads", "glutes"],
    ["calves"],
    "Cadence moderate to high, resistance set for the piece you're doing. Short pieces are anaerobic and the legs fail before the lungs; long ones are the low-impact aerobic option when the back or shoulders need a day off.",
  ),

  // ---------------------------------------------------------------- water: 9 rows -> 4.
  water(
    "paddle",
    "Paddle (Boat)",
    ["lats", "back"],
    ["abs", "shoulders"],
    "Full rotation through the trunk, top arm driving down through the catch. Pick a rate and pressure for the piece — a start is maximal from stroke one, a steady piece is conversational — and hold whatever you picked rather than drifting.",
  ),
  water(
    "starts",
    "Starts (Boat)",
    ["lats", "back"],
    ["abs"],
    "Start sequence practice: the first strokes, the transition and the settle. Short, maximal, and heavily technique-dependent.",
  ),
  water(
    "race-piece",
    "Race Piece (Boat)",
    ["lats", "back"],
    ["abs"],
    "A full race simulation at race rate. Treat the whole thing as one effort and record what the rate did.",
  ),
  water(
    "technical-paddle",
    "Technical Paddle (Boat)",
    ["lats", "back"],
    ["abs"],
    "Low pressure, focused on one thing — the catch, the exit, the timing. Note which one in the session's notes so the next one can follow it.",
  ),

  // ---------------------------------------------------------------- conditioning
  conditioning(
    "run",
    "Run (Outdoor)",
    "outdoor",
    ["quads", "hamstrings"],
    ["calves"],
    "Outdoor running for distance or time. Log the distance and duration; the split is computed from them.",
  ),
  conditioning(
    "run-treadmill",
    "Run (Treadmill)",
    "machine",
    ["quads", "hamstrings"],
    ["calves"],
    "Set the incline to at least 1% to approximate outdoor effort. Otherwise the same as a run.",
  ),
  conditioning(
    "sprint-intervals",
    "Sprint Intervals (Outdoor)",
    "outdoor",
    ["hamstrings", "quads"],
    ["glutes"],
    "Maximal efforts with full recovery. Stop when the times fall off rather than finishing the prescribed number.",
  ),
  conditioning(
    "hill-sprints",
    "Hill Sprints (Outdoor)",
    "outdoor",
    ["quads", "glutes"],
    ["calves"],
    "Short maximal efforts uphill, walking back down. Easier on the hamstrings than flat sprinting, which is why they are worth it early in a block.",
  ),
  conditioning(
    "stair-climb",
    "Stair Climb (Machine)",
    "machine",
    ["quads", "glutes"],
    ["calves"],
    "Sustained climbing on a machine or a stairwell. Do not lean on the rails.",
  ),
  conditioning(
    "cycling",
    "Cycling (Outdoor)",
    "outdoor",
    ["quads", "glutes"],
    ["calves"],
    "Outdoor riding for distance or time. Log both; the average speed follows from them.",
  ),
  conditioning(
    "swim",
    "Swim (Pool)",
    "pool",
    ["lats", "shoulders"],
    ["back", "abs"],
    "Log the distance and the time. Note the stroke in the session's notes if it varies.",
  ),
  conditioning(
    "jump-rope",
    "Jump Rope (Other)",
    "other",
    ["calves"],
    [],
    "Skipping for time or count. Elbows in, wrists doing the work, small jumps — big ones fatigue the calves for nothing.",
  ),
  conditioning(
    "sled-push",
    "Sled Push (Sled)",
    "sled",
    ["quads", "glutes"],
    ["calves"],
    "Low body angle, arms extended, drive through the legs with short quick steps. Very little eccentric load, so it recovers fast.",
  ),
  conditioning(
    "sled-drag",
    "Sled Drag (Sled)",
    "sled",
    ["quads", "glutes"],
    ["hamstrings"],
    "Backward or forward, walking under tension. Backward dragging is the knee-friendly quad option.",
  ),
  conditioning(
    "battle-ropes",
    "Battle Ropes (Other)",
    "other",
    ["shoulders"],
    ["forearms", "abs"],
    "Athletic stance, hinge slightly, alternate or slam for time. Conditioning — do not turn it into a shoulder endurance test.",
  ),
  // Nothing is loaded, so the figure stays blank rather than guessing, and there is no equipment
  // to put in parentheses — these three stay bare-named.
  conditioning(
    "mobility",
    "Mobility",
    "other",
    [],
    [],
    "Whatever the joint needs, taken through range under control. Log the duration so it shows up in the weekly volume.",
  ),
  conditioning(
    "stretching",
    "Stretching",
    "other",
    [],
    [],
    "Static holds, generally thirty seconds or more, after training rather than before. Log the duration.",
  ),
  conditioning(
    "foam-rolling",
    "Foam Rolling",
    "other",
    [],
    [],
    "Slow passes over the tissue, pausing where it is tender. Log the duration.",
  ),
];

/** The description for a movement, or `null` for one nobody has written yet — a hand-typed or
 *  AI-suggested entry, which correctly has no `howTo` until someone writes one. */
export function howTo(name: string): string | null {
  const entry = CATALOGUE.find((e) => e.name === name);
  return entry && entry.howTo.length > 0 ? entry.howTo : null;
}
