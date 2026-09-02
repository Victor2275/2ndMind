// @vitest-environment node
import fs from "node:fs";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The navigation fallback, actually executed (D-157).
 *
 * `sw-template.test.ts` asserts on the *source text* — which is the right tool for "never
 * caches a private route", a property about what the file says. It is the wrong tool for
 * anything about what the worker does, and this is the path where that distinction cost
 * something: on 2026-09-03 the installed app landed on the offline page while online, and the
 * page it landed on had no retry, no way back, and a heading that blamed the network.
 *
 * So this file loads the worker into a sandbox and runs its fetch handler against fakes. The
 * retry is one line and is invisible in every other kind of test.
 */

const SOURCE = fs
  .readFileSync(path.join(process.cwd(), "src/lib/pwa/sw-template.js"), "utf8")
  .replace("__BUILD_ID__", "test");

const ORIGIN = "https://victorgusev.com";

type Handler = (event: FetchEventLike) => void;
type FetchEventLike = {
  request: { method: string; mode: string; url: string };
  respondWith: (response: Promise<Response>) => void;
};

/** Loads the worker with its globals replaced, and hands back the handlers it registered. */
function load(options: { fetch: typeof globalThis.fetch; offlineHtml?: string | null }) {
  const handlers = new Map<string, Handler>();

  const self = {
    addEventListener: (type: string, handler: Handler) => handlers.set(type, handler),
    location: { origin: ORIGIN },
    clients: { claim: async () => {} },
    skipWaiting: () => {},
  };

  const cache = {
    match: async (url: string) =>
      url === "/offline" && options.offlineHtml !== null
        ? new Response(options.offlineHtml ?? "<html><head></head><body>offline</body></html>", {
            headers: { "content-type": "text/html" },
          })
        : undefined,
    put: async () => {},
    add: async () => {},
  };

  const caches = { open: async () => cache, keys: async () => [], delete: async () => true };

  // The worker is a script, not a module — this is how it gets loaded with its globals
  // replaced by fakes.
  new Function("self", "caches", "fetch", SOURCE)(self, caches, options.fetch);

  return handlers;
}

function navigateTo(pathname: string): {
  event: FetchEventLike;
  response: () => Promise<Response>;
} {
  let promise: Promise<Response> | null = null;
  return {
    event: {
      request: { method: "GET", mode: "navigate", url: `${ORIGIN}${pathname}` },
      respondWith: (value) => {
        promise = value;
      },
    },
    response: async () => {
      if (!promise) throw new Error("the worker never responded to the navigation");
      return promise;
    },
  };
}

let attempts: number;

beforeEach(() => {
  attempts = 0;
});

/** Fails the first `failures` requests, then succeeds. */
const flaky = (failures: number) =>
  vi.fn(async () => {
    attempts += 1;
    if (attempts <= failures) throw new TypeError("Failed to fetch");
    return new Response("the page", { status: 200 });
  }) as unknown as typeof globalThis.fetch;

describe("a navigation that fails once", () => {
  it("retries, and serves the page rather than the offline screen", async () => {
    // The reported symptom: one dropped request on a phone that is online. Without the retry
    // this lands on a dead-end page claiming there is no signal.
    const handlers = load({ fetch: flaky(1) });
    const { event, response } = navigateTo("/private/log");

    handlers.get("fetch")!(event);
    const result = await response();

    expect(attempts).toBe(2);
    expect(result.status).toBe(200);
    expect(await result.text()).toBe("the page");
  });

  it("does not retry when the first attempt works", async () => {
    const handlers = load({ fetch: flaky(0) });
    const { event, response } = navigateTo("/private/log");

    handlers.get("fetch")!(event);
    await response();

    expect(attempts).toBe(1);
  });
});

describe("a navigation that keeps failing", () => {
  it("gives up after exactly two attempts", async () => {
    // Two, not a loop: a phone with no signal must not sit there retrying while the user
    // waits for something to appear.
    const handlers = load({ fetch: flaky(99) });
    const { event, response } = navigateTo("/private/log");

    handlers.get("fetch")!(event);
    await response();

    expect(attempts).toBe(2);
  });

  it("tells the offline page which path failed, so Retry goes back to it", async () => {
    const handlers = load({ fetch: flaky(99) });
    const { event, response } = navigateTo("/private/log");

    handlers.get("fetch")!(event);
    const html = await (await response()).text();

    expect(html).toContain("/offline?from=");
    expect(html).toContain(encodeURIComponent("/private/log"));
  });

  it("carries the query string too", async () => {
    const handlers = load({ fetch: flaky(99) });
    const { event, response } = navigateTo("/private/log?q=squat");

    handlers.get("fetch")!(event);
    const html = await (await response()).text();

    expect(html).toContain(encodeURIComponent("/private/log?q=squat"));
  });

  it("still answers when the offline page was never cached", async () => {
    // A worker that installed before the offline page existed, or a cache eviction. Returning
    // nothing here would leave the tab on a browser error page instead of anything of ours.
    const handlers = load({ fetch: flaky(99), offlineHtml: null });
    const { event, response } = navigateTo("/private/log");

    handlers.get("fetch")!(event);
    const result = await response();

    expect(result.status).toBe(503);
  });
});

describe("what it leaves alone", () => {
  it("never touches a POST, because a replayed Server Action is worse than a failed one", () => {
    const handlers = load({ fetch: flaky(99) });
    let responded = false;
    handlers.get("fetch")!({
      request: { method: "POST", mode: "navigate", url: `${ORIGIN}/private/log` },
      respondWith: () => {
        responded = true;
      },
    });

    expect(responded).toBe(false);
  });

  it("never touches another origin", () => {
    const handlers = load({ fetch: flaky(99) });
    let responded = false;
    handlers.get("fetch")!({
      request: { method: "GET", mode: "navigate", url: "https://fonts.googleapis.com/x" },
      respondWith: () => {
        responded = true;
      },
    });

    expect(responded).toBe(false);
  });

  it("leaves an RSC fetch to the network — it is not a navigation", () => {
    // The Log tab is a `<Link>`, so tapping it fetches an RSC payload rather than navigating.
    // If the worker started answering these, a stale payload would render as a stale page.
    const handlers = load({ fetch: flaky(99) });
    let responded = false;
    handlers.get("fetch")!({
      request: { method: "GET", mode: "same-origin", url: `${ORIGIN}/private/log?_rsc=abc` },
      respondWith: () => {
        responded = true;
      },
    });

    expect(responded).toBe(false);
  });
});
