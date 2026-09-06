// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

import { alertIfStuck } from "@/lib/push/local-alert";
import type { OutboxSummary } from "@/lib/sync/outbox-view";

/**
 * §4.1's third trigger, which is not a push at all: the server cannot see an outbox that lives
 * on the phone.
 *
 * Two properties, and both are about *not* firing. A notification channel earns its place by
 * what it stays quiet about — one that fires on every tunnel and every lift is one that gets
 * turned off, and then the message that mattered never arrives either.
 */

const showNotification = vi.fn<() => Promise<void>>();

function summary(over: Partial<OutboxSummary> = {}): OutboxSummary {
  return { pending: 0, failed: 0, oldestMs: null, urgency: "none", label: "", ...over };
}

beforeEach(() => {
  showNotification.mockReset();
  showNotification.mockResolvedValue(undefined);
  localStorage.clear();
  vi.stubGlobal("Notification", { permission: "granted" });
  vi.stubGlobal("navigator", {
    serviceWorker: { ready: Promise.resolve({ showNotification }) },
  });
});

describe("when it stays quiet", () => {
  it("says nothing about entries that are merely waiting", async () => {
    // Pending is the system working: it sends the moment there is signal. Notifying here would
    // fire every time a train goes into a tunnel.
    expect(await alertIfStuck(summary({ pending: 4, urgency: "quiet" }))).toBe(false);
    expect(showNotification).not.toHaveBeenCalled();
  });

  it("says nothing when there is nothing wrong", async () => {
    expect(await alertIfStuck(summary())).toBe(false);
  });

  it("does not repeat itself for a problem it has already announced", async () => {
    // The runner flushes on reconnect, on foreground and whenever anything asks. Without this
    // one stuck entry would produce a burst.
    expect(await alertIfStuck(summary({ failed: 2, urgency: "failed" }))).toBe(true);
    expect(await alertIfStuck(summary({ failed: 2, urgency: "failed" }))).toBe(false);
    expect(showNotification).toHaveBeenCalledTimes(1);
  });

  it("says nothing when permission was never granted", async () => {
    vi.stubGlobal("Notification", { permission: "default" });
    expect(await alertIfStuck(summary({ failed: 3, urgency: "failed" }))).toBe(false);
  });
});

describe("when it speaks", () => {
  it("announces a failure that will not fix itself", async () => {
    expect(await alertIfStuck(summary({ failed: 1, urgency: "failed" }))).toBe(true);
    const [title, options] = showNotification.mock.calls[0] as unknown as [
      string,
      { data: { url: string } },
    ];
    expect(title).toMatch(/did not send/i);
    // It has to land on the screen that explains why, not on the dashboard.
    expect(options.data.url).toBe("/private/sync");
  });

  it("speaks again when the count rises", async () => {
    await alertIfStuck(summary({ failed: 1, urgency: "failed" }));
    expect(await alertIfStuck(summary({ failed: 3, urgency: "failed" }))).toBe(true);
  });

  it("speaks again about a new failure after the last one was cleared", async () => {
    // Otherwise fixing a problem would buy silence about the next one.
    await alertIfStuck(summary({ failed: 2, urgency: "failed" }));
    await alertIfStuck(summary({ failed: 0 }));
    expect(await alertIfStuck(summary({ failed: 1, urgency: "failed" }))).toBe(true);
  });

  it("still speaks once on a device that refuses storage", async () => {
    // Private browsing. A repeat notification is a much smaller failure than staying silent
    // about an entry that will never send.
    const broken = () => {
      throw new Error("denied");
    };
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(broken);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(broken);

    expect(await alertIfStuck(summary({ failed: 1, urgency: "failed" }))).toBe(true);
    vi.restoreAllMocks();
  });
});
