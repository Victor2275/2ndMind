/**
 * Where a dragged bottom sheet lands when you let go (V4 §4.3, Q172).
 *
 * Kept apart from the component because this is the whole of the interaction and none of it
 * needs a DOM: given how far the sheet was dragged, how fast it was moving and how tall it is,
 * there is exactly one right answer. A test can state the cases — a flick, a slow long drag, a
 * drag that changed its mind — in three lines each, which is not true once the same arithmetic
 * is inside a pointer handler.
 *
 * Nothing here is sensitive; it compiles into client chunks.
 */

export type Snap = "partial" | "full";
export type Landing = Snap | "closed";

/** Past this, a flick counts regardless of distance. px per ms — 0.5 is a deliberate gesture. */
export const FLICK_VELOCITY = 0.5;

/** A slow drag has to cross this share of the sheet's height to change anything. */
const TRAVEL = 0.25;

/** Below this, a drag is a tap that wobbled. */
const DEAD_ZONE = 8;

/**
 * @param dy       How far the pointer has moved since it went down. Positive is **down**,
 *                 which is the direction that dismisses.
 * @param velocity Signed, in px/ms, over the last few moves. Positive is down.
 * @param height   The sheet's current height in px — what `TRAVEL` is a share of.
 * @param from     Which snap point the drag started at.
 *
 * A flick beats distance, in both directions: the gesture people actually make to dismiss a
 * sheet is a short fast flick, and requiring a quarter of the sheet's height would reject it.
 * A flick *up* from `partial` is the same gesture inverted and opens it fully.
 */
export function settle({
  dy,
  velocity,
  height,
  from,
}: {
  dy: number;
  velocity: number;
  height: number;
  from: Snap;
}): Landing {
  if (Math.abs(dy) < DEAD_ZONE && Math.abs(velocity) < FLICK_VELOCITY) return from;

  const far = Math.abs(dy) >= height * TRAVEL;
  const flicked = Math.abs(velocity) >= FLICK_VELOCITY;
  const down = dy > 0 || (dy === 0 && velocity > 0);

  if (!far && !flicked) return from;

  if (down) {
    // From `full`, the first downward gesture steps to `partial` rather than closing: a sheet
    // that vanishes when you meant to shrink it has thrown away whatever you were about to tap.
    // From `partial` there is no step left, so down means gone.
    return from === "full" ? "partial" : "closed";
  }

  return "full";
}

/**
 * Velocity over a short window rather than between the last two events.
 *
 * Two consecutive pointer moves can be a fraction of a millisecond apart, which makes the
 * naive `dy/dt` enormous and turns any drag into a flick. Sampling over ~80ms is what makes
 * `FLICK_VELOCITY` mean something a hand can aim at.
 */
export class Velocity {
  private samples: Array<{ y: number; t: number }> = [];

  constructor(private windowMs = 80) {}

  push(y: number, t: number): void {
    this.samples.push({ y, t });
    // Drop anything older than the window, but never go below two samples: a drag slow enough
    // that its events are further apart than the window still has to produce a number, and the
    // right one there is simply the last interval.
    while (this.samples.length > 2 && t - this.samples[0].t > this.windowMs) this.samples.shift();
  }

  /** px per ms, positive downwards. Zero when there is nothing to measure. */
  get(): number {
    if (this.samples.length < 2) return 0;
    const first = this.samples[0];
    const last = this.samples[this.samples.length - 1];
    const dt = last.t - first.t;
    return dt <= 0 ? 0 : (last.y - first.y) / dt;
  }

  reset(): void {
    this.samples = [];
  }
}
