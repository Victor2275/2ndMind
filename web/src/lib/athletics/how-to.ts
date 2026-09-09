/**
 * How each movement is performed, in two sentences (V4 Phase 2.10, D-223).
 *
 * ## Why text and not a clip
 *
 * The plan asked for a short demonstration loop per exercise, the way Hevy shows them. There is
 * no lawfully reusable set of 164 of those: the ones that exist belong to the apps that made
 * them, and the openly-licensed collections are stills with names that do not match this
 * catalogue. Victor's call was to drop the clips and take a written description instead — so
 * this is that description, and it is better than a clip in three ways that are worth naming.
 * It costs no request and no storage, so the gym-basement screen keeps working with no signal
 * and nothing to cache (§2.11 has nothing left to do). It is searchable. And it can say the
 * thing a loop cannot: **what usually goes wrong**, which is the half of a demonstration that
 * actually changes what you do on the next set.
 *
 * ## Shape
 *
 * Setup, then execution, then the common error — in that order, because that is the order you
 * need them standing at the rack. Two sentences is the cap on purpose: this is read between
 * sets with a bar in your hands, not studied.
 *
 * ## Keyed by name, and deliberately not a database column
 *
 * `exercises` is a synced table; this is a static map looked up by the same name the catalogue
 * uses. That means a movement you add yourself simply has no entry — which is correct, since
 * nobody has written one — and it means adding or fixing a description is a code change with a
 * diff rather than a migration plus a reseed plus a pull on every device. `how-to.test.ts` fails
 * if a seeded catalogue name has no entry here, so the two cannot drift apart.
 */

export const HOW_TO: Record<string, string> = {
  /* ---------------------------------------------------------------- barbell, lower */
  "Back Squat":
    "Bar across your traps, feet about shoulder-width with the toes turned slightly out. Brace, sit down between your hips until the crease of the hip passes the knee, and drive up — the usual fault is the knees collapsing inward out of the hole.",
  "Front Squat":
    "Bar in the front rack across the delts, elbows high and pointed forward. Squat straight down with a vertical torso; the moment the elbows drop, the bar rolls forward and the rep turns into a good morning.",
  "Box Squat":
    "Set a box at or just below parallel and squat back onto it, sitting rather than dropping. Pause without rocking, then drive up — bouncing off the box removes the whole point of it.",
  "Pause Squat":
    "A back squat held two to three seconds at the bottom with the brace intact. Stay tight through the pause; letting the air out at the bottom is what makes the ascent collapse.",
  Deadlift:
    "Bar over mid-foot, shins to the bar, chest up and lats set. Push the floor away and let the bar drag up your legs — the common error is hips shooting up first, which turns it into a stiff-legged pull.",
  "Sumo Deadlift":
    "Wide stance, hands inside the knees, toes turned out and knees tracking over them. Push the knees out as you drive the floor away; letting them cave in kills the leverage the wide stance bought.",
  "Romanian Deadlift":
    "Start standing, soften the knees, and push the hips straight back with the bar against your thighs. Stop when the hamstrings stop lengthening rather than when the bar reaches the floor.",
  "Deficit Deadlift":
    "A deadlift standing on a 1–2 inch platform, so the pull starts lower. Only useful if you can still reach the start position with a flat back — otherwise it trains the rounded position.",
  "Rack Pull":
    "Bar set on pins at or just below the knee. Pull from a dead stop with the lats engaged; do not bounce it off the pins between reps.",
  "Good Morning":
    "Bar on the back as in a squat, soft knees, hips pushed back until the torso is near parallel. Keep the spine rigid — this is a hip hinge, not a back extension, and it is loaded lighter than it looks.",
  "Hip Thrust":
    "Shoulder blades on a bench, bar across the hips on a pad, feet flat and shins vertical at the top. Squeeze the glutes to full lockout and keep the ribs down; arching the lower back fakes the range.",
  "Barbell Lunge":
    "Bar on the back, step forward and drop the rear knee to just above the floor. Keep the front shin near vertical and push back through the front heel.",
  "Barbell Step Up":
    "Bar on the back, plant the whole front foot on a box at knee height and stand up through it. Do not push off the trailing foot — that turns it into an assisted rep.",
  "Barbell Calf Raise":
    "Bar on the back, balls of the feet on a plate or step, heels hanging. Rise to full plantar flexion and lower under control through a full stretch; speed here removes the range.",

  /* ---------------------------------------------------------------- barbell, upper */
  "Bench Press":
    "Shoulder blades pulled together and down, feet planted, bar over the mid-chest. Lower to touch and press back over the shoulders — flaring the elbows straight out is what makes this hurt.",
  "Incline Bench Press":
    "Bench at 30–45°, bar to the upper chest just below the collarbone. Higher than 45° and it stops being a chest press and becomes a shoulder press.",
  "Decline Bench Press":
    "Bench declined 15–30°, bar to the lower chest. Get set before unracking; the decline makes an unracked bar much harder to control.",
  "Close Grip Bench Press":
    "Hands about shoulder-width, elbows tucked to roughly 30° from the ribs. Not narrower — a grip inside shoulder-width loads the wrists rather than the triceps.",
  "Paused Bench Press":
    "A bench press with a one to two second pause on the chest, no sinking and no bounce. The pause is the point: it removes the stretch reflex and shows what you can actually press.",
  "Overhead Press":
    "Bar on the front delts, elbows slightly in front, glutes and abs braced. Move the head back to let the bar pass, then push it overhead and shrug at the top; leaning back is a lower-back exercise.",
  "Push Press":
    "A short dip from the knees, then drive the bar off the legs and finish with the arms. The dip is a few inches and straight down — dipping forward sends the bar out in front of you.",
  "Barbell Row":
    "Hinge to about 45°, bar hanging at arm's length, pull to the lower ribs. Keep the torso angle fixed; standing up as you pull is how a row becomes a shrug.",
  "Pendlay Row":
    "A row from a dead stop on the floor with the torso parallel to the ground. Every rep resets, which is what makes it strict and what makes it heavier than it feels.",
  "Barbell Shrug":
    "Bar at arm's length, shrug straight up toward the ears and hold a beat. Rolling the shoulders adds nothing and grinds the joint.",
  "Barbell Curl":
    "Shoulder-width grip, elbows pinned at your sides, curl without swinging. If the hips move, the bar is too heavy for what you are trying to train.",
  "EZ Bar Curl":
    "As a barbell curl, on the cambered bar, which lets the wrists sit in a neutral-ish angle. Useful when a straight bar makes the wrists ache rather than as a different exercise.",
  Skullcrusher:
    "Lying, upper arms vertical, lower the bar to the forehead or just past it. Keep the elbows still — letting them drift back turns it into a pullover.",
  "Barbell Upright Row":
    "Hands slightly wider than shoulders, pull the bar to the lower chest, elbows leading. Do not pull higher than the collarbone; a narrow grip to the chin is the shoulder-impingement version.",

  /* ---------------------------------------------------------------- olympic */
  "Power Clean":
    "Deadlift position, accelerate through the hips, then pull under and catch on the front delts in a quarter squat. The arms bend last; pulling with the arms early kills the bar speed.",
  "Hang Clean":
    "A clean starting from the hang at mid-thigh rather than the floor. Push the hips back to the start position and keep the bar against the legs before you explode.",
  "Clean and Jerk":
    "Clean the bar to the shoulders, stand, then dip and drive it overhead, splitting the feet to catch. Two movements with a full reset between them — treat it as such.",
  Snatch:
    "Wide grip, one pull from the floor to overhead, receiving in a full squat. The most technical lift here; load it only once the receiving position is comfortable empty.",
  "Power Snatch":
    "A snatch caught above parallel rather than in a full squat. Lighter than a full snatch by definition, so use the bar speed rather than the number to judge it.",
  "Clean Pull":
    "The clean's pull without the catch: extend fully and shrug, letting the bar rise on its own. Stop at extension — turning it into an upright row defeats the drill.",
  "High Pull":
    "Explode from the hip and pull the bar to chest height with the elbows above the bar. Speed is the point, not the height.",

  /* ---------------------------------------------------------------- dumbbell */
  "Dumbbell Bench Press":
    "Bells at chest level, palms facing roughly forward, press up and slightly together. The wider range than a barbell is the reason to do it — lower to a real stretch.",
  "Incline Dumbbell Press":
    "Bench at 30°, bells to the upper chest, press without clashing them at the top. Getting the bells into position with a knee kick is part of the lift, not cheating.",
  "Dumbbell Fly":
    "Slight fixed bend in the elbow, open the arms in an arc until you feel the chest stretch. Never straighten the arms under load — that is a shoulder injury with a rep count.",
  "Dumbbell Shoulder Press":
    "Seated or standing, bells at ear height, press overhead without arching. Keep the ribs down; the lower back should not be doing this.",
  "Arnold Press":
    "Start with palms facing you at chin height, rotate outward as you press, reverse on the way down. Rotate smoothly — snapping the rotation under load is what makes shoulders complain.",
  "Lateral Raise":
    "Slight forward lean, raise the bells out to shoulder height with a small elbow bend. Lead with the elbows, not the hands, and stop at shoulder height.",
  "Front Raise":
    "Raise the bells straight in front to shoulder height, palms down or neutral. Swinging from the hips is the whole failure mode; go lighter than feels right.",
  "Rear Delt Fly":
    "Hinged at the hips, arms hanging, open them out to the sides with soft elbows. Think about pulling the shoulder blades apart at the top, not squeezing them together.",
  "Dumbbell Row":
    "One hand and one knee on the bench, bell hanging, pull to the hip with the elbow close. Rotating the torso to finish the rep is the usual cheat.",
  "Chest Supported Row":
    "Chest on an incline bench, bells hanging, row to the ribs. The support is the point — nothing here can be moved with the lower back.",
  "Dumbbell Curl":
    "Elbows at your sides, curl and supinate as you go. Alternating arms lets you go heavier per side without swinging.",
  "Hammer Curl":
    "Neutral grip throughout, elbows still, curl to the shoulder. Hits the brachialis and the forearm rather than the biceps peak.",
  "Incline Dumbbell Curl":
    "Seated on a 45–60° incline with the arms hanging behind the torso. That stretched start is the whole exercise; do not let the elbows drift forward.",
  "Concentration Curl":
    "Seated, elbow braced against the inner thigh, curl slowly. Impossible to swing, which is why it is worth doing at the end.",
  "Dumbbell Skullcrusher":
    "Lying, upper arms vertical, lower the bells beside the head with a neutral grip. Easier on the elbows than the bar version at the same load.",
  "Overhead Dumbbell Extension":
    "One bell held overhead in both hands, lower behind the head, elbows pointed up and still. The overhead position is what loads the long head; letting the elbows flare loses it.",
  "Dumbbell Shrug":
    "Bells at your sides, shrug straight up and hold. Straps are reasonable here — grip should not be what ends the set.",
  "Goblet Squat":
    "One bell held at the chest, squat down between the knees with the elbows inside them. The front load keeps you upright, which is why it is the best squat to learn on.",
  "Dumbbell Romanian Deadlift":
    "Bells in front of the thighs, hinge back, keep them close to the legs. Letting the bells drift forward turns the hamstring stretch into a lower-back one.",
  "Dumbbell Lunge":
    "Bells at your sides, step forward, rear knee to just off the floor. Longer steps load the glute, shorter ones the quad — pick one and stay with it.",
  "Bulgarian Split Squat":
    "Rear foot on a bench, front foot far enough forward that the shin stays near vertical. Brutal and worth it; the front foot too close is what makes it a knee exercise.",
  "Dumbbell Step Up":
    "Full front foot on a knee-height box, stand up through it without pushing off the back foot. Step down under control rather than dropping.",
  "Farmer's Carry":
    "Heavy bells at your sides, ribs down, walk with a normal stride for distance or time. Do not shrug or lean — the point is holding a good posture under load.",
  "Dumbbell Calf Raise":
    "One or two bells, balls of the feet on a step, full range up and down. Pause at the top; bouncing is most of what makes calf work feel useless.",

  /* ---------------------------------------------------------------- machine and cable */
  "Lat Pulldown":
    "Thighs under the pad, slight backward lean, pull the bar to the upper chest. Lead with the elbows and stop at the chest — pulling behind the neck is a shoulder problem.",
  "Close Grip Pulldown":
    "Neutral or narrow grip, pull to the sternum with the elbows tracking close to the body. More biceps and lower lat than the wide version.",
  "Seated Cable Row":
    "Chest tall, knees soft, pull to the navel and let the shoulder blades come together. Rocking back and forth turns it into a lower-back exercise.",
  "Straight Arm Pulldown":
    "Arms almost straight, push the bar from head height down to the thighs in an arc. Elbows stay fixed; if they bend it is a pulldown.",
  "Cable Fly":
    "Cables set high, mid or low, arc the handles together in front with a fixed elbow bend. The constant tension is the reason to pick this over dumbbells.",
  "Cable Lateral Raise":
    "One arm, cable from the low pulley behind you, raise out to shoulder height. Loaded through the whole range, unlike a dumbbell, which is why it can be lighter.",
  "Face Pull":
    "Rope at face height, pull to the forehead and rotate the hands so the knuckles finish behind the ears. The rotation at the end is the part that matters for the shoulder.",
  "Triceps Pushdown":
    "Elbows pinned to the ribs, push down to full extension, control the return. If the shoulders come forward the lats are helping.",
  "Rope Pushdown":
    "As the bar pushdown, splitting the rope apart at the bottom. The split is a small extra range at the point of peak contraction.",
  "Cable Curl":
    "Low pulley, elbows at your sides, curl with the tension constant through the whole arc. No dead spot at the bottom, unlike a dumbbell.",
  "Cable Crunch":
    "Kneeling, rope beside the head, crunch by flexing the spine rather than by pulling with the arms. The hips stay still — if they fold, it is a hip hinge with a rope in it.",
  "Leg Press":
    "Feet mid-platform about shoulder-width, lower until the hips just begin to tuck. Never lock the knees hard at the top and never let the lower back round off the pad.",
  "Hack Squat":
    "Back flat on the pad, feet slightly forward of the hips, descend under control. Quad-dominant by design — do not chase depth at the cost of the lower back.",
  "Leg Extension":
    "Pad on the lower shin, extend to straight and pause. Control the negative; swinging the weight up is the whole reason people find this joint-unfriendly.",
  "Lying Leg Curl":
    "Hips flat on the pad, curl the heels to the glutes and lower slowly. Letting the hips rise is how you shorten the range without noticing.",
  "Seated Leg Curl":
    "Hips at 90°, which puts the hamstrings on stretch before you start. Generally the more productive of the two curls for that reason.",
  "Seated Calf Raise":
    "Knees bent under the pad, full range through the ankle, pause at the top. The bent knee targets the soleus, which the standing version mostly misses.",
  "Standing Calf Raise":
    "Knees straight, balls of the feet on the step, rise to full extension. Full stretch at the bottom every rep — this is the one people cut short.",
  "Chest Press Machine":
    "Handles level with the mid-chest, press without shrugging the shoulders forward. Set the seat height first; everything else follows from it.",
  "Shoulder Press Machine":
    "Handles at ear height, press overhead, ribs down. A good place to train pressing when the lower back has had enough of standing work.",
  "Pec Deck":
    "Forearms on the pads, bring the elbows together in front of the chest. Isolation only — go light and hold the squeeze.",
  "Machine Row":
    "Chest on the pad, pull the handles to the ribs, shoulder blades together at the end. The chest support means the load is honest.",
  "Assisted Pull Up":
    "Knees on the pad, the counterweight makes it easier — a higher number is less assistance. Same rules as a pull up: full hang at the bottom, chin over at the top.",
  "Back Extension":
    "Hips on the pad, hinge down and come up to a straight line, no further. Hyperextending at the top is where this exercise earns its bad reputation.",
  "Hip Abduction":
    "Seated, push the knees apart against the pads and return slowly. Small range, so the control is where the work is.",
  "Hip Adduction":
    "Seated, bring the knees together against the pads. Worth doing for the groin resilience alone if you paddle or sprint.",

  /* ---------------------------------------------------------------- bodyweight */
  "Pull Up":
    "Dead hang, overhand grip, pull until the chin clears the bar. Start each rep from a full hang — half-range reps are the usual way a set gets inflated.",
  "Chin Up":
    "Underhand, shoulder-width, chin over the bar. More biceps than a pull up, and usually a few reps easier.",
  "Wide Grip Pull Up":
    "Grip wider than shoulders, pull the chest toward the bar. Harder and shorter-range; do not sacrifice the full hang for the extra width.",
  "Push Up":
    "Body in one line from head to heels, elbows at about 45°, chest to the floor. The hips sagging or piking is what turns it into an arm exercise.",
  "Diamond Push Up":
    "Hands together under the chest, elbows tracking back. Triceps-dominant and much harder than it looks at the same bodyweight.",
  Dip: "Lean forward slightly for chest, stay upright for triceps, lower until the upper arms are about parallel. Going deeper than the shoulders like is the fastest way to hurt them.",
  "Inverted Row":
    "Bar at hip height, body straight, pull the chest to the bar. Raise the feet to make it harder rather than adding weight.",
  "Pistol Squat":
    "One leg, other leg extended forward, sit all the way down and stand up. Hold a light weight in front as a counterweight — it makes the balance easier, not the lift.",
  "Nordic Curl":
    "Ankles anchored, fall forward as slowly as you can, catch with the hands. Even a partial negative is productive; the full rep is a long way off for most people.",
  "Glute Bridge":
    "Shoulders on the floor, heels close, drive the hips up and squeeze at the top. Ribs down — do not use the lower back to reach lockout.",
  Plank:
    "Forearms under the shoulders, body in one line, glutes and abs braced. Time is not the measure; the moment the hips sag the set is over.",
  "Side Plank":
    "Elbow under the shoulder, hips stacked and lifted. Hold both sides for the same time even when one is obviously worse.",
  "Hanging Leg Raise":
    "Hang from the bar and raise the legs to horizontal or higher without swinging. Posteriorly tilt the pelvis at the top — otherwise this is a hip flexor exercise.",
  "Hollow Hold":
    "On your back, lower back pressed flat, arms and legs extended and lifted. Shorten the lever by tucking the knees if the back lifts off.",
  "Dead Bug":
    "On your back, opposite arm and leg extended slowly with the ribs down. Slow is the whole exercise; speed here is just movement.",
  "Bird Dog":
    "On all fours, extend opposite arm and leg to a straight line and hold. Keep the hips square — a hip that rotates open has substituted for the work.",
  "Russian Twist":
    "Seated, leaning back, rotate the torso side to side under control. Rotate through the ribs, not just by waving the arms across.",
  "Sit Up":
    "Feet anchored or free, roll up one vertebra at a time. Yanking on the neck is the usual fault; cross the arms on the chest instead.",
  Crunch:
    "Lift the shoulder blades a few inches off the floor and squeeze. Short range on purpose — a long-range crunch is a sit up.",
  "Mountain Climber":
    "Push-up position, drive the knees to the chest alternately without the hips rising. Conditioning and core together; keep the shoulders stacked over the hands.",
  Burpee:
    "Squat, kick back to a plank, chest to the floor, jump the feet in, stand and jump. Pace it — the first ten are free and the next ten are not.",
  "Jump Squat":
    "Quarter to half squat, jump as high as you can, land softly and absorb. Quality over count; once the landings get loud the set is done.",
  "Box Jump":
    "Jump onto a box, land in a quarter squat with the feet flat, step back down. Always step down — rebounding off a box is how shins meet its edge.",
  "Broad Jump":
    "Swing the arms, jump forward for distance, land in a stable squat. Measure the landing rather than the take-off if you want to compare sessions.",
  "Calf Raise":
    "Bodyweight, on a step, full range with a pause at the top. High reps are appropriate here.",

  /* ---------------------------------------------------------------- dragon boat specific */
  "Cable Paddle Pull":
    "Set the cable high, take a staggered stance and pull down and back along the paddle's path, rotating through the trunk. It is a rotation and a hinge, not an arm pull.",
  "Single Arm Cable Row":
    "One arm, cable at chest height, row to the ribs and let the torso rotate slightly with it. The anti-rotation on the way out is half the value.",
  "Landmine Rotation":
    "Bar in a landmine, both hands on the end, arc it side to side from hip to hip. Pivot the back foot — rotating through a fixed knee is what hurts.",
  "Pallof Press":
    "Cable at chest height beside you, press straight out and resist the rotation. Nothing moves except the arms; the work is entirely in not turning.",
  "Medicine Ball Slam":
    "Overhead, slam down through the whole body, catch on the bounce or pick it up. Full effort per rep — a submaximal slam trains nothing.",
  "Medicine Ball Rotational Throw":
    "Side on to a wall, rotate through the hips and throw. Speed is the goal, so keep the ball light and the sets short.",
  "Kettlebell Swing":
    "Hinge, hike the bell back between the legs, snap the hips to send it to chest height. The arms are ropes — lifting it with the shoulders is the standard error.",
  "Turkish Get Up":
    "From lying to standing with a bell locked overhead, one step at a time, eyes on the bell. Learn it with a shoe on the fist before loading it at all.",
  "Renegade Row":
    "Push-up position on the bells, row one at a time while keeping the hips level. Widen the feet to make the anti-rotation manageable.",

  /* ---------------------------------------------------------------- erg pieces */
  "Erg 500m":
    "A sprint piece: high rate, full pressure from the first stroke. Legs, then back, then arms on the drive, and the exact reverse on the recovery.",
  "Erg 1000m":
    "Long enough to punish a fast start and short enough that a slow one cannot be recovered. Pick a split you can hold and let the last 200 be the sprint.",
  "Erg 2000m":
    "The benchmark. Negative-split it if you can — the standard mistake is going out five seconds a split faster than you can hold and paying for it from 800 to 1500.",
  "Erg 5000m":
    "Aerobic with a sting. Settle into a rate around 24–26 and hold the split rather than chasing it.",
  "Erg 6000m": "A steadier 2k test proxy. Even splits, rate low, and let the last kilometre build.",
  "Erg 10000m":
    "Long aerobic work. Set a split you could hold for twelve thousand metres and only spend what is left in the final 500.",
  "Erg Half Marathon":
    "21,097m. Fuel and hydrate beforehand; the limiting factor is usually the seat and the mind, not the legs.",
  "Erg 1 Minute": "Maximum metres in sixty seconds. Rate high, pressure maximal, no pacing plan.",
  "Erg 4 Minutes":
    "Maximum metres, long enough to hurt properly. Roughly 2k pace — start hard but not sprinting.",
  "Erg 20 Minutes":
    "Maximum metres in twenty. The classic aerobic benchmark; hold the rate low and the pressure high.",
  "Erg 30 Minutes":
    "Steady aerobic or a test, depending on the target rate. Note which one it was in the session title.",
  "Erg 60 Minutes":
    "Long steady state. Rate 18–20, split comfortable, breathing conversational for the first half.",
  "Erg Intervals 250m":
    "Short and sharp with full recovery. Every rep should be within a second of the first — when they are not, the session is finished.",
  "Erg Intervals 500m":
    "Race-pace work, typically 4–8 reps with equal or slightly shorter rest. Consistency across reps is the metric, not the best one.",
  "Erg Intervals 750m":
    "Slightly above 2k pace, hard on the aerobic system. Rest to a heart rate rather than to a clock if you can.",
  "Erg Intervals 1000m":
    "Threshold work. Hold 2k split plus two to four seconds and keep the rate honest.",
  "Erg Steady State":
    "Low rate, conversational, long. The single highest-return session in the plan and the one easiest to accidentally do too hard.",
  "Erg Warmup":
    "Ten to fifteen minutes building from very light, with a few rate bursts near the end. Log it so the volume is honest.",
  "SkiErg 500m":
    "Double-pole sprint: hinge from the hips and finish past them. Legs contribute far more than they look like they do.",
  "SkiErg 1000m": "Same technique, paced. The lats fatigue before the legs do — spread the work.",
  "BikeErg 2000m":
    "Short and anaerobic. Cadence high, resistance moderate, and expect the legs to fail before the lungs.",
  "BikeErg 5000m":
    "Aerobic piece with low upper-body cost. Useful when the shoulders need a day off.",

  /* ---------------------------------------------------------------- on the water */
  "Paddle 250m":
    "Race start distance. Full pressure, high rate, rotation through the trunk with the top arm driving down.",
  "Paddle 500m":
    "The standard race. Start, settle, hold, and finish — practise the transitions, not just the pressure.",
  "Paddle 1000m": "Longer race distance. Rate a touch lower and the catch further forward.",
  "Paddle 2000m": "Aerobic on the water. Technique degrades before fitness does; watch the catch.",
  "Paddle Steady State":
    "Low rate, long, conversational. Where the stroke gets built rather than tested.",
  "Paddle Intervals":
    "Work and rest on the water, usually by time. Log the piece length and the rest so the session can be compared.",
  Starts:
    "Start sequence practice: the first strokes, the transition and the settle. Short, maximal, and heavily technique-dependent.",
  "Race Piece":
    "A full race simulation at race rate. Treat the whole thing as one effort and record what the rate did.",
  "Technical Paddle":
    "Low pressure, focused on one thing — the catch, the exit, the timing. Note which one in the session's notes so the next one can follow it.",

  /* ---------------------------------------------------------------- conditioning */
  Run: "Outdoor running for distance or time. Log the distance and duration; the split is computed from them.",
  "Treadmill Run":
    "Set the incline to at least 1% to approximate outdoor effort. Otherwise the same as a run.",
  "Sprint Intervals":
    "Maximal efforts with full recovery. Stop when the times fall off rather than finishing the prescribed number.",
  "Hill Sprints":
    "Short maximal efforts uphill, walking back down. Easier on the hamstrings than flat sprinting, which is why they are worth it early in a block.",
  "Stair Climb": "Sustained climbing on a machine or a stairwell. Do not lean on the rails.",
  Cycling: "Outdoor riding for distance or time. Log both; the average speed follows from them.",
  Swim: "Log the distance and the time. Note the stroke in the session's notes if it varies.",
  "Jump Rope":
    "Skipping for time or count. Elbows in, wrists doing the work, small jumps — big ones fatigue the calves for nothing.",
  "Sled Push":
    "Low body angle, arms extended, drive through the legs with short quick steps. Very little eccentric load, so it recovers fast.",
  "Sled Drag":
    "Backward or forward, walking under tension. Backward dragging is the knee-friendly quad option.",
  "Battle Ropes":
    "Athletic stance, hinge slightly, alternate or slam for time. Conditioning — do not turn it into a shoulder endurance test.",
  Mobility:
    "Whatever the joint needs, taken through range under control. Log the duration so it shows up in the weekly volume.",
  Stretching:
    "Static holds, generally thirty seconds or more, after training rather than before. Log the duration.",
  "Foam Rolling": "Slow passes over the tissue, pausing where it is tender. Log the duration.",
};

/** The description for a movement, or `null` for one nobody has written yet. */
export function howTo(exercise: string): string | null {
  return HOW_TO[exercise] ?? null;
}
