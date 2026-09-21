// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";

import { planOverrides } from "@/lib/db/schema";
import { resetTestDb } from "@/test/pg";
import { clearPlanOverride, listPlanOverrides, setPlanOverride, type Db } from "../queries";

/**
 * Against real Postgres — PGlite compiled to WASM, running the committed migration SQL.
 *
 * The interesting cases here are ones a mock cannot see: the unique index on `plan_date` is
 * what makes a double-submit idempotent rather than producing two rows for one day, and
 * `date({ mode: "string" })` is what keeps the key an ISO day rather than a timezone-shifted
 * `Date`. Both have to be exercised by the database to mean anything.
 */

let db: Db;

beforeEach(async () => {
  db = (await resetTestDb()) as unknown as Db;
});

const BASE = {
  name: null,
  detail: null,
  type: null,
  meters: null,
  note: "",
} as const;

describe("setPlanOverride", () => {
  it("writes a row that reads back under its day", async () => {
    await setPlanOverride(db, {
      ...BASE,
      date: "2026-10-18",
      name: "3 x 2k",
      meters: 6000,
      type: "quality",
      note: "perg was taken",
    });

    const rows = await listPlanOverrides(db);
    expect(rows.get("2026-10-18")).toEqual({
      date: "2026-10-18",
      name: "3 x 2k",
      detail: null,
      type: "quality",
      meters: 6000,
      note: "perg was taken",
    });
  });

  it("replaces rather than duplicating when the same day is saved twice", async () => {
    await setPlanOverride(db, { ...BASE, date: "2026-10-18", meters: 6000 });
    await setPlanOverride(db, { ...BASE, date: "2026-10-18", meters: 8000 });

    const all = await db.select().from(planOverrides);
    expect(all).toHaveLength(1);
    expect((await listPlanOverrides(db)).get("2026-10-18")?.meters).toBe(8000);
  });

  it("clears a field that the second save leaves empty", async () => {
    // The upsert writes every column, so this is "the day now reads like this" rather than a
    // patch. A partial update would leave the old name stranded behind the new one.
    await setPlanOverride(db, { ...BASE, date: "2026-10-18", name: "3 x 2k", meters: 6000 });
    await setPlanOverride(db, { ...BASE, date: "2026-10-18", meters: 6000 });

    expect((await listPlanOverrides(db)).get("2026-10-18")?.name).toBeNull();
  });

  it("keeps the day as a plain ISO string, not a shifted timestamp", async () => {
    await setPlanOverride(db, { ...BASE, date: "2026-01-01", meters: 1000 });
    expect([...(await listPlanOverrides(db)).keys()]).toEqual(["2026-01-01"]);
  });

  it("holds more than one day at a time", async () => {
    await setPlanOverride(db, { ...BASE, date: "2026-10-18", meters: 6000 });
    await setPlanOverride(db, { ...BASE, date: "2026-10-19", meters: 7000 });

    const rows = await listPlanOverrides(db);
    expect(rows.size).toBe(2);
    expect(rows.get("2026-10-19")?.meters).toBe(7000);
  });
});

describe("listPlanOverrides", () => {
  it("is empty on a fresh database rather than throwing", async () => {
    expect((await listPlanOverrides(db)).size).toBe(0);
  });

  it("drops a session type the current build does not know", async () => {
    // `type` is free text in the column on purpose (D-230's rule), so a build that has been
    // rolled back must not crash on a value a newer one wrote. Dropping it falls through to
    // the vault's type, which is the safe answer.
    await db.insert(planOverrides).values({ planDate: "2026-10-18", type: "brunch" });

    expect((await listPlanOverrides(db)).get("2026-10-18")?.type).toBeNull();
  });
});

describe("clearPlanOverride", () => {
  it("removes the row so the day falls back to the vault", async () => {
    await setPlanOverride(db, { ...BASE, date: "2026-10-18", meters: 6000 });
    await clearPlanOverride(db, "2026-10-18");

    expect((await listPlanOverrides(db)).size).toBe(0);
    expect(await db.select().from(planOverrides)).toHaveLength(0);
  });

  it("is a no-op on a day that was never changed", async () => {
    await expect(clearPlanOverride(db, "2026-10-18")).resolves.toBeUndefined();
  });

  it("leaves the other days alone", async () => {
    await setPlanOverride(db, { ...BASE, date: "2026-10-18", meters: 6000 });
    await setPlanOverride(db, { ...BASE, date: "2026-10-19", meters: 7000 });
    await clearPlanOverride(db, "2026-10-18");

    const rows = await listPlanOverrides(db);
    expect([...rows.keys()]).toEqual(["2026-10-19"]);
  });
});
