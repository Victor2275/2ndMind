/**
 * Every network call gets a deadline (V4 Phase N, `docs/DEGRADED_NETWORK.md` §5 N1).
 *
 * ## The bug this exists for
 *
 * `fetch()` has no default timeout. A request that connects and then stalls — plane wifi, a
 * congested cell, a captive portal that answers the handshake and nothing else — waits
 * indefinitely and never rejects. The app's entire offline story is `try`/`catch`, and a
 * `catch` only runs on a rejection, so **every fallback in the app is unreachable in exactly
 * the condition it was written for.** The screen does not fall back; it hangs.
 *
 * `navigator.onLine` is no help and is worse than none: on plane wifi it is `true`. The one
 * signal the app consulted actively lies about the one case that matters.
 *
 * A deadline is what converts that stall into a rejection, which is what makes every `catch`
 * already in the codebase start working.
 *
 * ## Deadlines are not short timeouts
 *
 * The failure mode to avoid is turning "slow but working" into "broken". A 1s budget on a
 * genuinely slow connection fails requests that would have succeeded, and the user loses a
 * feature to gain a spinner. The budgets below are therefore generous and sized per call —
 * the fix is falling back *well*, not failing *sooner*.
 */

/**
 * How long each kind of call may take before it is treated as stalled.
 *
 * Named rather than scattered so they can be reasoned about together, and so the service
 * worker's copies can be pinned to them by a test — the worker is a standalone script and
 * cannot import this file, which is the one place these numbers can silently drift.
 *
 * Starting values from `DEGRADED_NETWORK.md` §5, chosen by argument rather than measurement:
 *
 * - `navigation` / `rsc` — 3s. A document that has not started arriving in three seconds is
 *   not going to feel like a navigation whatever happens next, and the fallback is a cached
 *   shell that renders instantly from IndexedDB. Waiting longer buys a marginally fresher
 *   page at the cost of the app appearing dead.
 * - `sync` — 10s, much longer on purpose. A flush can legitimately carry 100 ops and the
 *   server has to apply them all; failing that at 3s would abandon batches that were working
 *   and drive them into backoff. Nobody is watching a flush, so slow is cheap here.
 * - `report` — 5s. Error reporting is fire-and-forget and must never be the reason a screen
 *   waits, but it is also the only record of a phone that is failing, so it gets more room
 *   than a navigation.
 * - `asset` — 10s, and **used only by the service worker**. It covers precaching: scripts,
 *   images, and the dozen public pages warmed during `activate`. Nobody is waiting on any of
 *   it, so it is allowed to be slow — but not allowed to be infinite, because a stalled
 *   precache holds `activate` open forever and the worker never takes over.
 */
export const BUDGET = {
  navigation: 3_000,
  rsc: 3_000,
  sync: 10_000,
  report: 5_000,
  asset: 10_000,
} as const;

export type Budget = keyof typeof BUDGET;

/**
 * Did this failure come from our deadline, or from something else?
 *
 * Worth keeping separable. A fired deadline is *evidence about the connection* and is what
 * `lib/net/reachability.ts` counts; a caller aborting because the user navigated away is not,
 * and counting it would make every route change look like a network problem. `AbortSignal.timeout`
 * rejects with a `TimeoutError` and a caller's own `abort()` with an `AbortError`, and
 * `AbortSignal.any` adopts the reason of whichever fired — so the two stay distinguishable
 * after they are combined.
 */
export function isDeadline(error: unknown): boolean {
  return error instanceof Error && error.name === "TimeoutError";
}

/** What a completed attempt tells us about the connection. */
export type Outcome = "ok" | "stalled" | "failed";

type Observer = (outcome: Outcome, budget: Budget) => void;

const observers = new Set<Observer>();

/**
 * Watch what actually happens to requests.
 *
 * This is the seam N7's reachability signal is built on, and it lives here because this is the
 * only place that knows the difference between a request that answered, one that ran out of
 * time, and one that was refused outright. Call sites stay unchanged — they ask for a fetch
 * and the evidence falls out of it.
 *
 * @returns a function that unsubscribes.
 */
export function observeNetwork(observer: Observer): () => void {
  observers.add(observer);
  return () => observers.delete(observer);
}

function announce(outcome: Outcome, budget: Budget): void {
  // An observer that throws must not turn a working request into a failed one.
  for (const observer of observers) {
    try {
      observer(outcome, budget);
    } catch {
      // Nothing to do, and nowhere useful to say it.
    }
  }
}

/**
 * `fetch`, with a deadline and with the outcome recorded.
 *
 * The caller's own `signal` is honoured as well as the deadline: `AbortSignal.any` fires on
 * whichever comes first, so a component that unmounts still cancels its request and a stall
 * still ends.
 *
 * A non-OK *response* is not a failure here. A 500 is the server talking, which is proof the
 * connection works — classifying it as a network problem is how an app ends up claiming to be
 * offline because one endpoint is broken.
 */
export async function fetchWithDeadline(
  input: RequestInfo | URL,
  init: RequestInit = {},
  budget: Budget = "navigation",
): Promise<Response> {
  const deadline = AbortSignal.timeout(BUDGET[budget]);
  const signal = init.signal ? AbortSignal.any([deadline, init.signal]) : deadline;

  try {
    const response = await fetch(input, { ...init, signal });
    announce("ok", budget);
    return response;
  } catch (error) {
    // A caller's own abort says nothing about the network and is deliberately not announced.
    if (isDeadline(error)) announce("stalled", budget);
    else if (!(error instanceof Error && error.name === "AbortError")) announce("failed", budget);
    throw error;
  }
}
