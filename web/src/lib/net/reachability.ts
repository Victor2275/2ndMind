import { observeNetwork, type Budget, type Outcome } from "@/lib/net/deadline";

/**
 * What the app believes about the connection (V4 Phase N7).
 *
 * ## Why the app has to own this
 *
 * `navigator.onLine` answers a question nobody asked: whether the device has *an* interface. It
 * cannot tell you whether anything answers, and on the connection this whole phase exists for —
 * plane wifi, a captive portal, a cell that associates and then stalls — it reports `true`. The
 * one signal the app consulted actively lied about the one case that mattered.
 *
 * So reachability is **derived from what actually happened to requests**. A fired deadline is
 * evidence. A fast success is evidence. `navigator.onLine === false` is conclusive; `true`
 * proves nothing and is ignored.
 *
 * ## Three states, and what each one means
 *
 * - `healthy` — something answered, recently. The default, and where a single success returns.
 * - `degraded` — requests are connecting and not finishing. **This is the interesting one**: the
 *   app is genuinely fine in this state, because writes queue and screens render from IndexedDB.
 *   It just needs to say so rather than looking broken.
 * - `unreachable` — the device says there is no network at all. The only state taken on someone
 *   else's word, because `false` is the one thing `onLine` can say conclusively.
 *
 * ## What it is not
 *
 * Not a health check, and it never makes a request of its own. Polling an endpoint to ask
 * whether the network works is another request competing for the same stalled pipe (§3b), and
 * it would be making traffic to describe traffic. Every input here is a request the app was
 * making anyway.
 */

export type Reach = "healthy" | "degraded" | "unreachable";

export type Reachability = {
  state: Reach;
  /** When the current state was entered, for a UI that does not want to flicker. */
  since: number;
};

/**
 * Consecutive fast failures needed to call a connection degraded, when nothing corroborates.
 *
 * Two, not one. A single fast rejection is the ordinary blip this app already retries for —
 * a radio handing between cells, wifi associated but not yet authenticated — and D-157 exists
 * because treating one of those as a verdict put the phone on a dead-end page while it was
 * online. A stall is different and counts immediately: three seconds of a connection holding a
 * request open and saying nothing is not a blip, it is the condition.
 */
const FAILURES_BEFORE_DEGRADED = 2;

/**
 * Where it starts, and what the server renders.
 *
 * One shared object rather than a fresh literal per call: `useSyncExternalStore` compares
 * snapshots by identity, and a new object each render is an infinite loop.
 */
const INITIAL: Reachability = { state: "healthy", since: 0 };

let current: Reachability = INITIAL;
let consecutiveFailures = 0;

const listeners = new Set<() => void>();

/**
 * What the platform claims about the connection, where it says anything at all.
 *
 * A **hint**, never the truth, and the distinction is load-bearing. `navigator.connection` does
 * not exist on iOS Safari and is behind a flag in others, so anything that depended on it would
 * be a feature that silently does not exist on half the devices. It is also describing the
 * radio rather than whether the server answers, which is the wrong question again — a phone can
 * have five bars of 5G and be behind a portal that drops everything.
 *
 * So it is used for exactly one thing: corroboration. When the platform already says the
 * connection is bad, one fast failure is enough to believe it rather than two.
 */
function platformSaysSlow(): boolean {
  try {
    const connection = (
      navigator as Navigator & { connection?: { effectiveType?: string; rtt?: number } }
    ).connection;
    if (!connection) return false;
    if (connection.effectiveType === "slow-2g" || connection.effectiveType === "2g") return true;
    return typeof connection.rtt === "number" && connection.rtt > 1_000;
  } catch {
    return false;
  }
}

function set(state: Reach): void {
  if (current.state === state) return;
  current = { state, since: Date.now() };
  for (const listener of listeners) listener();
}

/** Fold one request outcome into the belief. Exported for tests; the app wires it once. */
export function record(outcome: Outcome, _budget?: Budget): void {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    consecutiveFailures = 0;
    set("unreachable");
    return;
  }

  if (outcome === "ok") {
    // The strongest evidence available, and the only thing that clears a verdict. Something
    // answered inside its budget, which is the definition of the connection working.
    consecutiveFailures = 0;
    set("healthy");
    return;
  }

  if (outcome === "stalled") {
    consecutiveFailures = 0;
    set("degraded");
    return;
  }

  consecutiveFailures += 1;
  if (consecutiveFailures >= FAILURES_BEFORE_DEGRADED || platformSaysSlow()) set("degraded");
}

/**
 * Start listening. Idempotent, and returns a function that stops.
 *
 * Wired from a component rather than at module load so that importing this file has no effect —
 * it is imported by the service worker's tests and by server-rendered modules, neither of which
 * should acquire a `window` listener as a side effect.
 */
let started = 0;
let stopObserving: (() => void) | null = null;

export function startWatching(): () => void {
  started += 1;

  if (started === 1) {
    stopObserving = observeNetwork(record);

    if (typeof window !== "undefined") {
      // `offline` is conclusive and worth acting on immediately; `online` only means an
      // interface came back, so it clears the verdict to `healthy` and lets the next real
      // request decide. Believing `online` outright is what put the app here in the first place.
      window.addEventListener("offline", handleOffline);
      window.addEventListener("online", handleOnline);
    }
  }

  return () => {
    started -= 1;
    if (started > 0) return;
    stopObserving?.();
    stopObserving = null;
    if (typeof window !== "undefined") {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    }
  };
}

function handleOffline() {
  consecutiveFailures = 0;
  set("unreachable");
}

function handleOnline() {
  consecutiveFailures = 0;
  set("healthy");
}

/** `useSyncExternalStore` wiring. */
export const reachabilityStore = {
  subscribe(onChange: () => void): () => void {
    listeners.add(onChange);
    return () => listeners.delete(onChange);
  },
  getSnapshot(): Reachability {
    return current;
  },
  /**
   * The server has no opinion about a browser's connection, and rendering one would be a
   * hydration mismatch on every page — so it renders the neutral state and the real answer
   * arrives on hydration, the same shape `OfflineRecovery` uses for the same reason (D-158).
   */
  getServerSnapshot(): Reachability {
    return INITIAL;
  },
};

/** Test seam. Nothing in the app calls this. */
export function resetReachability(): void {
  current = INITIAL;
  consecutiveFailures = 0;
  for (const listener of listeners) listener();
}
