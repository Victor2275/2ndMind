import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = path.join(__dirname, "..", "..", "..", "..");
const template = readFileSync(path.join(root, "src", "lib", "pwa", "sw-template.js"), "utf8");

/**
 * Comments in that file explain at length what it deliberately does *not* do, and name the
 * very APIs these tests check for. Asserting against the raw text therefore fails on the
 * prose rather than the code.
 */
const code = template.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

/**
 * The service worker is the one file in this app that can put private data on disk and keep
 * it there after sign-out. It is also plain JavaScript running in a worker, so none of the
 * project's usual guardrails reach it: no server-only import to trip, no DAL to go through,
 * no type error when it caches the wrong thing.
 *
 * These tests are the substitute. They are deliberately blunt — they read the source — because
 * what they are defending is a policy, not a behaviour, and the way it gets broken is somebody
 * adding a plausible-looking cache rule in six weeks.
 */
describe("the service worker's caching policy", () => {
  it("keeps the build stamp placeholder the generator depends on", () => {
    // scripts/build-sw.mjs throws if this is missing rather than silently shipping an
    // unstamped worker, but a failure at deploy time is worse than one here.
    expect(template).toContain("__BUILD_ID__");
  });

  it("precaches only the two public static pages", () => {
    // The offline apology and the app shell (§2.1). Both are static and hold no data — every
    // value the shell shows is read from IndexedDB in the browser. A third `cache.add` here
    // is the thing to look at hard.
    const added = [...code.matchAll(/cache\.add\w*\(/g)];
    expect(added).toHaveLength(2);
    expect(code).toContain('const OFFLINE_URL = "/offline"');
    expect(code).toContain('const SHELL_URL = "/cached"');
  });

  it("warms only content-hashed build assets, never a page", () => {
    // The shell's own scripts, scraped from its HTML, so it can hydrate with no network.
    // Anything matched here is written to the cache, so the pattern must not be able to catch
    // a document URL.
    const pattern = code.match(/html\.match\(([^)]+)\)/)?.[1] ?? "";
    // Written with escaped slashes, being a regex literal in the source.
    expect(pattern).toContain(String.raw`\/_next\/static\/`);
    expect(pattern).not.toContain("/private");
  });

  it("names a private route only to route it, never to cache it", () => {
    // The worker has to recognise a failed /private navigation to hand over the shell (§2.1).
    // What it must never do is write a private *response* to disk — that survives sign-out and
    // is real personal data. So: the path may be read, and must not reach a cache write.
    const writes = [...code.matchAll(/cache\.put\(([^;]*)\)/g)].map((m) => m[1]);
    expect(writes.length).toBeGreaterThan(0);
    for (const write of writes) expect(write).not.toContain("/private");

    // Three mentions, all reads: two in the navigation branch choosing a fallback page, and
    // one filtering the sitemap before anything from it is written to disk (§2.2).
    const mentions = [...code.matchAll(/["'`]\/private/g)];
    expect(mentions.length).toBeLessThanOrEqual(3);
  });

  it("only ever caches GET", () => {
    // A cached or replayed POST is a duplicated mutation. Server Actions are POSTs.
    expect(code).toContain('request.method !== "GET"');
  });

  it("does not skip waiting on install", () => {
    // skipWaiting() inside `install` swaps the app's code out from under whatever is on
    // screen. The whole update prompt exists so that only happens when the user says so.
    const installBlock = code.slice(
      code.indexOf('addEventListener("install"'),
      code.indexOf('addEventListener("activate"'),
    );
    expect(installBlock).not.toContain("skipWaiting");
  });

  it("restricts runtime caching to content-hashed assets and icons", () => {
    const paths = [...code.matchAll(/url\.pathname\.startsWith\("([^"]+)"\)/g)].map(
      (match) => match[1],
    );
    // `/private/` appears among these because the navigation branch reads it to choose a
    // fallback page; it is a routing decision and never a `cache.put`, which the test above
    // pins separately.
    expect(new Set(paths)).toEqual(new Set(["/_next/static/", "/icons/", "/private/"]));
  });

  it("ignores other origins", () => {
    expect(code).toContain("url.origin !== self.location.origin");
  });
});
