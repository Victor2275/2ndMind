// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { fakeCache, loadWorker, ORIGIN, pathOf } from "@/test/worker";

/**
 * The worker on a connection that is bad but not gone (Phase N2 and N3).
 *
 * Every other worker test in this directory stages a connection that is *off*: `fetch` rejects,
 * a `catch` runs, a fallback appears. That is the easy case, and it was the only one covered —
 * which is why the app could pass all of them and still freeze on plane wifi.
 *
 * The case here is the one that was missing: a request that connects and then **never answers**.
 * Before Phase N nothing in the app could distinguish that from a slow success, because
 * `fetch()` has no default timeout and the promise simply never settled. No `catch` ran, so no
 * fallback ran, and the screen sat on a skeleton indefinitely.
 *
 * `stalls()` below is that connection. If a test in this file hangs rather than fails, the
 * deadline it was written for has been removed.
 */

/** How long the worker's budgets are shrunk to. Long enough not to be flaky, short enough to run. */
const BUDGET_MS = 40;

type FetchEventLike = {
  request: { method: string; mode: string; url: string; headers: Headers };
  respondWith: (response: Promise<Response>) => void;
  waitUntil?: (promise: Promise<unknown>) => void;
};

/**
 * A connection that accepts the request and then says nothing — plane wifi, a congested cell,
 * a captive portal that completes the handshake and drops the rest.
 *
 * It honours the abort signal, which is the whole mechanism under test: the worker does not race
 * a timer against the response, it hands `fetch` a signal and relies on the platform to reject.
 */
function stalling() {
  let calls = 0;
  const fetch = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
    calls += 1;
    return new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal;
      if (!signal) return;
      signal.addEventListener("abort", () => reject(signal.reason));
    });
  });
  return { fetch: fetch as unknown as typeof globalThis.fetch, calls: () => calls };
}

/** A connection that refuses instantly, the way a dropped radio does. */
function refusing() {
  let calls = 0;
  const fetch = vi.fn(async () => {
    calls += 1;
    throw new TypeError("Failed to fetch");
  });
  return { fetch: fetch as unknown as typeof globalThis.fetch, calls: () => calls };
}

function navigation(pathname: string) {
  let promise: Promise<Response> | null = null;
  const background: Promise<unknown>[] = [];
  const event: FetchEventLike = {
    request: {
      method: "GET",
      mode: "navigate",
      url: `${ORIGIN}${pathname}`,
      headers: new Headers(),
    },
    respondWith: (value) => {
      promise = value;
    },
    waitUntil: (value) => background.push(value),
  };
  return {
    event,
    background,
    response: async () => {
      if (!promise) throw new Error("the worker never responded");
      return promise;
    },
  };
}

function rscRequest(pathname: string) {
  let promise: Promise<Response> | null = null;
  return {
    event: {
      request: {
        method: "GET",
        mode: "same-origin",
        url: `${ORIGIN}${pathname}`,
        headers: new Headers({ RSC: "1" }),
      },
      respondWith: (value: Promise<Response>) => {
        promise = value;
      },
    } as FetchEventLike,
    response: async () => {
      if (!promise) throw new Error("the worker never responded");
      return promise;
    },
  };
}

const SHELL = "<html><head></head><body>shell</body></html>";

describe("a navigation that stalls", () => {
  it("gives up and serves the shell, instead of hanging forever", async () => {
    // The report, in one test. Before Phase N this promise never settled and the tab showed
    // nothing at all — not the offline page, not the shell, not an error. Just the last screen,
    // frozen.
    const network = stalling();
    const handlers = loadWorker({
      fetch: network.fetch,
      cache: fakeCache({ "/cached": SHELL, "/offline": "offline" }),
      budgetMs: BUDGET_MS,
    });
    const { event, response } = navigation("/private/athletics");

    handlers.get("fetch")!(event);
    const html = await (await response()).text();

    expect(html).toContain("shell");
    expect(html).toContain(encodeURIComponent("/private/athletics"));
  });

  it("does not retry a stall — the budget is spent, not the problem", async () => {
    // The retry from D-157 is for a *fast* failure: one dropped request, which usually succeeds
    // on the next attempt. Retrying a stall doubles how long the screen is blank and then shows
    // the same fallback. Until Phase N this was backwards: a stall was the only failure that
    // never rejected, so it was effectively retried forever.
    const network = stalling();
    const handlers = loadWorker({
      fetch: network.fetch,
      cache: fakeCache({ "/cached": SHELL, "/offline": "offline" }),
      budgetMs: BUDGET_MS,
    });
    const { event, response } = navigation("/private/athletics");

    handlers.get("fetch")!(event);
    await response();

    expect(network.calls()).toBe(1);
  });

  it("still retries a fast rejection, which is the case the retry was written for", async () => {
    // The other side of the same rule, so the fix cannot be read as "stop retrying".
    const network = refusing();
    const handlers = loadWorker({
      fetch: network.fetch,
      cache: fakeCache({ "/cached": SHELL, "/offline": "offline" }),
      budgetMs: BUDGET_MS,
    });
    const { event, response } = navigation("/private/athletics");

    handlers.get("fetch")!(event);
    await response();

    expect(network.calls()).toBe(2);
  });

  it("answers well inside the time a person would call frozen", async () => {
    const network = stalling();
    const handlers = loadWorker({
      fetch: network.fetch,
      cache: fakeCache({ "/cached": SHELL, "/offline": "offline" }),
      budgetMs: BUDGET_MS,
    });
    const { event, response } = navigation("/private");

    const started = Date.now();
    handlers.get("fetch")!(event);
    await response();

    // Generous, because this asserts a bound rather than a duration. The point is that it is
    // bounded at all — the value before Phase N was infinity.
    expect(Date.now() - started).toBeLessThan(BUDGET_MS * 20);
  });
});

describe("a precached public page", () => {
  it("is served without waiting for the network at all", async () => {
    // Stale-while-revalidate. The cache name carries the build id, so a precached page is this
    // build's page and every public route is statically rendered — the round trip could only
    // ever confirm what is already on disk, and on a stalled connection it costs three seconds
    // of blank screen to do it.
    const network = stalling();
    const handlers = loadWorker({
      fetch: network.fetch,
      cache: fakeCache({ "/projects/proof": "<html><body>proof</body></html>" }),
      budgetMs: BUDGET_MS,
    });
    const { event, response } = navigation("/projects/proof");

    handlers.get("fetch")!(event);
    const html = await (await response()).text();

    expect(html).toContain("proof");
  });

  it("refreshes itself behind the response", async () => {
    const fetch = vi.fn(
      async (_input: RequestInfo | URL) => new Response("<html><body>fresher</body></html>"),
    );
    const cache = fakeCache({ "/projects/proof": "<html><body>proof</body></html>" });
    const handlers = loadWorker({
      fetch: fetch as unknown as typeof globalThis.fetch,
      cache,
      budgetMs: BUDGET_MS,
    });
    const { event, response, background } = navigation("/projects/proof");

    handlers.get("fetch")!(event);
    expect(await (await response()).text()).toContain("proof");

    await Promise.all(background);
    expect(cache.entries.get("/projects/proof")).toContain("fresher");
    expect(pathOf(fetch.mock.calls[0][0])).toBe("/projects/proof");
  });

  it("does not let a failed refresh replace what is on disk", async () => {
    const network = stalling();
    const cache = fakeCache({ "/projects/proof": "<html><body>proof</body></html>" });
    const handlers = loadWorker({ fetch: network.fetch, cache, budgetMs: BUDGET_MS });
    const { event, response, background } = navigation("/projects/proof");

    handlers.get("fetch")!(event);
    await response();
    await Promise.all(background);

    expect(cache.entries.get("/projects/proof")).toContain("proof");
  });

  it("never serves a private route from disk, however stalled the network is", async () => {
    // The rule the whole cache design rests on (§2.1). Nothing under /private is ever written
    // to Cache Storage, and stale-while-revalidate must not become the exception that starts.
    const network = stalling();
    const cache = fakeCache({
      "/cached": SHELL,
      "/offline": "offline",
      // Staged as if a bug had put one there, so the exclusion is tested rather than the
      // absence of a fixture.
      "/private/athletics": "<html><body>yesterday's training</body></html>",
    });
    const handlers = loadWorker({ fetch: network.fetch, cache, budgetMs: BUDGET_MS });
    const { event, response } = navigation("/private/athletics");

    handlers.get("fetch")!(event);
    const html = await (await response()).text();

    expect(html).not.toContain("yesterday's training");
    expect(html).toContain("shell");
  });
});

describe("an RSC payload that stalls (the tab-tap freeze)", () => {
  it("rejects on the deadline instead of leaving the router waiting", async () => {
    // Tapping a tab in the installed app fetches an RSC payload rather than navigating. Before
    // Phase N the worker ignored these entirely, so the fetch had no deadline, never settled,
    // and the screen sat on a skeleton with no error and no way out.
    //
    // Rejecting is the whole fix: the App Router abandons the client transition and performs a
    // hard navigation, which comes back to this worker as a navigation and lands on the shell.
    const network = stalling();
    const handlers = loadWorker({
      fetch: network.fetch,
      cache: fakeCache({ "/cached": SHELL }),
      budgetMs: BUDGET_MS,
    });
    const { event, response } = rscRequest("/private/log");

    handlers.get("fetch")!(event);

    await expect(response()).rejects.toThrow();
  });

  it("is not retried, and never answered from the cache", async () => {
    // An RSC payload is a private, per-request render. There is nothing on disk that could
    // stand in for one, and serving a stale payload would render as a stale page.
    const network = stalling();
    const handlers = loadWorker({
      fetch: network.fetch,
      cache: fakeCache({ "/private/log": "stale payload", "/cached": SHELL }),
      budgetMs: BUDGET_MS,
    });
    const { event, response } = rscRequest("/private/log");

    handlers.get("fetch")!(event);
    await response().catch(() => {});

    expect(network.calls()).toBe(1);
  });
});

describe("error reporting", () => {
  it("survives a stalled report, instead of being disabled for the life of the worker", async () => {
    // `reporting` is a guard against a report of a report, released in `finally`. A stalled POST
    // therefore used to leave it `true` forever — so the first failure on a bad connection
    // silently disabled every report after it, and the condition worth reporting from is exactly
    // the condition that broke reporting.
    //
    // Staged as two installs on one worker, because the guard is per-worker and what has to be
    // shown is that the second attempt is not swallowed by the first.
    const posts: string[] = [];
    const fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const path = pathOf(input);
      if (path === "/api/errors") {
        posts.push(path);
        // Never answers. Before the deadline this is where reporting died.
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal!.reason));
        });
      }
      // The offline page installs; the shell does not, which is what `install` reports about.
      if (path === "/cached") return Promise.reject(new TypeError("Failed to fetch"));
      return Promise.resolve(new Response("<html><head></head><body>ok</body></html>"));
    });

    const handlers = loadWorker({
      fetch: fetch as unknown as typeof globalThis.fetch,
      cache: fakeCache(),
      budgetMs: BUDGET_MS,
    });

    let pending: Promise<unknown> = Promise.resolve();
    const wait = { waitUntil: (p: Promise<unknown>) => (pending = p) };
    const install = handlers.get("install")!;

    install(wait);
    await pending.catch(() => {});
    expect(posts).toHaveLength(1);

    install(wait);
    await pending.catch(() => {});
    expect(posts).toHaveLength(2);
  });
});
