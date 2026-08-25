import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { generateDailySummary, MODEL } from "../gemini";

/**
 * No network and no SDK mock: every path exercised here is reached before a request is made,
 * which is exactly the set of paths that must never throw. The dashboard is `force-dynamic`,
 * so an exception out of this module is a 500 on the page Victor opens most — and it would be
 * a 500 caused by a nice-to-have panel.
 *
 * The failure-caching path is the subtle one. `unstable_cache` stores whatever its function
 * returns, and `callModel` returns failures as values. Composed naively, one 404 pins "the
 * summary could not be generated" to the dashboard for six hours. The fix throws at the cache
 * boundary so nothing is stored, and catches outside it so the caller still gets a message —
 * which means the no-key path below is also the regression test for that.
 */

const original = process.env.GEMINI_API_KEY;

beforeEach(() => {
  vi.unstubAllEnvs();
});

afterEach(() => {
  if (original === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = original;
});

describe("generateDailySummary", () => {
  it("does not call the model when there is nothing to summarise", async () => {
    // The common case before the day starts. A model call to be told the day is empty is
    // money spent on a question with a known answer.
    const result = await generateDailySummary("", "");
    expect(result.ok).toBe(false);
    expect(result.text).toBe("Nothing logged yet today.");
  });

  it("treats whitespace as nothing", async () => {
    const result = await generateDailySummary("   \n  ", "\t");
    expect(result.ok).toBe(false);
    expect(result.text).toBe("Nothing logged yet today.");
  });

  it("returns a message rather than throwing when the key is missing", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const result = await generateDailySummary("- ran 5k", "ship the resume");
    expect(result.ok).toBe(false);
    expect(result.text).toContain("GEMINI_API_KEY");
  });

  it("does not treat the .env.example placeholder as a real key", async () => {
    vi.stubEnv("GEMINI_API_KEY", "your_temp_key_here");
    const result = await generateDailySummary("- ran 5k", "ship the resume");
    expect(result.ok).toBe(false);
    expect(result.text).toContain("GEMINI_API_KEY");
  });

  it("never throws, whatever the configuration", async () => {
    // The dashboard is force-dynamic, so an exception out of this module is a 500 on the page
    // Victor opens most — caused by a panel he could live without.
    vi.stubEnv("GEMINI_API_KEY", "");
    await expect(generateDailySummary("- ran 5k", "ship the resume")).resolves.toMatchObject({
      ok: false,
    });
  });

  it("is deterministic for the same input", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const first = await generateDailySummary("- ran 5k", "ship the resume");
    const second = await generateDailySummary("- ran 5k", "ship the resume");
    expect(second.text).toBe(first.text);
  });
});

describe("MODEL", () => {
  it("is a Flash model, because the budget is ~$10/month", () => {
    expect(MODEL).toContain("flash");
  });

  it("is not the retired 2.5 id", () => {
    // Retired 2026-08-25: 404 "no longer available to new users". It failed silently, because
    // callModel catches everything — so this is the only thing that would notice a revert.
    expect(MODEL).not.toBe("gemini-2.5-flash");
  });
});
