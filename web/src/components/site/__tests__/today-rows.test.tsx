import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Agenda, nowIndex } from "@/components/site/agenda";
import { SummaryPanel } from "@/components/site/summary-panel";
import { TaskList, type TaskView } from "@/components/site/task-list";
import type { CalendarEvent } from "@/lib/calendar/ics";

/**
 * The three things V4 §5.4 changes about how a row on Today reads.
 *
 * Each of these is a claim that can only be broken silently. An overdue task going back to red,
 * a domain badge losing its word, a summary panel opening itself — none of them throws, none of
 * them fails a typecheck, and all three are the difference between the page Victor asked for
 * and the page he had.
 */

vi.mock("@/app/private/actions", () => ({
  removeTask: vi.fn(),
  undoTask: vi.fn(),
  toggleTask: vi.fn(),
  addTask: vi.fn(),
}));

const TASK: TaskView = {
  id: 1,
  title: "Book the ergometer",
  source: "manual",
  domain: null,
  courseCode: null,
  dueAt: null,
  done: false,
  tags: [],
};

/** An ISO timestamp `days` from now, which is what `dueLabel` reads. */
function due(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

describe("overdue is loud, not red (Q382)", () => {
  it("labels an overdue task in highlight rather than destructive", () => {
    render(<TaskList tasks={[{ ...TASK, dueAt: due(-3) }]} emptyMessage="" showAdd={false} />);

    const label = screen.getByText("3d overdue");
    // Victor's rule, verbatim: red is for failure, and late is not failure. `destructive` is
    // what a broken query looks like in this app, and a task being three days late must not
    // look like the database fell over.
    expect(label.className).toContain("text-highlight");
    expect(label.className).not.toContain("text-destructive");
  });

  it("gives the row an edge, so the signal is not colour alone", () => {
    const { container } = render(
      <TaskList tasks={[{ ...TASK, dueAt: due(-1) }]} emptyMessage="" showAdd={false} />,
    );

    // Rule 10. The words "1d overdue" carry it for a reader; the left rule carries it for the
    // eye scanning fifteen rows, and neither is a hue on its own.
    expect(container.querySelector(".border-l-2")).not.toBeNull();
  });

  it("leaves a task due today alone", () => {
    render(<TaskList tasks={[{ ...TASK, dueAt: due(0) }]} emptyMessage="" showAdd={false} />);

    const label = screen.getByText("today");
    expect(label.className).toContain("text-primary");
  });
});

describe("domain shows as icon plus word (Q381)", () => {
  it("writes the domain out, and labels the icon for a screen reader", () => {
    render(<TaskList tasks={[{ ...TASK, domain: "athletics" }]} emptyMessage="" showAdd={false} />);

    // The word is present in the DOM at every width — `phone-hidden` is a media rule, so this
    // asserts the text exists rather than that it is painted. The label is what a screen
    // reader gets when the word is hidden.
    expect(screen.getByLabelText("athletics")).toBeInTheDocument();
    expect(screen.getByText("athletics")).toBeInTheDocument();
  });

  it("shows the course code instead when there is one", () => {
    render(
      <TaskList
        tasks={[{ ...TASK, domain: "academics", courseCode: "PHYS 260" }]}
        emptyMessage=""
        showAdd={false}
      />,
    );

    // "PHYS 260" is "academics" said precisely. Both would be two badges plus a date in front
    // of a title on a 360px row.
    expect(screen.getByText("PHYS 260")).toBeInTheDocument();
    expect(screen.queryByText("academics")).toBeNull();
  });

  it("shows nothing for a domain it does not know", () => {
    render(<TaskList tasks={[{ ...TASK, domain: "gardening" }]} emptyMessage="" showAdd={false} />);

    expect(screen.queryByLabelText("gardening")).toBeNull();
  });
});

describe("the agenda's now marker (Q387)", () => {
  const event = (hour: number, allDay = false): CalendarEvent =>
    ({
      uid: `e${hour}`,
      summary: `Event ${hour}`,
      start: new Date(`2026-09-21T${String(hour).padStart(2, "0")}:00:00-07:00`),
      end: new Date(`2026-09-21T${String(hour + 1).padStart(2, "0")}:00:00-07:00`),
      allDay,
      location: "",
    }) as CalendarEvent;

  it("sits before the first event that has not started", () => {
    const events = [event(9), event(13), event(17)];
    const at = new Date("2026-09-21T11:00:00-07:00");
    expect(nowIndex(events, at)).toBe(1);
  });

  it("falls to the bottom once the day is behind you", () => {
    const events = [event(9), event(13)];
    expect(nowIndex(events, new Date("2026-09-21T21:00:00-07:00"))).toBe(2);
  });

  it("survives the evening, when UTC has already moved to tomorrow", () => {
    // 6pm in Los Angeles is the 22nd in UTC. Comparing UTC dates — the obvious way to ask
    // "same day" — suppresses the marker every evening, which is when an agenda is read.
    const events = [event(18), event(20)];
    const at = new Date("2026-09-21T18:30:00-07:00");
    expect(nowIndex(events, at)).toBe(1);
  });

  it("stays off a list that is not today's", () => {
    const events = [event(9)];
    expect(nowIndex(events, new Date("2026-09-24T09:30:00-07:00"))).toBeNull();
  });

  it("stays off a list with no timed events", () => {
    expect(nowIndex([event(9, true)], new Date("2026-09-21T11:00:00-07:00"))).toBeNull();
  });

  it("is not drawn at all when no time is passed", () => {
    render(<Agenda events={[event(9), event(13)]} />);
    expect(screen.queryByText("now")).toBeNull();
  });

  it("is drawn, with the time on it, when one is", () => {
    render(<Agenda events={[event(9), event(13)]} now={new Date("2026-09-21T11:00:00-07:00")} />);
    expect(screen.getByText("now")).toBeInTheDocument();
    expect(screen.getByText("11:00 AM")).toBeInTheDocument();
  });
});

describe("summaries are quiet, closed and marked (Q378, Q388, Q389)", () => {
  it("is closed until it is opened", () => {
    const { container } = render(
      <SummaryPanel title="Today, summarised" model="gemini-2.5-flash" text="A quiet day." />,
    );

    const details = container.querySelector("details");
    expect(details).not.toBeNull();
    expect(details?.open).toBe(false);
  });

  it("keeps the model name on screen", () => {
    render(<SummaryPanel title="Today, summarised" model="gemini-2.5-flash" text="A day." />);

    // Q388: marked as machine-written, and the model name stays. A sparkle on its own is
    // decoration that happens to mean something.
    expect(screen.getByText("gemini-2.5-flash")).toBeInTheDocument();
    expect(screen.getByText("Written by")).toBeInTheDocument();
  });

  it("says something sensible when the model name was never stored", () => {
    render(<SummaryPanel title="Today, summarised" model="" text="A day." />);
    expect(screen.getByText("a model")).toBeInTheDocument();
  });
});
