// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { loadWorker, ORIGIN, pathOf } from "@/test/worker";

/**
 * The public precache, executed (V3 §2.2).
 *
 * The list of pages is not written in the worker — it is read from `/sitemap.xml`, which the
 * app already generates from the vault. That is the right call and it moves the risk: the
 * worker now writes to disk whatever a fetched document tells it to. So the two things worth
 * running rather than reading are that it caches the pages the sitemap names, and that
 * **nothing under `/private` can be written even if it appears there** — a cached private
 * response would survive sign-out.
 */

function sitemap(paths: string[]): string {
  return `<?xml version="1.0"?><urlset>${paths
    .map((p) => `<loc>${ORIGIN}${p}</loc>`)
    .join("")}</urlset>`;
}

/** Loads the worker and runs its `activate` handler, returning what reached the cache. */
async function activate(options: { sitemap: string | null; html?: string }) {
  const written = new Map<string, string>();

  const cache = {
    match: async (request: unknown) => {
      const key = pathOf(request as RequestInfo);
      return written.has(key) ? new Response(written.get(key)) : undefined;
    },
    put: async (request: unknown, response: Response) => {
      written.set(pathOf(request as RequestInfo), await response.text());
    },
  };

  // Keyed by path rather than by identity: since Phase N the worker asks for these with a
  // `Request` carrying `cache: "reload"` instead of a bare string, which is the same request
  // by every measure this test cares about.
  const fetch = vi.fn(async (input: RequestInfo | URL) => {
    if (pathOf(input) === "/sitemap.xml") {
      return options.sitemap === null
        ? new Response("", { status: 404 })
        : new Response(options.sitemap);
    }
    return new Response(options.html ?? "<html><head></head><body>page</body></html>");
  }) as unknown as typeof globalThis.fetch;

  const handlers = loadWorker({ fetch, cache });

  let pending: Promise<unknown> = Promise.resolve();
  (
    handlers.get("activate") as unknown as (e: { waitUntil: (p: Promise<unknown>) => void }) => void
  )({ waitUntil: (p) => (pending = p) });
  await pending;

  return { written, fetch };
}

describe("what gets precached", () => {
  it("caches every page the sitemap names", async () => {
    const { written } = await activate({
      sitemap: sitemap(["/", "/now", "/projects", "/projects/proof", "/resume/robotics"]),
    });

    expect([...written.keys()].sort()).toEqual([
      "/",
      "/now",
      "/projects",
      "/projects/proof",
      "/resume/robotics",
    ]);
  });

  it("needs no code change when a project is added", async () => {
    // The whole reason the list is read rather than written. A hand-maintained array fails
    // silently: a project ships, nobody adds it, and it is missing from the one device that
    // needed it — a phone held up at a career fair with no signal.
    const { written } = await activate({ sitemap: sitemap(["/projects/a-brand-new-thing"]) });
    expect(written.has("/projects/a-brand-new-thing")).toBe(true);
  });

  it("takes the path from an absolute URL, so a preview deployment works too", async () => {
    // The sitemap carries production URLs. Caching by full URL would miss on every other host.
    const { written } = await activate({
      sitemap: `<urlset><loc>https://example.test/now</loc></urlset>`,
    });
    expect(written.has("/now")).toBe(true);
  });

  it("caches the scripts each page needs, once, not once per page", async () => {
    // Twelve pages share most of their chunks. Re-fetching them per page is a dozen times the
    // data on a phone that may be on a metered connection.
    const html = `<html><head><script src="/_next/static/chunks/shared.js"></script></head></html>`;
    const { written, fetch } = await activate({
      sitemap: sitemap(["/", "/now", "/projects"]),
      html,
    });

    expect(written.has("/_next/static/chunks/shared.js")).toBe(true);
    const assetFetches = vi
      .mocked(fetch)
      .mock.calls.filter(([input]) => pathOf(input).includes("shared.js"));
    expect(assetFetches).toHaveLength(1);
  });
});

describe("what it refuses to cache", () => {
  it("will not write a private path, even if the sitemap names one", async () => {
    // A cached private response survives sign-out and is real personal data. The sitemap is
    // public by construction, so this is belt and braces — which is the right amount of care
    // for the one file in the app that can put private data on disk and leave it there.
    const { written } = await activate({
      sitemap: sitemap(["/now", "/private", "/private/athletics"]),
    });

    expect(written.has("/now")).toBe(true);
    expect([...written.keys()].some((key) => key.startsWith("/private"))).toBe(false);
  });

  it("does nothing at all when the sitemap is missing", async () => {
    // An older deploy, or a fetch that failed. The app works without a public precache; only
    // the offline portfolio does not, and failing activation would cost far more.
    const { written } = await activate({ sitemap: null });
    expect(written.size).toBe(0);
  });

  it("survives a sitemap that is not XML", async () => {
    const { written } = await activate({ sitemap: "<html>not a sitemap</html>" });
    expect(written.size).toBe(0);
  });
});
