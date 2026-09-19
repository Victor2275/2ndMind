/**
 * How old a thing is, and how loudly to say so (V4 §5.1, Q241, Q285, Q286).
 *
 * Three surfaces already answered this question and answered it three different ways: the
 * cached shell said *"As of 4h ago."* in a sentence, `outbox-console` said *"last synced 4h
 * ago"* in mono, and `freshness-badge` said *"12 stale"* with a threshold measured in days.
 * None of them was wrong; the problem is that a reader had to learn three vocabularies to
 * answer one question, and two of the three had no visual grade at all — they read the same at
 * four minutes and at four weeks.
 *
 * So the grading lives here, once, and `AsOf` in `components/site/states.tsx` is the only thing
 * that renders it. The three thresholds are arguments rather than constants because *stale*
 * genuinely differs per subject — an outbox op is a problem after a day (`STALE_MS`), a vault
 * file marked `stable` is fine for six months — but the *grades* do not, which is the half
 * worth sharing.
 *
 * Nothing here touches the DOM or the clock on its own. Every function takes the age it is
 * judging, so a server render and a client render of the same value cannot disagree.
 */

/**
 * An age a person reads without arithmetic. Rounded down and deliberately coarse — the
 * difference between 26 and 31 hours changes nothing anyone would do about it.
 *
 * **Moved here from `lib/sync/outbox-view.ts`** in §5.1, which re-exports it so its own callers
 * are unchanged. It had to move because `outbox-view` imports `lib/log/categories` to summarise
 * an op, and a staleness badge on the academics page has no business pulling the log's field
 * definitions into its chunk to format "3h".
 */
export function approximateAge(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

/**
 * How much attention an age deserves.
 *
 * - `fresh` — read moments ago. Worth stating, worth no colour.
 * - `aging` — old enough to mention, not old enough to act on.
 * - `stale` — old enough that treating it as current is a mistake.
 *
 * Three rather than two because a badge with one threshold is a boolean wearing a timestamp:
 * everything below the line looks identical, so the reader learns the number means nothing
 * until it turns amber and stops reading it the rest of the time.
 */
export type AgeGrade = "fresh" | "aging" | "stale";

/** An hour. Past this, an age is worth reading rather than glancing at. */
export const AGING_MS = 60 * 60 * 1000;

/**
 * A day — the same line `outbox-view`'s `STALE_MS` draws, and deliberately the same number.
 * Two definitions of "stale" in one app is how a badge and the screen it links to disagree.
 */
export const STALE_MS = 24 * 60 * 60 * 1000;

export function gradeAge(
  ms: number,
  { aging = AGING_MS, stale = STALE_MS }: { aging?: number; stale?: number } = {},
): AgeGrade {
  if (ms >= stale) return "stale";
  if (ms >= aging) return "aging";
  return "fresh";
}

/**
 * The exact moment, for the tabular half of the badge (Q286).
 *
 * Q286 asked for "a badge plus tabular timestamp" rather than one or the other, and the two
 * carry different things: the badge says *how stale*, which is the judgement, and the timestamp
 * says *when*, which is the fact. A reader deciding whether a number is worth trusting wants
 * the judgement; one reconciling it against something else wants the fact.
 *
 * Pinned to Los Angeles like every other formatted time in the app. A server in `us-east-1`
 * formatting in its own zone is how a 9pm entry renders as tomorrow.
 */
const AT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Los_Angeles",
});

export function exactMoment(at: Date | number): string {
  return AT.format(typeof at === "number" ? new Date(at) : at);
}
