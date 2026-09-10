/**
 * The phone's confirmation that something happened (V3 §3.3).
 *
 * The case this exists for is a rack between sets: the phone is in one hand, the eyes are not
 * on it, and the question is whether the set went in. A toast answers that only if you look.
 * A short tick answers it without looking, which is the whole premise of the fast log paths
 * §1.6 was built around.
 *
 * **Two patterns, and they must not be confusable.** A save is a single short tick. A failure is
 * two longer pulses with a gap — different in length, count and rhythm, because a person feeling
 * this through a pocket is not going to distinguish 20ms from 30ms. The rule is that no failure
 * can ever be mistaken for a success; a missed buzz is a minor annoyance, a failure that feels
 * like a save is a lost entry nobody goes looking for.
 *
 * Everything here is best-effort and silent about it. `navigator.vibrate` does not exist on
 * desktop Safari or on iOS at all, throws in some embedded webviews, and is ignored outright
 * when the device is in a silent or focus mode — none of which is a fault worth reporting, and
 * all of which would otherwise turn a nicety into an error in §2.4's log.
 */

/** A save landed. One short tick. */
export const SAVED = 18;

/**
 * Something did not send. Two long pulses, deliberately unlike `SAVED` in every dimension.
 *
 * `[pulse, gap, pulse]` — the gap is what makes it read as two events rather than one long
 * one, which is the part a pocket can actually distinguish.
 */
export const FAILED = [70, 90, 70];

/**
 * The rest timer reached zero (V4 Phase 2++ Stage 5). Three short pulses — distinct from
 * `SAVED`'s single tick and from `FAILED`'s two long ones by count alone, which is the
 * dimension easiest to feel through a pocket without attending to duration.
 */
export const RESTED = [40, 60, 40, 60, 40];

/**
 * @param pattern  A duration, or a `[vibrate, pause, vibrate…]` sequence.
 * @returns whether the device accepted it — for tests, not for callers to branch on.
 */
export function buzz(pattern: number | number[]): boolean {
  try {
    // `navigator.vibrate` is missing entirely on iOS and on most desktops. Checked rather than
    // assumed, because reading it off a partial `navigator` in a webview can itself throw.
    if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return false;
    return navigator.vibrate(pattern);
  } catch {
    // A device that refuses to buzz is not a problem to report. Silence is the correct outcome.
    return false;
  }
}

/** Confirms a write. Called on every save, online or not — the same action should feel the same. */
export function buzzSaved(): boolean {
  return buzz(SAVED);
}

/** A flush failed. Distinct from `buzzSaved` by design; see the note above. */
export function buzzFailed(): boolean {
  return buzz(FAILED);
}

/** The rest timer reached zero. */
export function buzzRested(): boolean {
  return buzz(RESTED);
}
