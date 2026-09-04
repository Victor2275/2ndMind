// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  approximateAge,
  describeOp,
  explain,
  orderForReview,
  STALE_MS,
  summariseOutbox,
} from "@/lib/sync/outbox-view";
import type { OutboxOp } from "@/lib/sync/store";

/**
 * What the outbox says to a person (§1.7).
 *
 * Two properties carry the section. **The badge and the screen must never disagree** — both
 * read from this module, so a count that says one thing while the list shows another is a bug
 * in one function rather than a drift between two components. And **a failed op must stay
 * loud**: it will not resolve on its own, so anything that lets it fade back into "waiting"
 * turns a visible problem into a silently missing entry, which is the exact failure §1.7
 * exists to prevent.
 */

const NOW = Date.parse("2026-09-05T12:00:00Z");
const HOUR = 60 * 60 * 1000;

function op(over: Partial<OutboxOp> = {}): OutboxOp {
  return {
    opId: over.opId ?? "op-1",
    entity: "log_entry",
    op: "create",
    clientId: "row-1",
    payload: { clientId: "row-1", category: "athletics", note: "" },
    hlc: "0-0-device",
    state: "pending",
    attempts: 0,
    lastError: null,
    createdAt: NOW - HOUR,
    ...over,
  };
}

describe("what the badge says", () => {
  it("says nothing at all when there is nothing waiting", () => {
    const summary = summariseOutbox([], NOW);
    expect(summary.urgency).toBe("none");
    expect(summary.label).toBe("");
  });

  it("counts a fresh queue quietly", () => {
    const summary = summariseOutbox([op(), op({ opId: "op-2" })], NOW);
    expect(summary.urgency).toBe("quiet");
    expect(summary.label).toBe("2 waiting");
  });

  it("escalates past a day, and says how long", () => {
    const summary = summariseOutbox([op({ createdAt: NOW - STALE_MS - HOUR })], NOW);
    expect(summary.urgency).toBe("stale");
    expect(summary.label).toBe("1 waiting · 25h");
  });

  it("lets a failure outrank age, because age heals and a rejection does not", () => {
    // A rejected op will still be here next week. Calling it "waiting" is a claim that gets
    // more wrong the longer it stands.
    const summary = summariseOutbox(
      [op({ createdAt: NOW - STALE_MS * 3 }), op({ opId: "op-2", state: "failed" })],
      NOW,
    );

    expect(summary.urgency).toBe("failed");
    expect(summary.label).toBe("1 not sent");
  });

  it("counts a failed op out of the waiting number, not into it", () => {
    // Otherwise the badge says "2 waiting" while the screen shows one waiting and one stuck.
    const summary = summariseOutbox([op(), op({ opId: "op-2", state: "failed" })], NOW);
    expect(summary.pending).toBe(1);
    expect(summary.failed).toBe(1);
  });

  it("counts an in-flight op as waiting, because from outside it is", () => {
    expect(summariseOutbox([op({ state: "inflight" })], NOW).pending).toBe(1);
  });
});

describe("ages a person reads without arithmetic", () => {
  it("rounds down and stays coarse", () => {
    expect(approximateAge(20_000)).toBe("just now");
    expect(approximateAge(9 * 60_000)).toBe("9m");
    expect(approximateAge(3 * HOUR)).toBe("3h");
    expect(approximateAge(47 * HOUR)).toBe("47h");
    expect(approximateAge(50 * HOUR)).toBe("2d");
    expect(approximateAge(9 * 24 * HOUR)).toBe("9d");
  });
});

describe("what a stuck entry is called", () => {
  it("names the entry, not the table", () => {
    // "Log entry · rejected" is not actionable. "Training — lift · Bench Press · 185 × 5" says
    // which entry to go and look at.
    const view = describeOp(
      op({
        payload: {
          clientId: "row-1",
          category: "athletics",
          note: "",
          data: { kind: "lift", exercise: "Bench Press", sets: [{ weightLbs: 185, reps: 5 }] },
        },
      }),
      NOW,
    );

    expect(view.kind).toBe("Log entry");
    expect(view.verb).toBe("Created");
    expect(view.title).toBe("Training — lift · Bench Press · 185 × 5");
  });

  it("reads the payload, not the mirror", () => {
    // A rejected create concerns a row the server never accepted, so the payload is the only
    // description of what was actually refused.
    const view = describeOp(op({ entity: "task", payload: { title: "Email the coach" } }), NOW);
    expect(view.title).toBe("Email the coach");
  });

  it("describes a weigh-in and a rehab tick without stringifying an object", () => {
    expect(
      describeOp(
        op({ entity: "bodyweight", payload: { weightLbs: 178, measuredOn: "2026-09-05" } }),
      ).title,
    ).toBe("178 lb on 2026-09-05");

    const rehab = describeOp(
      op({ entity: "rehab", payload: { slug: "band-pull-apart", completedOn: "2026-09-05" } }),
    );
    expect(rehab.title).toBe("band-pull-apart on 2026-09-05");
  });

  it("says a blank rather than [object Object] when it cannot tell", () => {
    expect(describeOp(op({ entity: "workout", payload: { anything: {} } })).title).toBe("");
  });

  it("marks only a failed op as needing a person", () => {
    expect(describeOp(op({ state: "pending" })).needsYou).toBe(false);
    expect(describeOp(op({ state: "inflight" })).needsYou).toBe(false);
    expect(describeOp(op({ state: "failed" })).needsYou).toBe(true);
  });

  it("says nothing is wrong while an op is merely waiting its turn", () => {
    expect(describeOp(op({ state: "pending", attempts: 4 })).problem).toBeNull();
  });
});

describe("why it failed, in a sentence he can act on", () => {
  const failed = (status: number, message = "") =>
    explain(op({ state: "failed", lastError: { at: NOW, status, message } }));

  it("translates a validation rejection, and says the local copy is safe", () => {
    // The raw text here is Zod's. A screen that prints it is a screen that gets ignored, and
    // for §1.7 an ignored screen means an entry that silently never arrives.
    const text = failed(422, "invalid_type at data.sets");
    expect(text).not.toContain("invalid_type");
    expect(text).toMatch(/safe/i);
  });

  it("tells him to sign in when the session had gone", () => {
    expect(failed(401)).toMatch(/sign in/i);
  });

  it("says a server error is worth simply retrying", () => {
    expect(failed(503)).toMatch(/retrying/i);
  });

  it("falls back to the raw message rather than inventing one", () => {
    expect(failed(0, "connection reset")).toBe("connection reset");
  });

  it("still says something when the reason did not survive", () => {
    expect(explain(op({ state: "failed", lastError: null }))).toMatch(/did not go through/i);
  });
});

describe("the order of the list", () => {
  it("puts what needs a person first, then oldest first", () => {
    const views = [
      describeOp(op({ opId: "new-pending", createdAt: NOW - HOUR }), NOW),
      describeOp(op({ opId: "old-pending", createdAt: NOW - 40 * HOUR }), NOW),
      describeOp(op({ opId: "new-failed", state: "failed", createdAt: NOW - HOUR }), NOW),
      describeOp(op({ opId: "old-failed", state: "failed", createdAt: NOW - 90 * HOUR }), NOW),
    ];

    expect(orderForReview(views).map((v) => v.opId)).toEqual([
      "old-failed",
      "new-failed",
      "old-pending",
      "new-pending",
    ]);
  });
});
