import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BUDGET, fetchWithDeadline } from "@/lib/net/deadline";
import {
  reachabilityStore,
  record,
  resetReachability,
  startWatching,
} from "@/lib/net/reachability";

/**
 * What the app believes about the connection (Phase N7).
 *
 * The property that matters is the one `navigator.onLine` gets wrong: a connection that is up
 * and answering nothing must read as **degraded**, not healthy. Everything else here is about
 * not crying wolf — a single dropped request is the blip D-157 already handles, and treating it
 * as a verdict is how the app ends up claiming to be offline while it is online.
 */

const online = (value: boolean) =>
  vi.stubGlobal("navigator", { onLine: value, connection: undefined });

beforeEach(() => {
  resetReachability();
  online(true);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const state = () => reachabilityStore.getSnapshot().state;

describe("what counts as evidence", () => {
  it("calls one stall degraded, because three seconds of silence is not a blip", () => {
    record("stalled");
    expect(state()).toBe("degraded");
  });

  it("does not call a single fast failure anything", () => {
    // The case D-157 exists for: one dropped request on a phone that is online. Treating it as
    // a verdict put the installed app on a dead-end page blaming the network.
    record("failed");
    expect(state()).toBe("healthy");
  });

  it("calls two consecutive fast failures degraded", () => {
    record("failed");
    record("failed");
    expect(state()).toBe("degraded");
  });

  it("clears on a single success — something answered, which settles it", () => {
    record("stalled");
    expect(state()).toBe("degraded");
    record("ok");
    expect(state()).toBe("healthy");
  });

  it("does not let old failures accumulate across a success", () => {
    record("failed");
    record("ok");
    record("failed");
    expect(state()).toBe("healthy");
  });
});

describe("navigator.onLine", () => {
  it("is believed when it says false, which is the one thing it knows", () => {
    online(false);
    record("failed");
    expect(state()).toBe("unreachable");
  });

  it("is ignored when it says true — that is what plane wifi reports", () => {
    // The whole reason this module exists. `onLine` is true here and the requests are stalling;
    // the app has to believe the requests.
    online(true);
    record("stalled");
    expect(state()).toBe("degraded");
  });
});

describe("the platform's own hint", () => {
  it("lowers the bar to one failure when the radio says the connection is bad", () => {
    vi.stubGlobal("navigator", { onLine: true, connection: { effectiveType: "2g" } });
    record("failed");
    expect(state()).toBe("degraded");
  });

  it("is not required — the default path works where the API does not exist", () => {
    // Absent on iOS Safari. Anything that depended on it would be a feature that silently does
    // not exist on half the devices this app runs on.
    vi.stubGlobal("navigator", { onLine: true });
    record("failed");
    expect(state()).toBe("healthy");
    record("failed");
    expect(state()).toBe("degraded");
  });

  it("survives a connection object that throws on access", () => {
    vi.stubGlobal("navigator", {
      onLine: true,
      get connection() {
        throw new Error("blocked");
      },
    });
    expect(() => record("failed")).not.toThrow();
  });
});

describe("wiring", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("learns from real requests without anything having to report them", async () => {
    // The seam that makes this honest: reachability is a by-product of requests the app was
    // making anyway. It never probes, because a health check is one more request competing for
    // the same stalled pipe.
    const stop = startWatching();
    const original = BUDGET.navigation;
    (BUDGET as Record<string, number>).navigation = 20;

    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_input: RequestInfo | URL, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => reject(init.signal!.reason));
          }),
      ),
    );

    await fetchWithDeadline("/private", {}, "navigation").catch(() => {});

    expect(state()).toBe("degraded");

    (BUDGET as Record<string, number>).navigation = original;
    stop();
  });

  it("notifies subscribers when the belief changes, and only then", () => {
    const stop = startWatching();
    const seen = vi.fn();
    const unsubscribe = reachabilityStore.subscribe(seen);

    record("stalled");
    expect(seen).toHaveBeenCalledTimes(1);

    // Already degraded. Re-announcing would make the UI flicker on every failed request.
    record("stalled");
    expect(seen).toHaveBeenCalledTimes(1);

    record("ok");
    expect(seen).toHaveBeenCalledTimes(2);

    unsubscribe();
    stop();
  });

  it("stops listening once every caller has stopped", () => {
    const first = startWatching();
    const second = startWatching();

    first();
    // Still watching: one caller remains, and a shared store that unhooked on the first
    // unmount would silently stop working the moment two screens used it.
    record("stalled");
    expect(state()).toBe("degraded");

    second();
  });
});
