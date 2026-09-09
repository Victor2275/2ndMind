// @vitest-environment node
import { describe, expect, it } from "vitest";

import { BUDGET } from "@/lib/net/deadline";
import { shrinkBudgets, WORKER_SOURCE } from "@/test/worker";

/**
 * The worker's deadlines and the app's are the same numbers, written twice (Phase N1).
 *
 * A service worker is a standalone script loaded by URL: it has no module graph, so it cannot
 * import `lib/net/deadline.ts` and has to carry its own copy. That is the one place in Phase N
 * where two sources of truth exist, and the way it fails is quiet — someone tunes the navigation
 * budget after a real measurement, the app changes and the worker does not, and the two halves
 * of the same fallback disagree about when a connection is stalled.
 *
 * So the duplication is allowed and checked, rather than argued about.
 */

/** The worker's `BUDGET` object literal, read out of its source. */
function workerBudgets(): Record<string, number> {
  const block = WORKER_SOURCE.match(/const BUDGET = \{([^}]*)\};/);
  if (!block) throw new Error("no BUDGET object found in sw-template.js");

  const budgets: Record<string, number> = {};
  for (const [, key, value] of block[1].matchAll(/(\w+):\s*(\d+)/g)) {
    budgets[key] = Number(value);
  }
  return budgets;
}

describe("the worker's deadline budgets", () => {
  it("names the four kinds of request it makes", () => {
    // The positive control. Every assertion below is a loop over whatever this parser found,
    // so a parser that quietly matched nothing would make the whole file pass while checking
    // nothing at all.
    expect(Object.keys(workerBudgets()).sort()).toEqual(["asset", "navigation", "report", "rsc"]);
  });

  it("agrees with lib/net/deadline.ts on every one of them", () => {
    for (const [key, value] of Object.entries(workerBudgets())) {
      expect(BUDGET[key as keyof typeof BUDGET], `budget "${key}" has drifted`).toBe(value);
    }
  });

  it("does not carry a budget the app does not know about", () => {
    for (const key of Object.keys(workerBudgets())) {
      expect(Object.keys(BUDGET)).toContain(key);
    }
  });

  it("stays rewritable by the tests that need a stall in milliseconds", () => {
    // `shrinkBudgets` throws when its pattern stops matching, and several test files depend on
    // it. Asserting it here means the failure names this contract instead of surfacing as an
    // unrelated file suddenly taking three seconds per test.
    expect(() => shrinkBudgets(WORKER_SOURCE, 25)).not.toThrow();
    expect(shrinkBudgets(WORKER_SOURCE, 25)).toContain("navigation: 25");
  });
});
