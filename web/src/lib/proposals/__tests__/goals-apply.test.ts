// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";

import { applyApprovals, fingerprint, isStale } from "../types";
import { resetTestDb } from "@/test/pg";
import { currentGoals, replaceGoals, type Db } from "@/lib/tasks/queries";

/**
 * Partial approval against real Postgres, not a mock.
 *
 * The plan's acceptance test is "a rejected item leaves no trace in Postgres", and that is a
 * claim about rows — `replaceGoals` soft-deletes the whole set before inserting, so a merge
 * bug would not throw, it would quietly drop the goals Victor did not approve.
 */

let db: Db;

beforeEach(async () => {
  db = (await resetTestDb()) as unknown as Db;
});

const DOMAINS = ["engineering", "athletics", "academics"];

async function state(): Promise<{ key: string; value: string }[]> {
  const rows = await currentGoals(db);
  return DOMAINS.map((key) => ({
    key,
    value: rows.find((r) => r.domain === key)?.title ?? "",
  }));
}

async function seed() {
  await replaceGoals(db, [
    { domain: "engineering", title: "Ship the Working page" },
    { domain: "athletics", title: "Three erg sessions" },
    { domain: "academics", title: "Finish the lab report" },
  ]);
}

async function titles(): Promise<Record<string, string>> {
  return Object.fromEntries((await currentGoals(db)).map((g) => [g.domain ?? "", g.title]));
}

describe("approving part of a proposal", () => {
  it("writes the approved goal and leaves the rejected ones exactly as they were", async () => {
    await seed();
    const before = await state();

    await replaceGoals(
      db,
      applyApprovals(before, [{ key: "engineering", value: "Write the Proof case study" }]).map(
        (n) => ({ domain: n.key, title: n.value }),
      ),
    );

    expect(await titles()).toEqual({
      engineering: "Write the Proof case study",
      athletics: "Three erg sessions",
      academics: "Finish the lab report",
    });
  });

  it("keeps the rejected rows alive, not soft-deleted and rewritten away", async () => {
    await seed();
    const before = await state();
    await replaceGoals(
      db,
      applyApprovals(before, [{ key: "athletics", value: "Four erg sessions" }]).map((n) => ({
        domain: n.key,
        title: n.value,
      })),
    );

    // Three goals, not one. The failure this guards against is a merge that passes only the
    // approved item to `replaceGoals` and silently loses the other two.
    expect(await currentGoals(db)).toHaveLength(3);
  });

  it("removes a goal when an approved value is empty", async () => {
    await seed();
    const before = await state();
    await replaceGoals(
      db,
      applyApprovals(before, [{ key: "academics", value: "" }]).map((n) => ({
        domain: n.key,
        title: n.value,
      })),
    );

    expect(Object.keys(await titles()).sort()).toEqual(["athletics", "engineering"]);
  });

  it("adds a goal for a domain that had none", async () => {
    await replaceGoals(db, [{ domain: "engineering", title: "Ship the Working page" }]);
    const before = await state();
    await replaceGoals(
      db,
      applyApprovals(before, [{ key: "athletics", value: "Three erg sessions" }]).map((n) => ({
        domain: n.key,
        title: n.value,
      })),
    );

    expect(await titles()).toEqual({
      engineering: "Ship the Working page",
      athletics: "Three erg sessions",
    });
  });
});

describe("staleness against live rows", () => {
  it("does not fire when nothing changed", async () => {
    await seed();
    const basis = fingerprint(await state());
    expect(isStale({ basis }, await state())).toBe(false);
  });

  it("fires when a goal was edited after the proposal was built", async () => {
    // The real sequence: draft on the laptop, edit a goal, approve on the phone. Without
    // this the approval overwrites the edit with a value chosen before it existed.
    await seed();
    const basis = fingerprint(await state());

    await replaceGoals(db, [
      { domain: "engineering", title: "Ship the Working page and write the case study" },
      { domain: "athletics", title: "Three erg sessions" },
      { domain: "academics", title: "Finish the lab report" },
    ]);

    expect(isStale({ basis }, await state())).toBe(true);
  });

  it("fires when a goal was deleted after the proposal was built", async () => {
    await seed();
    const basis = fingerprint(await state());
    await replaceGoals(db, [{ domain: "engineering", title: "Ship the Working page" }]);
    expect(isStale({ basis }, await state())).toBe(true);
  });

  it("survives the rows being recreated with the same content", async () => {
    // `replaceGoals` soft-deletes and re-inserts, so every save produces new ids. A
    // fingerprint that depended on them would report every proposal as stale.
    await seed();
    const basis = fingerprint(await state());
    await seed();
    expect(isStale({ basis }, await state())).toBe(false);
  });
});
