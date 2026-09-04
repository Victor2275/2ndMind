// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { flushHeldErrors, reportError, watchForErrors } from "@/lib/errors/client";

/**
 * Sending a crash report from the browser (V3 §2.4, D-165).
 *
 * Three rules, and each is a way this file could make things worse rather than better:
 *
 * 1. **Never throw.** Every call site is a `catch` or a global handler — somewhere already
 *    going wrong. An exception here replaces a handled failure with an unhandled one.
 * 2. **Never loop.** A report that fails and reports its own failure is an outage generator.
 * 3. **Never lose the phone's errors.** A crash with no signal is the case this whole section
 *    was scheduled for, and it is exactly the case a naive `fetch` drops on the floor.
 *
 * Every test here is about one of those. None of them is about the happy path, which is four
 * lines and cannot go interestingly wrong.
 */

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true });
  vi.stubGlobal("fetch", fetchMock);
  window.localStorage.clear();
});

afterEach(() => vi.unstubAllGlobals());

const sent = () => JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body ?? "{}"));

describe("rule 1 — it never throws", () => {
  it("survives a fetch that rejects", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(reportError(new Error("boom"))).resolves.toBeUndefined();
  });

  it("survives being handed something that is not an Error", async () => {
    // A thrown string, a rejected object, `undefined`. All real, all easy to crash on.
    for (const thrown of ["a string", { odd: true }, undefined, null, 42]) {
      await expect(reportError(thrown)).resolves.toBeUndefined();
    }
  });

  it("survives storage that refuses to be read or written", async () => {
    // A private window throws on access, not just on write.
    fetchMock.mockRejectedValue(new Error("offline"));
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new DOMException("denied", "SecurityError");
      },
      setItem: () => {
        throw new DOMException("denied", "SecurityError");
      },
    });

    await expect(reportError(new Error("boom"))).resolves.toBeUndefined();
  });
});

describe("rule 2 — it never loops", () => {
  it("ignores an error raised while it is already reporting", async () => {
    // The outage generator: a failing report that reports its own failure, forever.
    let inner: Promise<void> | null = null;
    fetchMock.mockImplementation(async () => {
      inner ??= reportError(new Error("the reporter itself failed"));
      return { ok: true };
    });

    await reportError(new Error("boom"));
    await inner;

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("is available again once the first report has finished", async () => {
    await reportError(new Error("one"));
    await reportError(new Error("two"));

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("rule 3 — it does not lose what happened offline", () => {
  it("holds a report the network refused, and sends it on the next load", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    await reportError(new Error("happened on a plane"));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem("2m_errors")).toContain("happened on a plane");

    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true });
    await flushHeldErrors();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sent().message).toBe("happened on a plane");
    expect(window.localStorage.getItem("2m_errors")).toBe("[]");
  });

  it("puts a report back when the flush fails again", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    await reportError(new Error("still no signal"));
    await flushHeldErrors();

    expect(window.localStorage.getItem("2m_errors")).toContain("still no signal");
  });

  it("keeps the queue bounded, dropping the oldest", async () => {
    // A device offline for a week. The first twenty errors are the least interesting — they
    // are the same crash from Tuesday.
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    for (let i = 0; i < 30; i += 1) await reportError(new Error(`error ${i}`));

    const queue = JSON.parse(window.localStorage.getItem("2m_errors") ?? "[]");
    expect(queue).toHaveLength(20);
    expect(queue[queue.length - 1].message).toBe("error 29");
  });

  it("does nothing at all when there is nothing held", async () => {
    await flushHeldErrors();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("survives storage holding something that is not a queue", async () => {
    window.localStorage.setItem("2m_errors", "{oh no");
    await expect(flushHeldErrors()).resolves.toBeUndefined();
  });
});

describe("what it sends", () => {
  it("scrubs before it leaves the device, so a held report is already clean", async () => {
    // Not redundancy for its own sake: a report waiting in storage on a phone that never
    // reconnects must not be an unscrubbed copy of something.
    await reportError(new Error("failed for gusev0219@gmail.com"));

    expect(sent().message).not.toContain("gmail.com");
    expect(sent().message).toContain("[email]");
  });

  it("sends the path without its query string", async () => {
    window.history.replaceState(null, "", "/private/academics?gpa=3.8");
    await reportError(new Error("boom"));

    expect(sent().route).toBe("/private/academics");
  });

  it("coarsens the user agent rather than sending it", async () => {
    await reportError(new Error("boom"));
    expect(sent().agent).not.toContain("Mozilla");
  });

  it("labels where it came from", async () => {
    await reportError(new Error("boom"), "worker");
    expect(sent().source).toBe("worker");
  });

  it("uses keepalive, so a crash on unload still reports", async () => {
    await reportError(new Error("boom"));
    expect(fetchMock.mock.calls[0][1].keepalive).toBe(true);
  });
});

describe("the global listeners", () => {
  it("reports an unhandled rejection, which is most of what can fail here", async () => {
    const stop = watchForErrors();

    window.dispatchEvent(
      Object.assign(new Event("unhandledrejection"), { reason: new Error("nobody caught this") }),
    );
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());

    expect(sent().message).toBe("nobody caught this");
    stop();
  });

  it("stops listening when torn down", async () => {
    const stop = watchForErrors();
    stop();

    window.dispatchEvent(
      Object.assign(new Event("unhandledrejection"), { reason: new Error("x") }),
    );
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
