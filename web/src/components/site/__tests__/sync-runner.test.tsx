// @vitest-environment jsdom
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * When the runner is allowed to talk to the server (V3 §1.3, D-175).
 *
 * The trigger logic itself is `lib/sync/engine.ts` and is tested there against fakes. What is
 * checked here is the one thing that only matters because of *where* the component is mounted:
 * `/cached` is a static route anyone can open, and `flush` posts even with an empty outbox —
 * deliberately, since that empty POST is how the laptop's changes reach the phone.
 *
 * Mounted there unguarded, every stranger who loads the URL fires one authenticated call that
 * 401s. Mounted with `offline`, a device with nothing queued must make no request at all.
 */

// See the note in cached-app.test.tsx: a <Link> and an <a> are indistinguishable in the DOM
// and jsdom has no router to cancel a click, so the module itself is marked.
vi.mock("next/link", () => ({
  default: ({ children, ...props }: { children?: unknown; [k: string]: unknown }) => (
    <a data-next-link="yes" {...(props as Record<string, string>)}>
      {children as never}
    </a>
  ),
}));

const flush = vi.fn();
const pendingCount = vi.fn<() => Promise<number>>();
const allOps = vi.fn<() => Promise<unknown[]>>();

vi.mock("@/lib/sync/engine", () => ({
  flush: (...args: unknown[]) => flush(...args),
  httpPoster: vi.fn(),
  backoffMs: () => 1000,
}));

vi.mock("@/lib/sync/store", () => ({
  openSyncDb: async () => ({ close() {} }),
  pendingCount: () => pendingCount(),
  pendingBatch: async () => [],
  allOps: () => allOps(),
}));

import { record, resetReachability } from "@/lib/net/reachability";
import { outboxStore, resetOutboxStatus } from "@/lib/sync/status";

const { SyncRunner } = await import("../sync-runner");

beforeEach(() => {
  // The summary is published to a module-level store since §4.5, so it outlives a render and
  // would otherwise carry a previous test's queue into the next one.
  resetOutboxStatus();
  flush.mockReset();
  flush.mockResolvedValue({ status: "synced", hasMore: false });
  pendingCount.mockReset();
  pendingCount.mockResolvedValue(0);
  allOps.mockReset();
  allOps.mockResolvedValue([]);
});

describe("the shell's runner stays quiet unless it has something to send", () => {
  it("makes no request at all when the outbox is empty", async () => {
    render(<SyncRunner offline />);
    // Settle every microtask the mount kicks off, then assert the absence.
    await waitFor(() => expect(pendingCount).toHaveBeenCalled());
    expect(flush).not.toHaveBeenCalled();
  });

  it("flushes when something is queued", async () => {
    pendingCount.mockResolvedValue(2);
    render(<SyncRunner offline />);
    await waitFor(() => expect(flush).toHaveBeenCalled());
  });

  it("still flushes an empty outbox in the live app, because that is how a pull happens", async () => {
    // The guard is scoped to the shell on purpose. Removing that scope would stop the phone
    // ever receiving anything written on the laptop.
    render(<SyncRunner />);
    await waitFor(() => expect(flush).toHaveBeenCalled());
    expect(pendingCount).not.toHaveBeenCalled();
  });
});

/** One pending op, which is all any of these need to make the badge render. */
function op(over: Record<string, unknown> = {}) {
  return {
    opId: "a",
    entity: "log_entry",
    op: "create",
    clientId: "c1",
    payload: {},
    hlc: "1",
    state: "pending",
    attempts: 0,
    lastError: null,
    createdAt: Date.now(),
    ...over,
  };
}

/** One op on its way. Ordinary, resolves itself — and since §4.5 the pill says nothing. */
const QUEUED = [op()];

/**
 * One op the server refused.
 *
 * The pill speaks for the loud states only since §4.5 (the glyph took the quiet count), so a
 * test about *the pill itself* — how it navigates, what it says — has to stage a state the
 * pill still has an opinion about. `failed` is the clearest: it never resolves on its own.
 */
const FAILED = [op({ state: "failed", lastError: { status: 422, message: "nope" } })];

/** Queued, and old enough that waiting has become a problem rather than a process. */
const STALE = [op({ createdAt: Date.now() - 48 * 60 * 60 * 1000 })];

describe("the badge", () => {
  it("navigates by document on the shell, where there is no server to ask", async () => {
    pendingCount.mockResolvedValue(1);
    allOps.mockResolvedValue(FAILED);
    render(<SyncRunner offline />);

    const link = await screen.findByRole("link");
    expect(link.getAttribute("href")).toBe("/private/sync");

    expect(link.hasAttribute("data-next-link")).toBe(false);
  });

  it("uses the router in the live app, where a client transition is the right thing", async () => {
    // The counterpart, so the assertion above cannot pass merely because the mock never
    // applied. Inside /private there is a server, and a client transition is faster.
    allOps.mockResolvedValue(FAILED);
    render(<SyncRunner />);

    const link = await screen.findByRole("link");
    expect(link.hasAttribute("data-next-link")).toBe(true);
  });
});

describe("a run that wedges (Phase N4)", () => {
  /**
   * `runningRef` is the mutex that stops two flushes overlapping, and it is only cleared in
   * `finally`. So anything inside `run` that never settles disables syncing **for the life of
   * the page**, and the symptom is the worst kind available: no error, no change to the badge,
   * "Send now" simply does nothing, and the outbox grows quietly until the app is reloaded.
   *
   * A stalled POST used to do exactly that. The deadline on `httpPoster` fixes it at the source
   * — this covers everything else, which is why it is staged with a `flush` that never returns
   * rather than with a network condition.
   */
  const SYNC_EVENT = "2ndmind:sync";

  afterEach(() => {
    vi.useRealTimers();
  });

  it("releases the mutex, so Send now is not dead until reload", async () => {
    vi.useFakeTimers();
    flush.mockImplementation(() => new Promise(() => {}));

    render(<SyncRunner />);
    await vi.advanceTimersByTimeAsync(0);
    expect(flush).toHaveBeenCalledTimes(1);

    // While the run is held, a manual trigger is correctly ignored — the mutex is doing its job.
    window.dispatchEvent(new Event(SYNC_EVENT));
    await vi.advanceTimersByTimeAsync(0);
    expect(flush).toHaveBeenCalledTimes(1);

    // Ten minutes is well past any watchdog worth having, and deliberately not the constant
    // itself: a value that needed importing here could be raised to infinity and this would
    // still pass.
    await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
    window.dispatchEvent(new Event(SYNC_EVENT));
    await vi.advanceTimersByTimeAsync(0);

    expect(flush).toHaveBeenCalledTimes(2);
  });

  it("does not release it while a run is merely slow", async () => {
    // The other half. A watchdog that fired early would let two flushes overlap on every large
    // batch, which is a request wasted on every sync rather than a bug that needs one.
    vi.useFakeTimers();
    flush.mockImplementation(() => new Promise(() => {}));

    render(<SyncRunner />);
    await vi.advanceTimersByTimeAsync(0);

    await vi.advanceTimersByTimeAsync(60 * 1000);
    window.dispatchEvent(new Event(SYNC_EVENT));
    await vi.advanceTimersByTimeAsync(0);

    expect(flush).toHaveBeenCalledTimes(1);
  });
});

describe("what the badge says about the connection (Phase N7)", () => {
  /**
   * The app is genuinely fine on a stalled connection — screens render from IndexedDB and
   * entries queue — it just *looks* broken, because everything that would be instant takes
   * three seconds and then comes from disk. One quiet line is the whole feature.
   *
   * The wording is under test as much as the visibility. It deliberately claims nothing about
   * writes: a form under /private posts to a Server Action and has no local copy, so "saved on
   * this device" would be a lie in the one place someone would rely on it (D-206).
   */
  beforeEach(() => {
    resetReachability();
  });

  afterEach(() => {
    resetReachability();
  });

  it("says nothing at all when the connection is fine and nothing is queued", async () => {
    render(<SyncRunner />);
    await waitFor(() => expect(flush).toHaveBeenCalled());
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("speaks up once requests start stalling, even with an empty outbox", async () => {
    render(<SyncRunner />);
    await waitFor(() => expect(flush).toHaveBeenCalled());

    act(() => record("stalled"));

    const link = await screen.findByRole("link");
    expect(link.textContent).toContain("Connection is poor");
  });

  it("does not promise the entry is saved on the device, because it is not", async () => {
    // The plan's original wording. It is true on the cached shell and false in the live app,
    // and the live app is where someone would act on it.
    render(<SyncRunner />);
    await waitFor(() => expect(flush).toHaveBeenCalled());

    act(() => record("stalled"));

    const link = await screen.findByRole("link");
    expect(link.textContent).not.toMatch(/saved/i);
  });

  it("is blunter when the device says there is no network at all", async () => {
    render(<SyncRunner />);
    await waitFor(() => expect(flush).toHaveBeenCalled());

    act(() => {
      window.dispatchEvent(new Event("offline"));
    });

    const link = await screen.findByRole("link");
    expect(link.textContent).toContain("No connection");
  });

  it("lets the queue lead when there is one, and keeps the connection as context", async () => {
    // The queue is the more specific thing to say. A poor connection explains it rather than
    // replacing it. Staged `stale` rather than merely queued: since §4.5 the pill no longer
    // speaks for a quiet queue, so a quiet one would leave nothing for the connection to be
    // context *for*.
    allOps.mockResolvedValue(STALE);
    render(<SyncRunner />);
    const link = await screen.findByRole("link");

    act(() => record("stalled"));

    await waitFor(() => expect(link.textContent).toContain("Connection is poor"));
    expect(link.textContent).toContain("1 waiting");
  });

  it("says nothing about an ordinary queue on a good connection (§4.5)", async () => {
    // The change §4.5 made, stated as a test. A couple of entries on their way is the normal
    // state of a phone that has been in a pocket; it resolves itself in seconds, and the
    // persistent glyph is already showing the count. A fixed pill for it is noise that trains
    // the eye to skip the corner where the failures appear.
    allOps.mockResolvedValue(QUEUED);
    render(<SyncRunner />);
    await waitFor(() => expect(flush).toHaveBeenCalled());

    expect(screen.queryByRole("link")).toBeNull();
  });

  it("publishes what is queued even when the run itself fails (§4.5)", async () => {
    // The glyph is on screen always, so "no summary yet" is a state someone can sit looking
    // at. Reading the outbox needs no network; only sending it does.
    allOps.mockResolvedValue(QUEUED);
    flush.mockRejectedValue(new Error("no"));
    render(<SyncRunner />);

    await waitFor(() => expect(outboxStore.getSnapshot()?.pending).toBe(1));
  });

  it("publishes the summary whether or not it renders anything (§4.5)", async () => {
    // The pill going quiet must not take the glyph's number with it: the sidebar and the tab
    // bar read this store, and they are the ones showing the quiet state now.
    allOps.mockResolvedValue(QUEUED);
    render(<SyncRunner />);

    await waitFor(() => expect(outboxStore.getSnapshot()?.pending).toBe(1));
    expect(outboxStore.getSnapshot()?.urgency).toBe("quiet");
  });

  it("goes quiet again as soon as something answers", async () => {
    render(<SyncRunner />);
    await waitFor(() => expect(flush).toHaveBeenCalled());
    act(() => record("stalled"));
    await screen.findByRole("link");

    act(() => record("ok"));

    await waitFor(() => expect(screen.queryByRole("link")).toBeNull());
  });
});

describe("reconnecting (Phase N4)", () => {
  /**
   * Backoff exists to stop the app hammering a network that is not working. `online` is the one
   * event that says that has changed — so the delay it is still counting down is about a
   * connection that no longer exists.
   *
   * Found by `npm run e2e`: the suite reached "back online" with one op held from a failure a
   * moment earlier, dispatched `online`, and watched nothing happen — while a manual "Send now"
   * immediately afterwards emptied the outbox. The queue was waiting for a foreground that, on
   * a phone in a pocket, might not come for hours.
   */
  it("ignores the backoff when the radio comes back", async () => {
    flush.mockResolvedValue({ status: "transient", message: "no network" });
    render(<SyncRunner />);
    await waitFor(() => expect(flush).toHaveBeenCalledTimes(1));

    // A second automatic trigger inside the backoff window is correctly ignored.
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await Promise.resolve();
    expect(flush).toHaveBeenCalledTimes(1);

    act(() => {
      window.dispatchEvent(new Event("online"));
    });

    await waitFor(() => expect(flush).toHaveBeenCalledTimes(2));
  });

  it("still respects the backoff when the app is merely foregrounded", async () => {
    // The other half. Coming back to the app is not news about the network, and a foreground
    // that ignored the delay would retry a failing batch every time the screen woke up.
    flush.mockResolvedValue({ status: "transient", message: "no network" });
    render(<SyncRunner />);
    await waitFor(() => expect(flush).toHaveBeenCalledTimes(1));

    act(() => {
      Object.defineProperty(document, "visibilityState", {
        value: "visible",
        configurable: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(flush).toHaveBeenCalledTimes(1);
  });
});
