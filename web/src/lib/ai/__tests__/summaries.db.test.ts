// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";

import { resetTestDb } from "@/test/pg";
import type { Db } from "@/lib/tasks/queries";
import { localDay, recentSummaries, recordSummary, summaryFor } from "../summaries";

/**
 * Against the committed migration SQL in PGlite, not a mock — the upsert is the whole
 * behaviour here, and `onConflictDoUpdate` against a unique index is exactly the kind of
 * thing a mock would report as working while the real constraint disagreed.
 */

let db: Db;

beforeEach(async () => {
  db = (await resetTestDb()) as unknown as Db;
});

describe("recordSummary", () => {
  it("stores a summary and reads it back", async () => {
    await recordSummary(db, {
      kind: "daily",
      periodStart: "2026-08-30",
      summary: "Shipped the sheet reader.",
      model: "gemini-3.6-flash",
    });

    const row = await summaryFor(db, "daily", "2026-08-30");
    expect(row?.summary).toBe("Shipped the sheet reader.");
    expect(row?.model).toBe("gemini-3.6-flash");
  });

  it("replaces the earlier summary for the same day rather than appending", async () => {
    // The daily summary is regenerated as the day fills in. Appending would leave a pile of
    // half-days with no way to tell which one described the day as it ended.
    await recordSummary(db, { kind: "daily", periodStart: "2026-08-30", summary: "Morning." });
    await recordSummary(db, { kind: "daily", periodStart: "2026-08-30", summary: "Whole day." });

    const rows = await recentSummaries(db, { kind: "daily" });
    expect(rows).toHaveLength(1);
    expect(rows[0].summary).toBe("Whole day.");
  });

  it("keeps the daily and weekly summaries for the same date apart", async () => {
    // A week is keyed by its first day, which is frequently also a day with its own summary.
    // Without `kind` in the unique index one would silently overwrite the other.
    await recordSummary(db, { kind: "daily", periodStart: "2026-08-24", summary: "One day." });
    await recordSummary(db, { kind: "weekly", periodStart: "2026-08-24", summary: "One week." });

    expect((await summaryFor(db, "daily", "2026-08-24"))?.summary).toBe("One day.");
    expect((await summaryFor(db, "weekly", "2026-08-24"))?.summary).toBe("One week.");
  });

  it("refuses to store an empty summary", async () => {
    // Fallback text like "Nothing logged yet today" must never land here: months on it is
    // indistinguishable from a day when nothing actually happened.
    expect(
      await recordSummary(db, { kind: "daily", periodStart: "2026-08-30", summary: "   " }),
    ).toBeNull();
    expect(await recentSummaries(db)).toHaveLength(0);
  });

  it("trims what it stores", async () => {
    await recordSummary(db, { kind: "daily", periodStart: "2026-08-30", summary: "  Done.\n" });
    expect((await summaryFor(db, "daily", "2026-08-30"))?.summary).toBe("Done.");
  });

  it("returns null for a period with nothing stored", async () => {
    expect(await summaryFor(db, "daily", "2026-01-01")).toBeNull();
  });
});

describe("recentSummaries", () => {
  beforeEach(async () => {
    for (const d of ["2026-08-26", "2026-08-27", "2026-08-28"]) {
      await recordSummary(db, { kind: "daily", periodStart: d, summary: `day ${d}` });
    }
    await recordSummary(db, { kind: "weekly", periodStart: "2026-08-24", summary: "the week" });
  });

  it("returns newest first — this is a record being read back, not a queue", async () => {
    const rows = await recentSummaries(db, { kind: "daily" });
    expect(rows.map((r) => r.periodStart)).toEqual(["2026-08-28", "2026-08-27", "2026-08-26"]);
  });

  it("filters by kind", async () => {
    expect(await recentSummaries(db, { kind: "weekly" })).toHaveLength(1);
  });

  it("returns both kinds when none is named", async () => {
    expect(await recentSummaries(db)).toHaveLength(4);
  });

  it("filters by date", async () => {
    const rows = await recentSummaries(db, { since: "2026-08-27" });
    expect(rows.map((r) => r.periodStart)).toEqual(["2026-08-28", "2026-08-27"]);
  });

  it("honours a limit", async () => {
    expect(await recentSummaries(db, { limit: 2 })).toHaveLength(2);
  });
});

describe("localDay", () => {
  it("gives the local date, not the UTC one", () => {
    // 2026-08-30 18:30 UTC is still the 30th in Los Angeles (UTC-7); the naive UTC slice
    // agrees here, so the interesting case is the one below.
    expect(localDay(new Date("2026-08-30T18:30:00Z"), 420)).toBe("2026-08-30");
  });

  it("does not roll a late-evening entry into tomorrow", () => {
    // 2026-08-31 05:00 UTC is 2026-08-30 22:00 in Los Angeles. Storing it as the 31st would
    // file an evening's work under the next day, which is the same class of bug the noon-UTC
    // due-date convention exists to avoid.
    expect(localDay(new Date("2026-08-31T05:00:00Z"), 420)).toBe("2026-08-30");
  });
});
