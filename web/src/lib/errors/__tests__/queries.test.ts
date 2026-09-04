// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";

import { clean, type ErrorReportInput } from "@/lib/errors/report";
import {
  openErrorCount,
  openErrors,
  recordError,
  resolveError,
  type Db,
} from "@/lib/errors/queries";
import { resetTestDb } from "@/test/pg";

/**
 * Storing crash reports (V3 §2.4, D-165).
 *
 * Against real Postgres, because the whole design rests on an upsert behaving correctly under
 * a conflict — and a mocked query builder would happily accept a read-then-insert that loses
 * one of two simultaneous reports.
 *
 * The property that matters most: **a broken selector in a render loop produces thousands of
 * identical reports in seconds.** Inserting a row for each is how a diagnostics table becomes
 * the largest thing in the database and takes the app down with it — the error reporter causing
 * the outage being, obviously, the worst available outcome.
 */

let db: Db;

beforeEach(async () => {
  db = (await resetTestDb()) as unknown as Db;
});

const report = (over: Partial<ErrorReportInput> = {}) =>
  clean({
    source: "browser",
    name: "TypeError",
    message: "x is undefined",
    stack: "at load",
    route: "/private/log",
    buildId: "abc",
    agent: "Mozilla/5.0 (Linux; Android 14)",
    ...over,
  });

describe("counting rather than accumulating", () => {
  it("keeps one row for one problem, however often it happens", async () => {
    for (let i = 0; i < 50; i += 1) await recordError(db, report());

    const open = await openErrors(db);
    expect(open).toHaveLength(1);
    expect(open[0].seenCount).toBe(50);
  });

  it("keeps genuinely different problems apart", async () => {
    await recordError(db, report());
    await recordError(db, report({ source: "worker" }));
    await recordError(db, report({ name: "RangeError" }));

    expect(await openErrors(db)).toHaveLength(3);
  });

  it("moves the last-seen time forward", async () => {
    const first = await recordError(db, report());
    const again = await recordError(db, report());

    expect(again.id).toBe(first.id);
    expect(again.lastSeenAt.getTime()).toBeGreaterThanOrEqual(first.firstSeenAt.getTime());
  });

  it("takes the newest stack and build, not the first", async () => {
    // A fix that half-worked shows up as the same fingerprint from a different deploy, and the
    // old stack would send you to the old line numbers.
    await recordError(db, report({ stack: "at old", buildId: "old" }));
    const [row] = await openErrors(db);
    expect(row.buildId).toBe("old");

    await recordError(db, report({ stack: "at new", buildId: "new" }));
    const [updated] = await openErrors(db);
    expect(updated.stack).toBe("at new");
    expect(updated.buildId).toBe("new");
  });
});

describe("resolving", () => {
  it("hides a report once it is dealt with", async () => {
    const row = await recordError(db, report());
    await resolveError(db, row.id);

    expect(await openErrors(db)).toHaveLength(0);
  });

  it("brings it back if it happens again", async () => {
    // "Dealt with" is not "fixed". Silently leaving something resolved is how a real
    // regression stays invisible, and it is the only behaviour that makes hiding it safe.
    const row = await recordError(db, report());
    await resolveError(db, row.id);
    await recordError(db, report());

    const open = await openErrors(db);
    expect(open).toHaveLength(1);
    expect(open[0].id).toBe(row.id);
    expect(open[0].seenCount).toBe(2);
  });

  it("says so when there is nothing to resolve", async () => {
    expect(await resolveError(db, 999_999)).toBeNull();
  });
});

describe("what the dashboard asks", () => {
  it("counts distinct problems, not occurrences", async () => {
    // The badge answers "is something broken". A count of thousands from one loop would say
    // that far louder than it deserves.
    for (let i = 0; i < 20; i += 1) await recordError(db, report());
    await recordError(db, report({ name: "RangeError" }));

    expect(await openErrorCount(db, new Date(Date.now() - 60_000))).toBe(2);
  });

  it("ignores anything older than the window", async () => {
    await recordError(db, report());
    expect(await openErrorCount(db, new Date(Date.now() + 60_000))).toBe(0);
  });

  it("ignores what has been dealt with", async () => {
    const row = await recordError(db, report());
    await resolveError(db, row.id);

    expect(await openErrorCount(db, new Date(Date.now() - 60_000))).toBe(0);
  });

  it("puts the most recent first", async () => {
    await recordError(db, report({ name: "First" }));
    await recordError(db, report({ name: "Second" }));

    expect((await openErrors(db)).map((e) => e.name)).toEqual(["Second", "First"]);
  });
});

describe("what reaches the column", () => {
  it("stores nothing the cleaner would have removed", async () => {
    // The last line of defence, asserted at the storage boundary rather than trusted from the
    // function that runs before it.
    await recordError(
      db,
      report({
        message: "failed for gusev0219@gmail.com",
        route: "/private/academics?gpa=3.8",
        agent: "Mozilla/5.0 (Linux; Android 14; SM-S918B)",
      }),
    );

    const [row] = await openErrors(db);
    expect(row.message).not.toContain("gmail.com");
    expect(row.route).toBe("/private/academics");
    expect(row.agent).toBe("Android");
  });
});
