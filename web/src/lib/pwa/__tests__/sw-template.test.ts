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

  it("precaches nothing except the public offline page", () => {
    const added = [...code.matchAll(/cache\.add\w*\(/g)];
    expect(added).toHaveLength(1);
    expect(code).toContain('const OFFLINE_URL = "/offline"');
  });

  it("never names a private route", () => {
    expect(code).not.toMatch(/["'`]\/private/);
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
    expect(new Set(paths)).toEqual(new Set(["/_next/static/", "/icons/"]));
  });

  it("ignores other origins", () => {
    expect(code).toContain("url.origin !== self.location.origin");
  });
});
