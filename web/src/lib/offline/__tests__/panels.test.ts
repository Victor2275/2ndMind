// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AGING_MS,
  STALE_MS,
  byCourse,
  dueToday,
  freshnessOf,
  latestSummary,
  latestWeight,
  localDay,
  loggedOn,
  recentSets,
  rehabDoneOn,
  undated,
} from "@/lib/offline/panels";
import type { LocalRecord } from "@/lib/sync/store";

/**
 * What the phone can show with no signal (§2.1).
 *
 * The interesting bugs here are all about **time**, and none of them throws. A day boundary
 * computed in UTC empties "logged today" every evening in California; a rolling 24-hour window
 * makes a task appear and vanish depending on when the phone is looked at; a freshness level
 * that rounds a stale copy up to fresh turns a cached screen into a lying one. Each of those
 * is a test below rather than a comment.
 */

function record(row: Record<string, unknown>): LocalRecord {
  return {
    key: String(row.clientId ?? row.id ?? ""),
    row,
    updatedHlc: "0",
    deletedAt: null,
    serverSeq: 1,
    dirty: 0,
  };
}

/** Noon in the local zone on a fixed day, so no test depends on when it is run. */
const NOON = new Date(2026, 8, 5, 12, 0, 0);

beforeEach(() => vi.useFakeTimers({ now: NOON }));
afterEach(() => vi.useRealTimers());

describe("how old the copy is", () => {
  it("says never for a device that has not synced", () => {
    expect(freshnessOf(null).level).toBe("never");
  });

  it("moves through fresh, aging and stale", () => {
    const now = NOON.getTime();
    expect(freshnessOf(now - 60_000, now).level).toBe("fresh");
    expect(freshnessOf(now - AGING_MS - 1, now).level).toBe("aging");
    expect(freshnessOf(now - STALE_MS - 1, now).level).toBe("stale");
  });

  it("reports an age even when it is fresh", () => {
    // The tone changes with age; the fact never disappears. A dashboard that looks live and is
    // three hours old is the failure this whole panel exists to prevent.
    expect(freshnessOf(NOON.getTime() - 60_000, NOON.getTime()).ageMs).toBe(60_000);
  });

  it("never reports a negative age from a clock that went backwards", () => {
    expect(freshnessOf(NOON.getTime() + 5_000, NOON.getTime()).ageMs).toBe(0);
  });
});

describe("what is due", () => {
  const task = (over: Record<string, unknown>) =>
    record({ clientId: `t-${over.title}`, title: "A task", doneAt: null, dueAt: null, ...over });

  it("includes everything due by the end of today, not the next 24 hours", () => {
    // A rolling window makes a task due at 9pm appear at 8am, vanish at 9:01pm, and come back
    // tomorrow. The local day boundary is what makes the list stable across a day.
    const tonight = new Date(2026, 8, 5, 21, 0, 0).toISOString();
    const tomorrow = new Date(2026, 8, 6, 9, 0, 0).toISOString();

    const due = dueToday(
      [task({ title: "tonight", dueAt: tonight }), task({ title: "tomorrow", dueAt: tomorrow })],
      NOON,
    );

    expect(due.map((t) => t.title)).toEqual(["tonight"]);
  });

  it("keeps an overdue task, and marks it", () => {
    const yesterday = new Date(2026, 8, 4, 9, 0, 0).toISOString();
    const [only] = dueToday([task({ title: "late", dueAt: yesterday })], NOON);

    expect(only.title).toBe("late");
    expect(only.overdue).toBe(true);
  });

  it("leaves out what is finished", () => {
    const at = new Date(2026, 8, 5, 9, 0, 0).toISOString();
    expect(dueToday([task({ title: "done", dueAt: at, doneAt: at })], NOON)).toHaveLength(0);
  });

  it("orders soonest first", () => {
    const early = new Date(2026, 8, 5, 8, 0, 0).toISOString();
    const late = new Date(2026, 8, 5, 20, 0, 0).toISOString();

    const due = dueToday(
      [task({ title: "late", dueAt: late }), task({ title: "early", dueAt: early })],
      NOON,
    );
    expect(due.map((t) => t.title)).toEqual(["early", "late"]);
  });

  it("separates what has no date at all", () => {
    const backlog = undated(
      [task({ title: "someday" }), task({ title: "dated", dueAt: NOON.toISOString() })],
      NOON,
    );
    expect(backlog.map((t) => t.title)).toEqual(["someday"]);
  });

  it("groups open coursework by course, and ignores what has none", () => {
    const grouped = byCourse(
      [
        task({ title: "pset 3", courseCode: "M51A" }),
        task({ title: "lab", courseCode: "PHY4BL" }),
        task({ title: "pset 4", courseCode: "M51A" }),
        task({ title: "no course" }),
      ],
      NOON,
    );

    expect(grouped.map((g) => g.course)).toEqual(["M51A", "PHY4BL"]);
    expect(grouped[0].tasks).toHaveLength(2);
  });
});

describe("what was logged today", () => {
  const entry = (over: Record<string, unknown>) =>
    record({ clientId: `e-${over.note}`, category: "day", note: "", data: {}, ...over });

  it("uses the local day, not the UTC one", () => {
    // The trap: `toISOString()` in California after 5pm is already tomorrow, so a UTC boundary
    // empties this panel every evening — exactly when the day gets logged.
    const evening = new Date(2026, 8, 5, 22, 30, 0).toISOString();
    const logged = loggedOn([entry({ note: "late one", occurredAt: evening })], NOON);

    expect(logged.map((e) => e.line)).toEqual(["late one"]);
  });

  it("leaves out yesterday and tomorrow", () => {
    const logged = loggedOn(
      [
        entry({ note: "yesterday", occurredAt: new Date(2026, 8, 4, 12).toISOString() }),
        entry({ note: "today", occurredAt: new Date(2026, 8, 5, 12).toISOString() }),
        entry({ note: "tomorrow", occurredAt: new Date(2026, 8, 6, 12).toISOString() }),
      ],
      NOON,
    );

    expect(logged.map((e) => e.line)).toEqual(["today"]);
  });

  it("summarises an entry the same way the timeline does", () => {
    const logged = loggedOn(
      [
        entry({
          category: "athletics",
          occurredAt: new Date(2026, 8, 5, 10).toISOString(),
          data: { kind: "lift", exercise: "Squat", sets: [{ weightLbs: 225, reps: 5 }] },
        }),
      ],
      NOON,
    );

    expect(logged[0].line).toBe("lift · Squat · 225 × 5");
  });

  it("survives a row with no timestamp rather than throwing", () => {
    expect(loggedOn([entry({ note: "broken", occurredAt: undefined })], NOON)).toHaveLength(0);
  });

  it("puts the newest first", () => {
    const logged = loggedOn(
      [
        entry({ note: "morning", occurredAt: new Date(2026, 8, 5, 8).toISOString() }),
        entry({ note: "evening", occurredAt: new Date(2026, 8, 5, 20).toISOString() }),
      ],
      NOON,
    );

    expect(logged.map((e) => e.line)).toEqual(["evening", "morning"]);
  });
});

describe("recent training, from both sources", () => {
  it("merges quick-logged sets with imported ones, newest first", () => {
    // The same merge `allEfforts()` does on the server (D-159), redone here because the phone
    // has no server to ask. If these two disagree, the offline screen contradicts the online
    // one about what he did.
    const workouts = [record({ id: 7, performedAt: new Date(2026, 8, 1, 10).toISOString() })];
    const sets = [
      record({ id: 1, workoutId: 7, exercise: "Bench Press", weightLbs: 185, reps: 5 }),
    ];
    const logs = [
      record({
        clientId: "l-1",
        category: "athletics",
        occurredAt: new Date(2026, 8, 4, 10).toISOString(),
        data: { exercise: "Squat", sets: [{ weightLbs: 225, reps: 5 }] },
      }),
    ];

    const merged = recentSets(logs, sets, workouts);
    expect(merged.map((s) => s.exercise)).toEqual(["Squat", "Bench Press"]);
  });

  it("fans one entry out into a set each", () => {
    const logs = [
      record({
        clientId: "l-1",
        category: "athletics",
        occurredAt: new Date(2026, 8, 4, 10).toISOString(),
        data: {
          exercise: "Squat",
          sets: [
            { weightLbs: 225, reps: 5 },
            { weightLbs: 225, reps: 5 },
          ],
        },
      }),
    ];

    expect(recentSets(logs, [], [])).toHaveLength(2);
  });

  it("drops a set whose session has not been mirrored yet", () => {
    // Otherwise it renders with no date and sorts to the bottom of history forever.
    const sets = [record({ id: 1, workoutId: 999, exercise: "Orphan", weightLbs: 100, reps: 1 })];
    expect(recentSets([], sets, [])).toHaveLength(0);
  });

  it("ignores entries from other categories and malformed rows", () => {
    const logs = [
      record({ clientId: "r", category: "reading", occurredAt: NOON.toISOString(), data: {} }),
      record({
        clientId: "a",
        category: "athletics",
        occurredAt: NOON.toISOString(),
        data: { sets: [{ reps: 5 }] },
      }),
      record({
        clientId: "b",
        category: "athletics",
        occurredAt: NOON.toISOString(),
        data: { exercise: "X", sets: "nope" },
      }),
    ];

    expect(recentSets(logs, [], [])).toHaveLength(0);
  });

  it("stops at the limit, so a year of training does not render at once", () => {
    const logs = Array.from({ length: 30 }, (_, i) =>
      record({
        clientId: `l-${i}`,
        category: "athletics",
        occurredAt: new Date(2026, 8, 1, i % 24).toISOString(),
        data: { exercise: `Lift ${i}`, sets: [{ weightLbs: 100, reps: 5 }] },
      }),
    );

    expect(recentSets(logs, [], [], 20)).toHaveLength(20);
  });
});

describe("the rest of the athletics panel", () => {
  it("takes the most recent weigh-in by day, not by insertion order", () => {
    const readings = [
      record({ measuredOn: "2026-09-01", weightLbs: 180 }),
      record({ measuredOn: "2026-09-05", weightLbs: 178 }),
      record({ measuredOn: "2026-09-03", weightLbs: 179 }),
    ];

    expect(latestWeight(readings)).toEqual({ measuredOn: "2026-09-05", weightLbs: 178 });
  });

  it("says nothing rather than zero when there is no weigh-in", () => {
    expect(latestWeight([])).toBeNull();
  });

  it("lists rehab ticked on the local day", () => {
    const day = localDay(NOON);
    const ticks = [
      record({ completedOn: day, slug: "band-pull-apart" }),
      record({ completedOn: "2026-09-04", slug: "dead-hang" }),
    ];

    expect(rehabDoneOn(ticks, NOON)).toEqual(["band-pull-apart"]);
  });
});

describe("the last stored summary", () => {
  /**
   * §3.6. D-124 persisted summaries so they would outlive the model call; this is what makes
   * one reachable with no network. Age is a label here, not a filter — Victor's call, and the
   * rule the rest of the cached screen already follows.
   */
  const record = (row: Record<string, unknown>, deletedAt: string | null = null) => ({
    key: String(row.periodStart),
    row,
    updatedHlc: "1",
    deletedAt,
    serverSeq: 1,
    dirty: 0 as const,
  });

  it("takes the newest day, not the newest row", () => {
    // Rows arrive in cursor order, which is the order the server happened to write them — not
    // the order of the days they describe.
    expect(
      latestSummary([
        record({ kind: "daily", periodStart: "2026-09-01", summary: "older" }),
        record({ kind: "daily", periodStart: "2026-09-04", summary: "newest" }),
        record({ kind: "daily", periodStart: "2026-09-02", summary: "middle" }),
      ])?.summary,
    ).toBe("newest");
  });

  it("shows one however old it is, because the date is on it", () => {
    const old = latestSummary([
      record({ kind: "daily", periodStart: "2020-01-01", summary: "ancient" }),
    ]);
    expect(old?.summary).toBe("ancient");
    expect(old?.periodStart).toBe("2020-01-01");
  });

  it("ignores the weekly ones, which describe a different span", () => {
    // A weekly summary under a heading dated one day would make the date say something untrue.
    expect(
      latestSummary([
        record({ kind: "weekly", periodStart: "2026-09-04", summary: "the week" }),
        record({ kind: "daily", periodStart: "2026-09-01", summary: "the day" }),
      ])?.summary,
    ).toBe("the day");
  });

  it("ignores tombstones", () => {
    expect(
      latestSummary([
        record({ kind: "daily", periodStart: "2026-09-04", summary: "deleted" }, "2026-09-04"),
        record({ kind: "daily", periodStart: "2026-09-01", summary: "alive" }),
      ])?.summary,
    ).toBe("alive");
  });

  it("answers null rather than an empty shape when there is nothing", () => {
    expect(latestSummary([])).toBeNull();
    expect(
      latestSummary([record({ kind: "daily", periodStart: "2026-09-04", summary: "" })]),
    ).toBeNull();
  });
});
