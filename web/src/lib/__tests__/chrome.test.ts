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

  it("matches the segment, not the prefix", () => {
    // The naive `startsWith("/private")` swallows these. None exist today; the point is that a
    // route added later would silently lose its header, which is an annoying thing to debug.
    expect(hasPublicChrome("/privateer")).toBe(true);
    expect(hasPublicChrome("/private-beta")).toBe(true);
  });
});
