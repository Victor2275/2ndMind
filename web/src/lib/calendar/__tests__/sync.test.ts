// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { CalendarEvent } from "../ics";
import { splitCanvasTitle, toAssignmentTasks } from "../sync";

function event(over: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    uid: "abc@instructure.com",
    summary: "Problem Set 3 [COM SCI M51A]",
    location: "",
    description: "",
    start: new Date("2026-10-05T23:59:00Z"),
    end: new Date("2026-10-05T23:59:00Z"),
    allDay: true,
    ...over,
  };
}

describe("splitCanvasTitle", () => {
  it("pulls the course code out of trailing brackets", () => {
    expect(splitCanvasTitle("Problem Set 3 [COM SCI M51A]")).toEqual({
      title: "Problem Set 3",
      courseCode: "COM SCI M51A",
    });
  });

  it("keeps a title with no brackets whole", () => {
    expect(splitCanvasTitle("Midterm review session")).toEqual({
      title: "Midterm review session",
      courseCode: null,
    });
  });

  it("keeps brackets that are the entire title", () => {
    // Not a course code — dropping the title would leave an unidentifiable task.
    expect(splitCanvasTitle("[TBD]")).toEqual({ title: "[TBD]", courseCode: null });
  });

  it("does not take brackets from the middle of a title", () => {
    expect(splitCanvasTitle("Read chapter [2] before class")).toEqual({
      title: "Read chapter [2] before class",
      courseCode: null,
    });
  });

  it("trims surrounding whitespace", () => {
    expect(splitCanvasTitle("  Lab 1   [EE 3]  ")).toEqual({ title: "Lab 1", courseCode: "EE 3" });
  });
});

describe("toAssignmentTasks", () => {
  it("converts an assignment into a task row", () => {
    const [task] = toAssignmentTasks([event()]);
    expect(task).toEqual({
      title: "Problem Set 3",
      externalId: "canvas:abc@instructure.com",
      source: "canvas",
      domain: "academics",
      courseCode: "COM SCI M51A",
      dueAt: new Date("2026-10-05T23:59:00Z"),
      notes: "",
    });
  });

  it("produces the same external id on a second read, so a re-sync updates", () => {
    const first = toAssignmentTasks([event()]);
    const second = toAssignmentTasks([event()]);
    expect(first[0].externalId).toBe(second[0].externalId);
  });

  it("drops a duplicate uid within one feed rather than upserting it twice", () => {
    const tasks = toAssignmentTasks([event(), event()]);
    expect(tasks).toHaveLength(1);
  });

  it("keeps distinct occurrences of a recurring entry apart", () => {
    // parseIcs appends the occurrence start to a recurring uid, which is what makes these
    // separate tasks rather than one overwriting the other.
    const tasks = toAssignmentTasks([
      event({ uid: "weekly@x:2026-10-05T23:59:00.000Z" }),
      event({ uid: "weekly@x:2026-10-12T23:59:00.000Z" }),
    ]);
    expect(tasks).toHaveLength(2);
  });

  it("carries a location into the notes", () => {
    const [task] = toAssignmentTasks([event({ location: "Boelter 3400" })]);
    expect(task.notes).toBe("Location: Boelter 3400");
  });

  it("leaves notes empty rather than writing 'Location: undefined'", () => {
    const [task] = toAssignmentTasks([event({ location: "" })]);
    expect(task.notes).toBe("");
  });

  it("skips an entry with no title", () => {
    expect(toAssignmentTasks([event({ summary: "   " })])).toEqual([]);
  });

  it("returns nothing for an empty feed, which is what Canvas gives before term", () => {
    expect(toAssignmentTasks([])).toEqual([]);
  });

  it("keeps timed entries as well as all-day ones", () => {
    const tasks = toAssignmentTasks([
      event({ uid: "a@x", allDay: true }),
      event({ uid: "b@x", allDay: false, summary: "Office hours [EE 3]" }),
    ]);
    expect(tasks).toHaveLength(2);
    expect(tasks[1].title).toBe("Office hours");
  });
});
