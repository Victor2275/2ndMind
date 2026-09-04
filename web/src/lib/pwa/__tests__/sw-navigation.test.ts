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
function load(options: {
  fetch: typeof globalThis.fetch;
  offlineHtml?: string | null;
  /** The cached app shell (§2.1). Absent by default — a worker that installed before it. */
  shellHtml?: string | null;
  /** Public pages precached by §2.2, keyed by path. */
  pages?: Record<string, string>;
  onLine?: boolean;
}) {
  const handlers = new Map<string, Handler>();

  const self = {
    addEventListener: (type: string, handler: Handler) => handlers.set(type, handler),
    location: { origin: ORIGIN },
    navigator: { onLine: options.onLine ?? true },
    clients: { claim: async () => {} },
    skipWaiting: () => {},
  };

  const page = (html: string) => new Response(html, { headers: { "content-type": "text/html" } });

  const cache = {
    match: async (url: string) => {
      if (url === "/offline") {
        return options.offlineHtml === null
          ? undefined
          : page(options.offlineHtml ?? "<html><head></head><body>offline</body></html>");
      }
      if (url === "/cached") {
        return options.shellHtml == null
          ? undefined
          : page(options.shellHtml || "<html><head></head><body>shell</body></html>");
      }
      const precached = options.pages?.[url];
      return precached ? page(precached) : undefined;
    },
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

  it("does not retry with the radio off, so the offline page appears at once", async () => {
    // Reported 2026-09-04, the day after the retry landed: with no network the retry buys
    // nothing and doubles how long the screen sits blank. `onLine === false` is the one thing
    // that property can say conclusively, and it is all this needs.
    const handlers = load({ fetch: flaky(99), onLine: false });
    const { event, response } = navigateTo("/private/log");

    handlers.get("fetch")!(event);
    await response();

    expect(attempts).toBe(1);
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

describe("the cached app shell (§2.1)", () => {
  const shell = "<html><head></head><body>shell</body></html>";

  it("serves the shell for a private navigation, not the apology", async () => {
    // The whole point of §2.1. Before this, every /private navigation with no signal landed on
    // the offline page — while the local store held a day of tasks and a week of training that
    // no screen could reach.
    const handlers = load({ fetch: flaky(99), shellHtml: shell, onLine: false });
    const { event, response } = navigateTo("/private/athletics");

    handlers.get("fetch")!(event);
    const html = await (await response()).text();

    expect(html).toContain("shell");
    expect(html).toContain("/cached?from=");
    expect(html).toContain(encodeURIComponent("/private/athletics"));
  });

  it("keeps the public site on the offline page, which has something to say", async () => {
    // The portfolio is not mirrored anywhere — that is §2.2 — so the shell would have nothing
    // to render for it.
    const handlers = load({ fetch: flaky(99), shellHtml: shell, onLine: false });
    const { event, response } = navigateTo("/projects/proof");

    handlers.get("fetch")!(event);
    const html = await (await response()).text();

    expect(html).toContain("offline");
    expect(html).toContain("/offline?from=");
  });

  it("serves a navigation to the shell untouched, so its own query survives", async () => {
    // Its view links are plain navigations, and the URL they ask for is already the right one.
    // Rewriting it would turn `?from=/private/athletics` into `?from=/cached?from=...` and
    // every offline screen would render Today — the app working right up until you touched it.
    // Since §2.2 this takes the precached-page branch, which returns the document as itself.
    const handlers = load({ fetch: flaky(99), shellHtml: shell, onLine: false });
    const { event, response } = navigateTo("/cached?from=%2Fprivate%2Fathletics");

    handlers.get("fetch")!(event);
    const html = await (await response()).text();

    expect(html).toContain("shell");
    expect(html).not.toContain("replaceState");
  });

  it("serves a precached public page as itself, not as an apology", async () => {
    // §2.2. The portfolio, a project, a resume — the real page, only from disk.
    const handlers = load({
      fetch: flaky(99),
      shellHtml: shell,
      onLine: false,
      pages: { "/projects/proof": "<html><head></head><body>proof</body></html>" },
    });
    const { event, response } = navigateTo("/projects/proof");

    handlers.get("fetch")!(event);
    const html = await (await response()).text();

    expect(html).toContain("proof");
    expect(html).not.toContain("replaceState");
  });

  it("falls back to the offline page when the shell was never cached", async () => {
    // A worker that installed before the shell existed, or an install where its fetch failed.
    // Degrading to the old behaviour beats a blank tab.
    const handlers = load({ fetch: flaky(99), shellHtml: null, onLine: false });
    const { event, response } = navigateTo("/private");

    handlers.get("fetch")!(event);
    const html = await (await response()).text();

    expect(html).toContain("/offline?from=");
  });

  it("still prefers the network — the shell is a fallback, not a cache-first app", async () => {
    // Serving the shell when the server is reachable would show yesterday's data to someone
    // holding a working connection.
    const handlers = load({ fetch: flaky(0), shellHtml: shell });
    const { event, response } = navigateTo("/private");

    handlers.get("fetch")!(event);
    expect(await (await response()).text()).toBe("the page");
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
