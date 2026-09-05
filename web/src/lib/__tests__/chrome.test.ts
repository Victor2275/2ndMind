import { describe, expect, it } from "vitest";

import { hasPublicChrome } from "@/lib/chrome";

describe("hasPublicChrome", () => {
  it("keeps the header and footer on every public route", () => {
    for (const path of [
      "/",
      "/now",
      "/projects",
      "/projects/proof",
      "/resume/robotics",
      "/signin",
      "/signin/register",
      "/offline",
    ]) {
      expect(hasPublicChrome(path), path).toBe(true);
    }
  });

  it("drops them across the private app", () => {
    for (const path of ["/private", "/private/log", "/private/athletics", "/private/work/tailor"]) {
      expect(hasPublicChrome(path), path).toBe(false);
    }
  });

  it("drops them on the offline shell, which is the private app with no network", () => {
    // Reported from the phone on 2026-09-05: in airplane mode the app opened wearing the
    // portfolio's header and no tab bar, and read as the public site. `/cached` is what the
    // service worker serves for a failed /private navigation, so it is the private app by
    // every measure except its path — and its path is outside /private only because
    // everything in there is force-dynamic (D-174).
    expect(hasPublicChrome("/cached")).toBe(false);
  });

  it("matches the segment, not the prefix", () => {
    // The naive `startsWith("/private")` swallows these. None exist today; the point is that a
    // route added later would silently lose its header, which is an annoying thing to debug.
    expect(hasPublicChrome("/privateer")).toBe(true);
    expect(hasPublicChrome("/private-beta")).toBe(true);
  });
});
