// @vitest-environment jsdom
import "fake-indexeddb/auto";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HlcClock } from "@/lib/sync/hlc";
import { DB_NAME, markFailed, enqueue, type SyncDb } from "@/lib/sync/store";

/**
 * The retry screen (§1.7).
 *
 * Three properties, and the third is the one worth a test rather than a comment. It must show
 * what is stuck, it must explain why in words rather than in a status code — and **it must
 * offer no way to throw an entry away.** That last one is a decision (D-160), and a decision
 * that lives only in a comment is one a later change removes by accident: a delete button is
 * the obvious thing to add to a list of things that will not go away.
 */

vi.mock("@/components/site/sync-runner", () => ({ requestSync: vi.fn() }));

const { OutboxConsole } = await import("../outbox-console");
// The component opens the real database by its real name, so the test writes to that one
// rather than to a fixture — otherwise it would assert against an outbox nobody reads.
const { openSyncDb: open } = await import("@/lib/sync/store");

let db: SyncDb;

beforeEach(async () => {
  db = await open(DB_NAME);
  // Each test starts from an empty outbox — the component reads whatever is there.
  const tx = db.transaction("outbox", "readwrite");
  await tx.store.clear();
  await tx.done;
});

afterEach(() => db?.close());

/** Puts one op in the outbox, optionally already rejected by the server. */
async function stick(options: { note: string; failed?: { status: number; message: string } }) {
  const clock = new HlcClock("device-a");
  const { opId } = await enqueue(db, {
    entity: "log_entry",
    op: "create",
    row: { clientId: crypto.randomUUID(), category: "day", note: options.note },
    hlc: clock.tick(),
  });
  if (options.failed) {
    await markFailed(db, opId, { at: Date.now(), ...options.failed });
  }
  return opId;
}

describe("what it shows", () => {
  it("says everything has arrived when the outbox is empty", async () => {
    render(<OutboxConsole />);
    expect(await screen.findByText(/on the server/i)).toBeInTheDocument();
  });

  it("shows a waiting entry as waiting, not as a problem", async () => {
    await stick({ note: "logged on a plane" });
    render(<OutboxConsole />);

    expect(await screen.findByText(/logged on a plane/)).toBeInTheDocument();
    expect(screen.getByText(/will go on its own/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /send it again/i })).toBeNull();
  });

  it("explains a rejection in words, not in a status code", async () => {
    await stick({
      note: "the stuck one",
      failed: { status: 422, message: "invalid_type at data.sets" },
    });
    render(<OutboxConsole />);

    expect(await screen.findByText(/the stuck one/)).toBeInTheDocument();
    expect(screen.queryByText(/invalid_type/)).toBeNull();
    expect(screen.getByText(/would not accept/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send it again/i })).toBeInTheDocument();
  });

  it("says when the app last reached the server", async () => {
    render(<OutboxConsole />);
    // Never, on a device that has not synced — which is more honest than showing nothing and
    // letting a cached screen read as current.
    expect(await screen.findByText(/never synced/i)).toBeInTheDocument();
  });
});

describe("nothing is discarded", () => {
  it("offers no way to delete a stuck entry", async () => {
    // D-160. An entry in this list is the only copy of something he wrote, and the app
    // offering to bin it at the moment it is being unhelpful is how a log stops being trusted.
    await stick({ note: "the stuck one", failed: { status: 422, message: "nope" } });
    render(<OutboxConsole />);

    await screen.findByText(/the stuck one/);
    for (const button of screen.getAllByRole("button")) {
      expect(button.textContent ?? "").not.toMatch(/delete|discard|remove|throw away/i);
    }
  });

  it("puts a failed op back in the queue rather than replacing it", async () => {
    const opId = await stick({
      note: "the stuck one",
      failed: { status: 422, message: "nope" },
    });
    render(<OutboxConsole />);

    await userEvent.click(await screen.findByRole("button", { name: /send it again/i }));

    // Same op, same id, same payload — a retry that created a new op would lose the
    // idempotency key and let a half-applied write land twice.
    await waitFor(async () => {
      const op = await db.get("outbox", opId);
      expect(op?.state).toBe("pending");
    });
    expect((await db.get("outbox", opId))?.payload.note).toBe("the stuck one");
  });
});
