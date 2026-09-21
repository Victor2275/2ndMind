// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { CalendarView } from "@/components/site/calendar-view";
import { MonthGrid, dayKey, type SourcedDay } from "@/components/site/month-grid";
import type { CalendarEvent } from "@/lib/calendar/ics";

/**
 * The month grid and the agenda/month switch (V4 §5.8, Q422, Q423).
 *
 * The grid is pure — it draws what it is handed — so what is worth pinning is the arithmetic
 * nobody would notice being wrong: the cells cover the month, the current day is marked, and a
 * day with events from both feeds carries both marks. The switch is pinned because "remembered
 * per device" and "the first paint is the agenda" are a pair of claims that fight each other if
 * the storage read moves into render.
 */

const event = (iso: string, summary: string): CalendarEvent =>
  ({
    uid: summary,
    summary,
    location: "",
    description: "",
    start: new Date(iso),
    end: new Date(iso),
    allDay: false,
  }) as CalendarEvent;

const SEPTEMBER = new Date(Date.UTC(2026, 8, 1, 12));

const days: SourcedDay[] = [
  {
    day: "2026-09-21",
    google: [event("2026-09-21T17:00:00Z", "Practice")],
    canvas: [event("2026-09-21T20:00:00Z", "PHYS 260 problem set")],
  },
  {
    day: "2026-09-23",
    google: [
      event("2026-09-23T17:00:00Z", "Lecture"),
      event("2026-09-23T19:00:00Z", "Lab"),
      event("2026-09-23T21:00:00Z", "Erg"),
    ],
    canvas: [],
  },
];

describe("the month grid", () => {
  it("covers the month in six weeks, headed by the month's name", () => {
    const { container } = render(<MonthGrid days={days} month={SEPTEMBER} today="2026-09-21" />);

    expect(screen.getByText("September 2026")).toBeInTheDocument();
    // 42 cells plus seven weekday headings. Six weeks rather than "as many as it takes": a grid
    // that changes height between months moves everything under it.
    expect(container.querySelectorAll(".grid > div")).toHaveLength(49);
  });

  it("names both feeds, so a mark is never the only signal", () => {
    render(<MonthGrid days={days} month={SEPTEMBER} today="2026-09-21" />);
    expect(screen.getByText("Google")).toBeInTheDocument();
    expect(screen.getByText("Canvas")).toBeInTheDocument();
  });

  it("lists two events in a cell and counts the rest", () => {
    render(<MonthGrid days={days} month={SEPTEMBER} today="2026-09-21" />);

    expect(screen.getByText("Lecture")).toBeInTheDocument();
    expect(screen.getByText("Lab")).toBeInTheDocument();
    // The third is counted rather than dropped: a busy Thursday must not look like a quiet one.
    expect(screen.getByText("+1")).toBeInTheDocument();
    expect(screen.queryByText("Erg")).toBeNull();
  });

  it("agrees with groupByDay about which day an evening event belongs to", () => {
    // 6pm in Los Angeles is the next day in UTC. `dayKey` is the same `en-CA` formatter the
    // agenda groups by, so a cell and a row cannot disagree.
    expect(dayKey(new Date("2026-09-22T01:00:00Z"))).toBe("2026-09-21");
  });
});

describe("the view switch", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("opens on the agenda", () => {
    render(<CalendarView agenda={<p>agenda here</p>} month={<p>month here</p>} />);

    // Both subtrees are rendered on the server and one is hidden, so this asserts which is
    // *shown* rather than which exists.
    expect(screen.getByText("agenda here").closest("div")).not.toHaveAttribute("hidden");
    expect(screen.getByText("month here").closest("div")).toHaveAttribute("hidden");
  });

  it("switches, and remembers the choice", async () => {
    render(<CalendarView agenda={<p>agenda here</p>} month={<p>month here</p>} />);
    await userEvent.click(screen.getByRole("button", { name: "month" }));

    expect(screen.getByText("month here").closest("div")).not.toHaveAttribute("hidden");
    expect(window.localStorage.getItem("2m_calendar_view")).toBe("month");
  });

  it("comes back on the remembered view", async () => {
    window.localStorage.setItem("2m_calendar_view", "month");
    render(<CalendarView agenda={<p>agenda here</p>} month={<p>month here</p>} />);

    // Read in an effect, so it arrives a frame after hydration rather than as a mismatch.
    const shown = await screen.findByText("month here");
    expect(shown.closest("div")).not.toHaveAttribute("hidden");
  });
});
