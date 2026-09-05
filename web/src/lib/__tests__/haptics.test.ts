import { afterEach, describe, expect, it, vi } from "vitest";

import { buzz, buzzFailed, buzzSaved, FAILED, SAVED } from "@/lib/haptics";

/**
 * §3.3. The property worth a test rather than a comment: **a failure must never feel like a
 * save.** A missed buzz is an annoyance; a failed sync that feels like a successful one is an
 * entry nobody goes looking for.
 *
 * The rest is about not turning a nicety into an error — this API is absent on iOS, absent on
 * most desktops, and throws in some webviews.
 */
afterEach(() => {
  vi.unstubAllGlobals();
});

function withVibrate(impl: (pattern: number | number[]) => boolean) {
  const vibrate = vi.fn(impl);
  vi.stubGlobal("navigator", { vibrate });
  return vibrate;
}

describe("the two patterns", () => {
  it("cannot be confused with each other", () => {
    // Not just "different values" — different in count, length and rhythm, because this is felt
    // through a pocket rather than measured.
    expect(typeof SAVED).toBe("number");
    expect(Array.isArray(FAILED)).toBe(true);
    expect(FAILED.length).toBeGreaterThan(1);
    expect(Math.min(...FAILED.filter((_, i) => i % 2 === 0))).toBeGreaterThan(SAVED * 2);
  });

  it("sends the short one for a save and the long one for a failure", () => {
    const vibrate = withVibrate(() => true);
    buzzSaved();
    expect(vibrate).toHaveBeenLastCalledWith(SAVED);
    buzzFailed();
    expect(vibrate).toHaveBeenLastCalledWith(FAILED);
  });
});

describe("devices that will not buzz", () => {
  it("says no rather than throwing when the API is absent", () => {
    vi.stubGlobal("navigator", {});
    expect(buzzSaved()).toBe(false);
  });

  it("swallows a throwing implementation", () => {
    // Some embedded webviews expose `vibrate` and throw when it is called.
    withVibrate(() => {
      throw new Error("not allowed");
    });
    expect(() => buzzFailed()).not.toThrow();
    expect(buzzFailed()).toBe(false);
  });

  it("reports the device's own refusal without treating it as an error", () => {
    // Silent mode and focus modes return false. That is not a fault.
    withVibrate(() => false);
    expect(buzz(SAVED)).toBe(false);
  });
});
