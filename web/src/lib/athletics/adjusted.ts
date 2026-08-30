/**
 * Weight-adjusted erg splits.
 *
 * The vault states exactly one athletic goal — "sub-2:00 weight-adjusted 500m split" — so a
 * site that only ever showed raw splits could not tell Victor whether he is close to it. At
 * 215 lbs the two numbers differ by about seven seconds, which is the difference between
 * "nearly there" and "a season away".
 *
 * The formula is Concept2's, used for their own online rankings:
 *
 *     factor = (bodyweight_lbs / 270) ^ 0.222
 *     adjusted_time = raw_time * factor
 *
 * It exists because a heavier rower moves an erg flywheel more easily than a lighter one, so
 * the adjustment *discounts* light rowers and gives heavy rowers almost none. The direction
 * is worth stating plainly because it is the opposite of the intuitive reading: putting on
 * mass makes the adjusted split **worse**, not better. Victor's goal is a weight-adjusted
 * one while he is also eating to hold 215 lbs, and the site should show that tension rather
 * than hide it behind a single improving line.
 */

/** The reference bodyweight in Concept2's formula. Not a target — just the pivot. */
export const REFERENCE_WEIGHT_LBS = 270;
export const ADJUSTMENT_EXPONENT = 0.222;

export type BodyweightReading = { measuredOn: string; weightLbs: number };

/** Multiplier applied to an erg time. Below 1 for anyone under the reference weight. */
export function weightAdjustmentFactor(bodyweightLbs: number): number | null {
  if (!Number.isFinite(bodyweightLbs) || bodyweightLbs <= 0) return null;
  return (bodyweightLbs / REFERENCE_WEIGHT_LBS) ** ADJUSTMENT_EXPONENT;
}

/** A raw time or split in seconds, adjusted for bodyweight. */
export function adjustSeconds(seconds: number, bodyweightLbs: number): number | null {
  const factor = weightAdjustmentFactor(bodyweightLbs);
  if (factor === null || !Number.isFinite(seconds) || seconds <= 0) return null;
  return seconds * factor;
}

/**
 * The raw split that would hit an adjusted target at a given bodyweight.
 *
 * This is the number that is actually actionable. "Sub-2:00 adjusted" is not something you
 * can pace to on a monitor; "2:06.2 raw" is.
 */
export function rawSplitForAdjustedTarget(
  targetAdjustedS: number,
  bodyweightLbs: number,
): number | null {
  const factor = weightAdjustmentFactor(bodyweightLbs);
  if (factor === null || factor === 0 || targetAdjustedS <= 0) return null;
  return targetAdjustedS / factor;
}

/**
 * The bodyweight to use for a piece rowed on `isoDay`.
 *
 * The most recent reading *on or before* that day, because a weight measured next month says
 * nothing about a piece rowed today. Falls back to the earliest later reading only so that
 * pieces logged before Victor started weighing in are still adjustable — with the caveat that
 * it is an extrapolation backwards, which is why the fallback is last rather than nearest.
 */
export function weightOn(readings: BodyweightReading[], isoDay: string): number | null {
  let before: BodyweightReading | null = null;
  let after: BodyweightReading | null = null;

  for (const reading of readings) {
    if (reading.measuredOn <= isoDay) {
      if (!before || reading.measuredOn > before.measuredOn) before = reading;
    } else if (!after || reading.measuredOn < after.measuredOn) {
      after = reading;
    }
  }

  return before?.weightLbs ?? after?.weightLbs ?? null;
}

export type GoalProgress = {
  targetAdjustedS: number;
  bodyweightLbs: number;
  factor: number;
  /** What the monitor has to read to hit the adjusted target at this bodyweight. */
  requiredRawS: number;
  /** Best raw split achieved at the goal distance, if any. */
  bestRawS: number | null;
  bestAdjustedS: number | null;
  /** Seconds still to find, per 500 m. Negative once the goal is met. */
  gapS: number | null;
};

/**
 * Where the goal stands. Returns null rather than a zeroed shape when the inputs are not
 * there, so the page can say "log a 500m piece" instead of rendering a confident 0:00.
 */
export function goalProgress(input: {
  targetAdjustedS: number;
  bodyweightLbs: number;
  bestRawS: number | null;
}): GoalProgress | null {
  const factor = weightAdjustmentFactor(input.bodyweightLbs);
  const requiredRawS = rawSplitForAdjustedTarget(input.targetAdjustedS, input.bodyweightLbs);
  if (factor === null || requiredRawS === null) return null;

  const bestRawS = input.bestRawS !== null && input.bestRawS > 0 ? input.bestRawS : null;
  const bestAdjustedS = bestRawS === null ? null : bestRawS * factor;

  return {
    targetAdjustedS: input.targetAdjustedS,
    bodyweightLbs: input.bodyweightLbs,
    factor,
    requiredRawS,
    bestRawS,
    bestAdjustedS,
    gapS: bestAdjustedS === null ? null : bestAdjustedS - input.targetAdjustedS,
  };
}
