import { afterEach, describe, expect, it, vi } from "vitest";

import {
  BUDGET,
  fetchWithDeadline,
  isDeadline,
  observeNetwork,
  type Outcome,
} from "@/lib/net/deadline";

/**
 * The deadline helper (Phase N1).
 *
 * The property under test is the one the whole phase rests on: **a request that stalls must
 * reject.** Every fallback in this app is a `catch`, and before this file a stall never
 * reached one — which is why the app froze rather than falling back.
 *
 * Real timers, with budgets stubbed down to milliseconds rather than faked. `AbortSignal.timeout`
 * is scheduled by the platform, not by `setTimeout` in this realm, so `vi.useFakeTimers()` does
 * not move it — a test written that way passes for the wrong reason and would keep passing if
 * the deadline were removed entirely.
 */

type FakeFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/**
 * A fetch that never answers — the stall this phase exists for.
 *
 * It honours the signal, which is not a detail: `fetchWithDeadline` does not race a timer
 * against the request, it hands `fetch` a signal and relies on the platform to reject when that
 * signal fires. A fake that ignored the signal would hang forever and prove nothing about the
 * helper, which is exactly what the first version of this file did.
 */
const stalls: FakeFetch = (_input, init) =>
  new Promise<Response>((_resolve, reject) => {
    const signal = init?.signal;
    if (!signal) return;
    if (signal.aborted) reject(signal.reason);
    signal.addEventListener("abort", () => reject(signal.reason));
  });

/** A fetch that rejects immediately, the way a request refused at the socket does. */
const refuses: FakeFetch = () => Promise.reject(new TypeError("Failed to fetch"));

function stubFetch(implementation: FakeFetch) {
  const spy = vi.fn(implementation);
  vi.stubGlobal("fetch", spy);
  return spy;
}

/** Shrinks a budget for the duration of one test, so a stall is provable in milliseconds. */
function shrink(budget: keyof typeof BUDGET, ms: number) {
  const original = BUDGET[budget];
  (BUDGET as Record<string, number>)[budget] = ms;
  return () => {
    (BUDGET as Record<string, number>)[budget] = original;
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchWithDeadline", () => {
  it("rejects a request that stalls, instead of waiting forever", async () => {
    const restore = shrink("navigation", 20);
    stubFetch(stalls);

    await expect(fetchWithDeadline("/private", {}, "navigation")).rejects.toSatisfy(isDeadline);
    restore();
  });

  it("lets a request that answers in time through untouched", async () => {
    stubFetch(async () => new Response("ok", { status: 200 }));

    const response = await fetchWithDeadline("/private");
    expect(response.status).toBe(200);
  });

  it("does not treat a 500 as a network failure", async () => {
    // A server answering is proof the connection works. Classifying this as a network problem
    // is how an app ends up claiming to be offline because one endpoint is broken.
    stubFetch(async () => new Response("boom", { status: 500 }));

    const outcomes: Outcome[] = [];
    const stop = observeNetwork((outcome) => outcomes.push(outcome));
    const response = await fetchWithDeadline("/api/sync", {}, "sync");
    stop();

    expect(response.status).toBe(500);
    expect(outcomes).toEqual(["ok"]);
  });

  it("still honours the caller's own signal", async () => {
    stubFetch(stalls);
    const controller = new AbortController();

    const pending = fetchWithDeadline("/private", { signal: controller.signal });
    controller.abort();

    await expect(pending).rejects.toThrow();
  });

  it("passes the caller's method and body through", async () => {
    const spy = stubFetch(async () => new Response(null, { status: 204 }));

    await fetchWithDeadline("/api/sync", { method: "POST", body: "{}" }, "sync");

    expect(spy).toHaveBeenCalledOnce();
    const init = spy.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(init.body).toBe("{}");
    expect(init.signal).toBeDefined();
  });
});

describe("isDeadline", () => {
  it("separates a stall from the caller giving up", async () => {
    // These have to stay distinguishable after `AbortSignal.any` merges them, because one is
    // evidence about the connection and the other is a component unmounting.
    const restore = shrink("navigation", 20);
    stubFetch(stalls);

    const controller = new AbortController();
    const stalled = fetchWithDeadline("/a", {}, "navigation").catch((error) => error);
    const aborted = fetchWithDeadline("/b", { signal: controller.signal }).catch((error) => error);
    controller.abort();

    expect(isDeadline(await stalled)).toBe(true);
    expect(isDeadline(await aborted)).toBe(false);
    restore();
  });

  it("does not mistake an ordinary failure for a stall", () => {
    expect(isDeadline(new TypeError("Failed to fetch"))).toBe(false);
  });
});

describe("observeNetwork", () => {
  it("reports a stall as evidence, and a refusal as something else", async () => {
    const restore = shrink("navigation", 20);
    const outcomes: Outcome[] = [];
    const stop = observeNetwork((outcome) => outcomes.push(outcome));

    stubFetch(stalls);
    await fetchWithDeadline("/a", {}, "navigation").catch(() => {});
    stubFetch(refuses);
    await fetchWithDeadline("/b", {}, "navigation").catch(() => {});

    stop();
    restore();
    expect(outcomes).toEqual(["stalled", "failed"]);
  });

  it("says nothing when the caller aborts", async () => {
    // A route change must not read as a network problem, or N7's banner fires on navigation.
    stubFetch(stalls);
    const outcomes: Outcome[] = [];
    const stop = observeNetwork((outcome) => outcomes.push(outcome));

    const controller = new AbortController();
    const pending = fetchWithDeadline("/a", { signal: controller.signal });
    controller.abort();
    await pending.catch(() => {});

    stop();
    expect(outcomes).toEqual([]);
  });

  it("unsubscribes, and survives an observer that throws", async () => {
    stubFetch(async () => new Response("ok"));
    const good: Outcome[] = [];
    const stopBad = observeNetwork(() => {
      throw new Error("observers are not allowed to break requests");
    });
    const stopGood = observeNetwork((outcome) => good.push(outcome));

    await expect(fetchWithDeadline("/a")).resolves.toBeInstanceOf(Response);
    expect(good).toEqual(["ok"]);

    stopGood();
    stopBad();
    await fetchWithDeadline("/a");
    expect(good).toEqual(["ok"]);
  });
});
