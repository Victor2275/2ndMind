// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { categoryByKey, CATEGORIES, stickyFields, type Category } from "@/lib/log/categories";
import { readSticky, resetStickyCache, stickyStore, writeSticky } from "@/lib/log/sticky";

/**
 * What the form remembers between entries.
 *
 * The safety property is tested first and hardest: **no measurement is ever sticky.** A
 * pre-filled `kind` that is stale is obvious; a pre-filled weight that is stale is a number in
 * the log that reads as measured, and nothing downstream can tell the difference. That rule
 * lives in `categories.ts` where it is one word per field and easy to add by accident, so it
 * is pinned here rather than trusted.
 */

const athletics = categoryByKey("athletics") as Category;
const work = categoryByKey("work") as Category;

function fakeStorage(options: { throws?: boolean; initial?: Record<string, string> } = {}) {
  const map = new Map(Object.entries(options.initial ?? {}));
  const guard = () => {
    if (options.throws) throw new DOMException("denied", "SecurityError");
  };
  return {
    map,
    storage: {
      get length() {
        return map.size;
      },
      clear: () => map.clear(),
      getItem: (k: string) => {
        guard();
        return map.get(k) ?? null;
      },
      key: (i: number) => [...map.keys()][i] ?? null,
      removeItem: (k: string) => {
        guard();
        map.delete(k);
      },
      setItem: (k: string, v: string) => {
        guard();
        map.set(k, v);
      },
    } as Storage,
  };
}

beforeEach(() => resetStickyCache());
afterEach(() => vi.unstubAllGlobals());

describe("what is allowed to stick", () => {
  it("never marks a measurement sticky, in any category", () => {
    // The whole rule, in one assertion. Adding `sticky: true` to a number field is a one-word
    // change that would silently start pre-filling weights, and this is what catches it.
    const measurements = new Set(["number", "distance", "duration", "scale"]);

    for (const category of CATEGORIES) {
      for (const field of stickyFields(category)) {
        expect(
          measurements.has(field.type),
          `${category.key}.${field.name} is a ${field.type} and must not be sticky`,
        ).toBe(false);
      }
    }
  });

  it("sticks the context fields that actually repeat", () => {
    expect(stickyFields(athletics).map((f) => f.name)).toEqual(["kind"]);
    expect(stickyFields(work).map((f) => f.name)).toEqual(["action", "effort"]);
  });
});

describe("reading and writing", () => {
  it("round-trips a sticky field", () => {
    const { storage } = fakeStorage();
    writeSticky(storage, athletics, { kind: "lift", exercise: "Bench Press" });

    expect(readSticky(storage, athletics)).toEqual({ kind: "lift" });
  });

  it("stores nothing but the sticky fields, whatever else was submitted", () => {
    // The form submits every field. If this filtered on the way *out* instead of the way in,
    // a weight would sit in localStorage waiting for the rule in `categories.ts` to change.
    const { storage, map } = fakeStorage();
    writeSticky(storage, athletics, { kind: "erg", weightLbs: "185", reps: "5", spm: "24" });

    expect(JSON.parse([...map.values()][0])).toEqual({ kind: "erg" });
  });

  it("forgets a sticky field that was cleared", () => {
    const { storage } = fakeStorage();
    writeSticky(storage, athletics, { kind: "lift" });
    writeSticky(storage, athletics, { kind: "" });

    // Keeping the old value here would make a sticky value impossible to get rid of.
    expect(readSticky(storage, athletics)).toEqual({});
  });

  it("keeps categories apart", () => {
    const { storage } = fakeStorage();
    writeSticky(storage, athletics, { kind: "lift" });
    writeSticky(storage, work, { action: "submitted", effort: "quick apply" });

    expect(readSticky(storage, athletics)).toEqual({ kind: "lift" });
    expect(readSticky(storage, work)).toEqual({ action: "submitted", effort: "quick apply" });
  });

  it("ignores a stored value for a field that is no longer sticky", () => {
    // Written by an older build. Without the filter it would pre-fill a field the form has
    // since decided must not be pre-filled — the rule change would not apply retroactively.
    const { storage } = fakeStorage({
      initial: { "2m_sticky_athletics": JSON.stringify({ kind: "lift", weightLbs: "185" }) },
    });

    expect(readSticky(storage, athletics)).toEqual({ kind: "lift" });
  });

  it("survives storage holding something that is not JSON", () => {
    const { storage } = fakeStorage({ initial: { "2m_sticky_athletics": "{oh no" } });
    expect(readSticky(storage, athletics)).toEqual({});
  });

  it("survives storage holding a JSON array", () => {
    const { storage } = fakeStorage({ initial: { "2m_sticky_athletics": "[1,2,3]" } });
    expect(readSticky(storage, athletics)).toEqual({});
  });

  it("reads and writes without throwing when storage does", () => {
    // A private window. The form opening empty is a small cost; the page crashing is not.
    const { storage } = fakeStorage({ throws: true });
    expect(() => writeSticky(storage, athletics, { kind: "lift" })).not.toThrow();
    expect(readSticky(storage, athletics)).toEqual({});
  });

  it("works with no storage at all", () => {
    expect(readSticky(undefined, athletics)).toEqual({});
    expect(() => writeSticky(undefined, athletics, { kind: "lift" })).not.toThrow();
  });
});

describe("the store React subscribes to", () => {
  it("hands back the same snapshot until something is written", () => {
    // `useSyncExternalStore` re-renders forever if `getSnapshot` returns a fresh object each
    // time. This is the assertion that stops that being discovered in a browser.
    const store = stickyStore(athletics);
    expect(store.getSnapshot()).toBe(store.getSnapshot());
  });

  it("hands back a new snapshot after a write, so the form remounts on the new defaults", () => {
    const store = stickyStore(athletics);
    const before = store.getSnapshot();

    writeSticky(undefined, athletics, { kind: "erg" });
    const after = store.getSnapshot();

    expect(after).not.toBe(before);
    expect(after.version).toBeGreaterThan(before.version);
  });

  it("tells its subscribers", () => {
    const store = stickyStore(athletics);
    const onChange = vi.fn();
    const unsubscribe = store.subscribe(onChange);

    writeSticky(undefined, athletics, { kind: "water" });
    expect(onChange).toHaveBeenCalled();

    unsubscribe();
    writeSticky(undefined, athletics, { kind: "lift" });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("is empty on the server, which is what keeps hydration matching", () => {
    // `localStorage` does not exist during SSR. A snapshot that tried to read it would render
    // one thing on the server and another on the client, and React would blow away the form.
    expect(stickyStore(athletics).getServerSnapshot()).toEqual({ version: 0, values: {} });
  });
});
