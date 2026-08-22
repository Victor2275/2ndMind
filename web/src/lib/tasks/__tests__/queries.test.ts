// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";

import { resetTestDb } from "@/test/pg";
import {
  countOpen,
  createTask,
  currentGoals,
  dayBounds,
  deleteTask,
  listDoneBetween,
  listDueBy,
  listTasks,
  replaceGoals,
  restoreTask,
  setTaskDone,
  upsertExternalTask,
  zoneOffsetMinutes,
  type Db,
} from "../queries";

let db: Db;

beforeEach(async () => {
  db = (await resetTestDb()) as unknown as Db;
});

const at = (iso: string) => new Date(iso);

describe("dayBounds", () => {
  // Los Angeles in summer is UTC-7, which getTimezoneOffset() reports as +420. The sign is
  // the opposite of how people say it out loud, so both directions are pinned here.
  const LA = 420;

  it("uses the viewer's midnight, not the server's", () => {
    // 23:30 UTC is still 16:30 on the 21st in Los Angeles — the same day, not the next.
    const { start, end } = dayBounds(at("2026-08-21T23:30:00Z"), LA);
    expect(start.toISOString()).toBe("2026-08-21T07:00:00.000Z");
    expect(end.toISOString()).toBe("2026-08-22T07:00:00.000Z");
  });

  it("rolls over at local midnight rather than UTC midnight", () => {
    // 07:30 UTC on the 22nd is 00:30 local — already the new day.
    const { start } = dayBounds(at("2026-08-22T07:30:00Z"), LA);
    expect(start.toISOString()).toBe("2026-08-22T07:00:00.000Z");
  });

  it("does not roll over early just because UTC has", () => {
    // 02:00 UTC on the 22nd is still 19:00 on the 21st in LA. A naive UTC floor would call
    // this the 22nd and empty the Today screen at seven in the evening.
    const { start } = dayBounds(at("2026-08-22T02:00:00Z"), LA);
    expect(start.toISOString()).toBe("2026-08-21T07:00:00.000Z");
  });

  it("handles a positive-offset timezone", () => {
    // Taipei is UTC+8, reported as -480.
    const { start } = dayBounds(at("2026-08-21T20:00:00Z"), -480);
    // 20:00 UTC is 04:00 on the 22nd in Taipei, so the day started at 16:00 UTC on the 21st.
    expect(start.toISOString()).toBe("2026-08-21T16:00:00.000Z");
  });
});

describe("createTask and listTasks", () => {
  it("stores a task with its source", async () => {
    await createTask(db, { title: "Write M51A lab", source: "manual", domain: "academics" });
    const [task] = await listTasks(db);
    expect(task.title).toBe("Write M51A lab");
    expect(task.source).toBe("manual");
    expect(task.doneAt).toBeNull();
    expect(task.deletedAt).toBeNull();
  });

  it("sorts undated tasks after dated ones", async () => {
    await createTask(db, { title: "someday", source: "manual" });
    await createTask(db, { title: "tomorrow", source: "manual", dueAt: at("2026-08-22T12:00:00Z") });
    await createTask(db, { title: "today", source: "manual", dueAt: at("2026-08-21T12:00:00Z") });

    // The bug this guards: ascending order in Postgres puts NULLs *first* by default, so
    // every undated backlog item would sit above the thing due in an hour.
    expect((await listTasks(db)).map((t) => t.title)).toEqual(["today", "tomorrow", "someday"]);
  });

  it("hides completed tasks unless asked", async () => {
    const task = await createTask(db, { title: "done thing", source: "manual" });
    await setTaskDone(db, task.id, true);

    expect(await listTasks(db)).toEqual([]);
    expect((await listTasks(db, { includeDone: true })).map((t) => t.title)).toEqual([
      "done thing",
    ]);
  });
});

describe("setTaskDone", () => {
  it("marks done and undone", async () => {
    const task = await createTask(db, { title: "toggle me", source: "manual" });

    const done = await setTaskDone(db, task.id, true);
    expect(done?.doneAt).toBeInstanceOf(Date);

    const undone = await setTaskDone(db, task.id, false);
    expect(undone?.doneAt).toBeNull();
  });

  it("returns null for an id that is not there, rather than pretending", async () => {
    expect(await setTaskDone(db, 9999, true)).toBeNull();
  });

  it("will not resurrect a deleted task", async () => {
    const task = await createTask(db, { title: "gone", source: "manual" });
    await deleteTask(db, task.id);
    expect(await setTaskDone(db, task.id, true)).toBeNull();
  });
});

describe("delete and undo", () => {
  it("soft-deletes so the row survives", async () => {
    const task = await createTask(db, { title: "oops", source: "manual" });
    await deleteTask(db, task.id);

    expect(await listTasks(db)).toEqual([]);
    expect(await listTasks(db, { includeDone: true })).toEqual([]);
  });

  it("restores a deleted task with its fields intact", async () => {
    const task = await createTask(db, {
      title: "recover me",
      source: "manual",
      notes: "important",
      dueAt: at("2026-08-25T12:00:00Z"),
    });
    await deleteTask(db, task.id);

    const restored = await restoreTask(db, task.id);
    expect(restored?.title).toBe("recover me");
    expect(restored?.notes).toBe("important");
    expect(restored?.deletedAt).toBeNull();
    expect((await listTasks(db)).map((t) => t.title)).toEqual(["recover me"]);
  });

  it("deleting twice is not an error the second time round", async () => {
    const task = await createTask(db, { title: "x", source: "manual" });
    expect(await deleteTask(db, task.id)).not.toBeNull();
    // Already gone: reports null rather than silently claiming another delete.
    expect(await deleteTask(db, task.id)).toBeNull();
  });
});

describe("listDueBy", () => {
  it("returns overdue and due-today, but not later or undated", async () => {
    await createTask(db, { title: "overdue", source: "manual", dueAt: at("2026-08-19T12:00:00Z") });
    await createTask(db, { title: "today", source: "manual", dueAt: at("2026-08-21T12:00:00Z") });
    await createTask(db, { title: "next week", source: "manual", dueAt: at("2026-08-28T12:00:00Z") });
    await createTask(db, { title: "someday", source: "manual" });

    const due = await listDueBy(db, at("2026-08-22T07:00:00Z"));
    expect(due.map((t) => t.title)).toEqual(["overdue", "today"]);
  });

  it("excludes completed work", async () => {
    const task = await createTask(db, {
      title: "finished",
      source: "manual",
      dueAt: at("2026-08-21T12:00:00Z"),
    });
    await setTaskDone(db, task.id, true);
    expect(await listDueBy(db, at("2026-08-22T07:00:00Z"))).toEqual([]);
  });
});

describe("listDoneBetween", () => {
  it("finds what was completed inside the window", async () => {
    const a = await createTask(db, { title: "a", source: "manual" });
    await setTaskDone(db, a.id, true);

    const now = new Date();
    const done = await listDoneBetween(
      db,
      new Date(now.getTime() - 60_000),
      new Date(now.getTime() + 60_000),
    );
    expect(done.map((t) => t.title)).toEqual(["a"]);
  });

  it("excludes work completed outside the window", async () => {
    const a = await createTask(db, { title: "a", source: "manual" });
    await setTaskDone(db, a.id, true);

    const done = await listDoneBetween(db, at("2020-01-01T00:00:00Z"), at("2020-01-02T00:00:00Z"));
    expect(done).toEqual([]);
  });
});

describe("upsertExternalTask", () => {
  it("inserts a feed row", async () => {
    await upsertExternalTask(db, {
      title: "PS3 due",
      source: "canvas",
      externalId: "canvas:ps3",
      courseCode: "M51A",
      dueAt: at("2026-10-01T23:59:00Z"),
    });
    expect((await listTasks(db)).map((t) => t.title)).toEqual(["PS3 due"]);
  });

  it("updates rather than duplicating when the feed is re-read", async () => {
    const base = {
      source: "canvas" as const,
      externalId: "canvas:ps3",
      courseCode: "M51A",
    };
    await upsertExternalTask(db, { ...base, title: "PS3 due", dueAt: at("2026-10-01T23:59:00Z") });
    await upsertExternalTask(db, {
      ...base,
      title: "PS3 due (extended)",
      dueAt: at("2026-10-03T23:59:00Z"),
    });

    const all = await listTasks(db);
    expect(all).toHaveLength(1);
    expect(all[0].title).toBe("PS3 due (extended)");
    expect(all[0].dueAt?.toISOString()).toBe("2026-10-03T23:59:00.000Z");
  });

  it("does not un-tick something already completed", async () => {
    const base = { source: "canvas" as const, externalId: "canvas:ps3" };
    const task = await upsertExternalTask(db, { ...base, title: "PS3" });
    await setTaskDone(db, task.id, true);

    await upsertExternalTask(db, { ...base, title: "PS3" });

    // Re-syncing a feed must not resurrect work you have already finished.
    const [row] = await listTasks(db, { includeDone: true });
    expect(row.doneAt).not.toBeNull();
  });

  it("lets hand-typed tasks coexist, since their external id is null", async () => {
    await createTask(db, { title: "one", source: "manual" });
    await createTask(db, { title: "two", source: "manual" });
    await createTask(db, { title: "three", source: "manual" });
    // If the unique index treated nulls as equal, the second insert would have thrown.
    expect(await countOpen(db)).toBe(3);
  });
});

describe("goals", () => {
  it("replaces the previous set", async () => {
    await replaceGoals(db, [
      { title: "Ship V2 foundation", domain: "engineering" },
      { title: "Erg 3x", domain: "athletics" },
    ]);
    await replaceGoals(db, [{ title: "Ship the redesign", domain: "engineering" }]);

    expect((await currentGoals(db)).map((g) => g.title)).toEqual(["Ship the redesign"]);
  });

  it("keeps the old set recoverable rather than dropping it", async () => {
    const [first] = await replaceGoals(db, [{ title: "old goal", domain: "engineering" }]);
    await replaceGoals(db, [{ title: "new goal", domain: "engineering" }]);

    const restored = await restoreTask(db, first.id);
    expect(restored?.title).toBe("old goal");
  });

  it("does not disturb non-goal tasks", async () => {
    await createTask(db, { title: "a real task", source: "manual" });
    await replaceGoals(db, [{ title: "a goal", domain: "engineering" }]);

    expect((await listTasks(db)).map((t) => t.title).sort()).toEqual(["a goal", "a real task"]);
  });

  it("accepts an empty set, clearing the week", async () => {
    await replaceGoals(db, [{ title: "old", domain: "engineering" }]);
    expect(await replaceGoals(db, [])).toEqual([]);
    expect(await currentGoals(db)).toEqual([]);
  });
});

describe("countOpen", () => {
  it("counts only live, unfinished tasks", async () => {
    const a = await createTask(db, { title: "a", source: "manual" });
    const b = await createTask(db, { title: "b", source: "manual" });
    await createTask(db, { title: "c", source: "manual" });

    await setTaskDone(db, a.id, true);
    await deleteTask(db, b.id);

    expect(await countOpen(db)).toBe(1);
  });
});

describe("zoneOffsetMinutes", () => {
  it("reports Los Angeles daylight time as +420", () => {
    expect(zoneOffsetMinutes(new Date("2026-08-22T12:00:00Z"))).toBe(420);
  });

  it("reports Los Angeles standard time as +480", () => {
    // The bug this replaced: a hard-coded 420 stayed in use past the November changeover,
    // which starts "today" at 11pm the night before for the whole of winter term.
    expect(zoneOffsetMinutes(new Date("2026-12-22T12:00:00Z"))).toBe(480);
  });

  it("switches on the right date", () => {
    // DST ends 2026-11-01 at 02:00 local. 08:00 UTC is 01:00 PDT, still daylight time;
    // 10:00 UTC is 02:00 PST, standard.
    expect(zoneOffsetMinutes(new Date("2026-11-01T08:00:00Z"))).toBe(420);
    expect(zoneOffsetMinutes(new Date("2026-11-01T10:00:00Z"))).toBe(480);
  });

  it("handles a zone east of Greenwich, where the sign flips", () => {
    expect(zoneOffsetMinutes(new Date("2026-08-22T12:00:00Z"), "Asia/Taipei")).toBe(-480);
  });

  it("handles UTC itself", () => {
    expect(zoneOffsetMinutes(new Date("2026-08-22T12:00:00Z"), "UTC")).toBe(0);
  });

  it("keeps midnight from reading as hour 24", () => {
    // Some ICU builds format midnight as "24" under hour12:false, which would put the
    // offset a day out. `hourCycle: "h23"` is what prevents it.
    expect(zoneOffsetMinutes(new Date("2026-08-22T07:00:00Z"))).toBe(420);
  });
});
