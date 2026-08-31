/**
 * Hybrid logical clock — the thing last-write-wins actually compares
 * (V3 §1.2, `docs/SYNC_DESIGN.md` §3, D-127).
 *
 * `Date.now()` is not a usable clock for this. The failure is concrete: fly to Taiwan, the
 * phone's clock jumps forward, and from that moment it wins every conflict for the rest of the
 * day — including overwriting edits made later on the laptop. An HLC keeps a logical counter
 * alongside the wall clock so a device's stamps are monotonic even when its clock is not, and
 * so a change made in reply to another change always sorts after it.
 *
 * Nothing here touches IndexedDB or the network. The clock's persisted state is passed in and
 * handed back, which is what makes the interesting cases — clock jumps backwards, two events
 * inside one millisecond, a peer ten minutes ahead — testable without staging them.
 */

/**
 * A remote stamp further ahead than this is rejected rather than absorbed. Without the bound,
 * one badly-skewed peer drags this device's clock forward permanently and every subsequent
 * comparison is poisoned. Ten minutes is well past any real clock difference and well short of
 * a timezone.
 */
export const MAX_DRIFT_MS = 10 * 60 * 1000;

/**
 * Both parts are zero-padded to a fixed width because stamps are compared as **strings**.
 * Unpadded, "9" sorts after "10" and the whole ordering is quietly wrong — which would show up
 * as occasional lost edits and nothing else.
 *
 * 11 base-36 characters covers wall-clock milliseconds past the year 5000; 4 covers 1.6M
 * events inside a single millisecond.
 */
const WALL_CHARS = 11;
const COUNTER_CHARS = 4;
const MAX_COUNTER = 36 ** COUNTER_CHARS - 1;

export type Hlc = {
  wallMs: number;
  counter: number;
  /** Random per install. Only ever a final tiebreak, so two devices cannot collide. */
  deviceId: string;
};

/** Thrown when a remote stamp is too far ahead to trust. Surfaced as a sync error, not clamped. */
export class HlcDriftError extends Error {
  constructor(
    readonly remoteWallMs: number,
    readonly localWallMs: number,
  ) {
    super(
      `Remote clock is ${Math.round((remoteWallMs - localWallMs) / 1000)}s ahead, ` +
        `past the ${MAX_DRIFT_MS / 1000}s limit`,
    );
    this.name = "HlcDriftError";
  }
}

/** Thrown if a single millisecond somehow overflows the counter — an encoding failure, not a race. */
export class HlcOverflowError extends Error {
  constructor() {
    super(`More than ${MAX_COUNTER} events in one millisecond`);
    this.name = "HlcOverflowError";
  }
}

function pad(value: number, width: number): string {
  const encoded = value.toString(36);
  if (encoded.length > width) throw new HlcOverflowError();
  return encoded.padStart(width, "0");
}

export function encodeHlc({ wallMs, counter, deviceId }: Hlc): string {
  if (counter > MAX_COUNTER) throw new HlcOverflowError();
  return `${pad(wallMs, WALL_CHARS)}-${pad(counter, COUNTER_CHARS)}-${deviceId}`;
}

export function decodeHlc(stamp: string): Hlc {
  const parts = stamp.split("-");
  // A device id is itself a UUID with dashes in it, so only the first two splits are fixed.
  if (parts.length < 3) throw new Error(`Malformed HLC: ${stamp}`);

  const [wall, counter, ...device] = parts;
  const wallMs = parseInt(wall, 36);
  const parsedCounter = parseInt(counter, 36);
  if (!Number.isFinite(wallMs) || !Number.isFinite(parsedCounter)) {
    throw new Error(`Malformed HLC: ${stamp}`);
  }

  return { wallMs, counter: parsedCounter, deviceId: device.join("-") };
}

/**
 * Total order over stamps. A plain string comparison, which is the entire reason for the fixed
 * width padding above — and the reason the device id comes last, as a stable final tiebreak.
 */
export function compareHlc(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** The later of two stamps. This is the last-write-wins rule, applied per row rather than per field. */
export function laterHlc(a: string, b: string): string {
  return compareHlc(a, b) >= 0 ? a : b;
}

/**
 * The clock itself. `now` is injected so tests can move time backwards, which is exactly the
 * case the counter exists to survive and exactly the case a real clock will not reproduce
 * on demand.
 */
export class HlcClock {
  private wallMs: number;
  private counter: number;

  constructor(
    readonly deviceId: string,
    private readonly now: () => number = Date.now,
    /** Resume from a persisted stamp, so a reload does not reset the logical clock. */
    last?: { wallMs: number; counter: number },
  ) {
    this.wallMs = last?.wallMs ?? 0;
    this.counter = last?.counter ?? 0;
  }

  /** The current state, for persisting. */
  get state(): { wallMs: number; counter: number } {
    return { wallMs: this.wallMs, counter: this.counter };
  }

  /**
   * Stamp a local change.
   *
   * `max(physicalNow, last.wall)` is what makes this monotonic: if the device clock goes
   * backwards — a manual time change, an NTP correction — the stamp does not, and the counter
   * takes over to keep each stamp distinct.
   */
  tick(): string {
    const physical = this.now();
    const wall = Math.max(physical, this.wallMs);
    const counter = wall === this.wallMs ? this.counter + 1 : 0;
    if (counter > MAX_COUNTER) throw new HlcOverflowError();

    this.wallMs = wall;
    this.counter = counter;
    return encodeHlc({ wallMs: wall, counter, deviceId: this.deviceId });
  }

  /**
   * Absorb a stamp seen from another device, then stamp.
   *
   * This is what makes the clock causal rather than merely monotonic: having seen a remote
   * change, everything this device does afterwards sorts after it. Without it, a reply to an
   * edit can sort before the edit it replies to and last-write-wins picks the wrong one.
   */
  receive(remote: string): string {
    const { wallMs: remoteWall, counter: remoteCounter } = decodeHlc(remote);
    const physical = this.now();

    if (remoteWall > physical + MAX_DRIFT_MS) {
      throw new HlcDriftError(remoteWall, physical);
    }

    const wall = Math.max(physical, this.wallMs, remoteWall);

    // Which branch the max came from decides the counter. On a tie between the two logical
    // clocks, take the higher counter and step past it — anything else can repeat a stamp.
    let counter: number;
    if (wall === this.wallMs && wall === remoteWall) {
      counter = Math.max(this.counter, remoteCounter) + 1;
    } else if (wall === this.wallMs) {
      counter = this.counter + 1;
    } else if (wall === remoteWall) {
      counter = remoteCounter + 1;
    } else {
      counter = 0;
    }
    if (counter > MAX_COUNTER) throw new HlcOverflowError();

    this.wallMs = wall;
    this.counter = counter;
    return encodeHlc({ wallMs: wall, counter, deviceId: this.deviceId });
  }
}
