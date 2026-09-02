// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  AUTO_LOCK_MS,
  decideLock,
  readUnlockedAt,
  UNLOCKED_AT_KEY,
  writeUnlockedAt,
} from "@/lib/auth/lock-state";

/**
 * When the app is locked. Pure, and tested rather than reasoned about, because every one of
 * these rules fails in the direction of *staying open* if it is written slightly wrong — and
 * a lock that quietly does not lock looks exactly like one that works.
 */

const NOW = 1_800_000_000_000;

/** A `Storage` that can be made to throw, which is what a private window actually does. */
function fakeStorage(
  options: { throws?: boolean; initial?: Record<string, string> } = {},
): Storage {
  const map = new Map(Object.entries(options.initial ?? {}));
  const guard = () => {
    if (options.throws) throw new DOMException("denied", "SecurityError");
  };
  return {
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
  } as Storage;
}

describe("deciding", () => {
  it("locks on a cold start, which is the case that matters most", () => {
    // No stored value means the app was closed and reopened. Defaulting to unlocked here
    // would mean the lock never once did its job.
    expect(decideLock(null, NOW)).toBe("locked");
  });

  it("stays unlocked inside the window", () => {
    expect(decideLock(NOW - 60_000, NOW)).toBe("unlocked");
  });

  it("locks once the app has been away longer than the window", () => {
    expect(decideLock(NOW - AUTO_LOCK_MS - 1, NOW)).toBe("locked");
  });

  it("is still unlocked exactly at the boundary", () => {
    expect(decideLock(NOW - AUTO_LOCK_MS, NOW)).toBe("unlocked");
  });

  it("locks when the stored time is in the future", () => {
    // A clock that moved backwards — the same Taiwan case the sync clock deals with. Read
    // naively this is an unlock valid for however long the jump was.
    expect(decideLock(NOW + 60_000, NOW)).toBe("locked");
  });
});

describe("reading and writing the stored time", () => {
  it("round-trips", () => {
    const storage = fakeStorage();
    writeUnlockedAt(storage, NOW);
    expect(readUnlockedAt(storage)).toBe(NOW);
  });

  it("clears on null, which is what sign-out does", () => {
    const storage = fakeStorage({ initial: { [UNLOCKED_AT_KEY]: String(NOW) } });
    writeUnlockedAt(storage, null);
    expect(readUnlockedAt(storage)).toBeNull();
  });

  it("treats nonsense as absent rather than as a very old unlock", () => {
    expect(readUnlockedAt(fakeStorage({ initial: { [UNLOCKED_AT_KEY]: "soon" } }))).toBeNull();
  });

  it("reads a locked state from storage that throws, instead of crashing", () => {
    // Private windows and blocked site data both throw on access. The cost of failing here
    // is one extra fingerprint; the cost of throwing is a private app that will not open.
    expect(readUnlockedAt(fakeStorage({ throws: true }))).toBeNull();
    expect(decideLock(readUnlockedAt(fakeStorage({ throws: true })), NOW)).toBe("locked");
  });

  it("does not throw when it cannot write either", () => {
    expect(() => writeUnlockedAt(fakeStorage({ throws: true }), NOW)).not.toThrow();
  });

  it("survives storage being absent entirely", () => {
    expect(readUnlockedAt(undefined)).toBeNull();
    expect(() => writeUnlockedAt(undefined, NOW)).not.toThrow();
  });
});
