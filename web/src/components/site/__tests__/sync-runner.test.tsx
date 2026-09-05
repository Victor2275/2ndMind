// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

const { SyncRunner } = await import("../sync-runner");

beforeEach(() => {
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

describe("the badge", () => {
  const QUEUED = [
    {
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
    },
  ];

  it("navigates by document on the shell, where there is no server to ask", async () => {
    pendingCount.mockResolvedValue(1);
    allOps.mockResolvedValue(QUEUED);
    render(<SyncRunner offline />);

    const link = await screen.findByRole("link");
    expect(link.getAttribute("href")).toBe("/private/sync");

    expect(link.hasAttribute("data-next-link")).toBe(false);
  });

  it("uses the router in the live app, where a client transition is the right thing", async () => {
    // The counterpart, so the assertion above cannot pass merely because the mock never
    // applied. Inside /private there is a server, and a client transition is faster.
    allOps.mockResolvedValue(QUEUED);
    render(<SyncRunner />);

    const link = await screen.findByRole("link");
    expect(link.hasAttribute("data-next-link")).toBe(true);
  });
});
