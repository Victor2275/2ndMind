/**
 * Turning a spoken sentence into a filled Training form (V3 §4.3, D-186).
 *
 * Rules, not a model — for the shapes Victor actually says. Victor's call was "rules first,
 * Gemini when they fail", and the reason to put the rules first is not cost: it is that a
 * grammar is **wrong the same way every time**. When it mishears "for" as a rep count you learn
 * that in one session and phrase around it. A model that is confidently wrong about a number is
 * wrong differently each time, in a log whose entire value is that its numbers can be trusted.
 *
 * Nothing here saves anything. It fills a form, and the form is submitted by hand — so a
 * misparse costs a correction, never a bad row. That is structural rather than a rule someone
 * has to remember: this module cannot write.
 *
 * ## What it understands
 *
 *   "bench press 185 for 5"                  → lift, Bench Press, one set of 185 × 5
 *   "bench press 185 for 5, three sets"      → the same set, three times
 *   "squat 225 by 3 rpe 8"                   → an RPE as well
 *   "2000 metre erg in 7:12"                 → erg, 2000m, 7:12
 *   "20 minute run"                          → conditioning, 20:00
 *
 * ## What it does not
 *
 * Anything phrased in a way this file has not seen. `parseSpoken` returns `null` for that
 * rather than guessing, and the caller offers it to the model instead — which is the whole
 * point of returning `null` rather than a half-filled shape that looks like success.
 */

export type SpokenSet = {
  weightLbs?: number;
  reps?: number;
  distance?: number;
  duration?: string;
  spm?: number;
};

export type SpokenEntry = {
  kind: "lift" | "erg" | "water" | "conditioning";
  exercise: string;
  rpe: number | null;
  sets: SpokenSet[];
};

/** Words that say what kind of session this is, in the order they should be tested. */
const KINDS: ReadonlyArray<readonly [SpokenEntry["kind"], RegExp]> = [
  ["erg", /\b(erg|ergo|rowed?|rowing|2k|5k|split)\b/],
  ["water", /\b(water|boat|paddl\w*|dragon)\b/],
  ["conditioning", /\b(run|ran|jog\w*|bike|biked|ruck\w*|burpees?|circuit|conditioning)\b/],
];

/**
 * Numbers as speech recognition hands them over.
 *
 * Chrome transcribes most quantities as digits, but small counts often arrive as words —
 * "three sets", not "3 sets" — and a grammar that only reads digits fails on the single most
 * common phrase in a lifting session.
 */
const WORD_NUMBERS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
};

function digitsFor(text: string): string {
  return text.replace(new RegExp(`\\b(${Object.keys(WORD_NUMBERS).join("|")})\\b`, "gi"), (word) =>
    String(WORD_NUMBERS[word.toLowerCase()]),
  );
}

/** Title Case, matching what the `capitalise: "words"` field would have produced by hand. */
function titleCase(text: string): string {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export function parseSpoken(transcript: string): SpokenEntry | null {
  const said = digitsFor(transcript.toLowerCase().trim());
  if (said === "") return null;

  const kind = KINDS.find(([, pattern]) => pattern.test(said))?.[0] ?? "lift";

  // RPE first, and removed before anything else reads a number — otherwise "rpe 8" is a
  // perfectly good candidate for a rep count.
  const rpeMatch = said.match(/\brpe\s*(\d{1,2}(?:\.\d)?)\b/);
  const rpe = rpeMatch ? Number(rpeMatch[1]) : null;
  const body = said.replace(/\brpe\s*\d{1,2}(?:\.\d)?\b/, " ");

  // "three sets", "3 sets", "x3 sets". Removed too, so the count is not read as reps.
  const setsMatch = body.match(/\b(\d{1,2})\s*sets?\b/);
  const repeat = setsMatch ? Math.min(12, Math.max(1, Number(setsMatch[1]))) : 1;
  const rest = body.replace(/\b\d{1,2}\s*sets?\b/, " ");

  // The words say what kind of session it is; when they do not, the **shape of the numbers**
  // does. "2000 metres in 7:12" names no erg and is plainly not a lift, and giving up on it
  // would send a sentence to the model that the grammar can read perfectly well.
  //
  // The inferred kind is `conditioning` rather than `erg`, because a distance and a time is all
  // that was actually said and guessing the machine from Victor's habits would be putting a
  // fact in the form that nobody stated. `kind` is a visible select on the form he confirms.
  let shape = kind;
  let set = kind === "lift" ? liftSet(rest) : distanceSet(rest);
  if (!set && kind === "lift") {
    set = distanceSet(rest);
    if (set) shape = "conditioning";
  }
  if (!set) return null;

  const exercise = nameFrom(rest, shape);
  if (exercise === "") return null;

  return {
    kind: shape,
    exercise,
    rpe,
    sets: Array.from({ length: repeat }, () => ({ ...set })),
  };
}

/**
 * Weight and reps.
 *
 * The joining word carries the meaning and there are several: "185 for 5", "185 by 5",
 * "185 times 5", "185 x 5". Recognition renders the last of those as "x" or "by" depending on
 * how it was said, which is why both are here.
 */
function liftSet(text: string): SpokenSet | null {
  const pair = text.match(
    /(\d+(?:\.\d+)?)\s*(?:lbs?|pounds?|kilos?|kg)?\s*(?:for|by|x|times)\s*(\d+)\b/,
  );
  if (pair) return { weightLbs: Number(pair[1]), reps: Number(pair[2]) };

  // A bodyweight movement: "ten pull ups". Reps with no weight is still a set.
  const repsOnly = text.match(/\b(\d{1,3})\s*(?:reps?)\b/);
  if (repsOnly) return { reps: Number(repsOnly[1]) };

  return null;
}

/** Distance, time, and rate — for anything measured by how far and how long. */
function distanceSet(text: string): SpokenSet | null {
  const set: SpokenSet = {};

  const distance = text.match(
    /(\d+(?:\.\d+)?)\s*(k|km|kilometers?|kilometres?|m|meters?|metres?)\b/,
  );
  if (distance) {
    const value = Number(distance[1]);
    set.distance = /^k/.test(distance[2]) ? value * 1000 : value;
  }

  // "7:12" as an erg monitor shows it, or "20 minutes" as a run is described.
  const clock = text.match(/\b(\d{1,3}):([0-5]\d)\b/);
  if (clock) set.duration = `${Number(clock[1])}:${clock[2]}`;
  else {
    const minutes = text.match(/\b(\d{1,3})\s*(?:minutes?|mins?)\b/);
    if (minutes) set.duration = `${Number(minutes[1])}:00`;
  }

  const spm = text.match(/\b(\d{2})\s*(?:spm|strokes?)\b/);
  if (spm) set.spm = Number(spm[1]);

  return set.distance !== undefined || set.duration !== undefined ? set : null;
}

/**
 * The name of the thing, which is whatever was said before the numbers started.
 *
 * Trailing filler is trimmed because "an erg" and "a run" are how these are said and neither is
 * the name of the piece. If nothing is left — "2000 metres in 7:12" names no exercise — the
 * kind stands in, so the entry is still identifiable in a list.
 */
function nameFrom(text: string, kind: SpokenEntry["kind"]): string {
  const before = text.split(/\d/)[0] ?? "";
  const cleaned = before
    .replace(/\b(a|an|the|did|do|done|of|at|for|in|on|and|i|my|some)\b/g, " ")
    .replace(/[^\p{L}\s]/gu, " ")
    .trim();

  if (cleaned !== "") return titleCase(cleaned);
  return { lift: "Lift", erg: "Erg", water: "Paddle", conditioning: "Conditioning" }[kind];
}
