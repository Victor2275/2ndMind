import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SessionHeatmap, WeekMuscles } from "@/components/site/week-panels";
import type { HeatDay, MuscleWeek } from "@/lib/athletics/trends";

/**
 * The week panels (V4 Phase 2++ Stage 7, Phase 5.6).
 *
 * jsdom cannot lay out, so what is checked here is what the panels *say* — which for both of
 * them is the point: colour never signals alone, so every band and every cell has to carry its
 * meaning in text a screen reader can reach.
 */

const week = (over: Partial<MuscleWeek> = {}): MuscleWeek => ({
  sets: new Map([
    ["chest", 12],
    ["triceps", 6],
    ["lats", 3.5],
  ]),
  hammered: ["chest"],
  trained: ["lats", "triceps"],
  ...over,
});

describe("WeekMuscles", () => {
  it("names every band, so colour is never the only channel", () => {
    render(<WeekMuscles week={week()} />);
    expect(screen.getByText(/Hammered/)).toBeInTheDocument();
    expect(screen.getByText(/Trained/)).toBeInTheDocument();
    expect(screen.getByText(/Untrained/)).toBeInTheDocument();
  });

  it("lists each muscle with the count that put it in its band", () => {
    render(<WeekMuscles week={week()} />);
    expect(screen.getByText(/chest 12/)).toBeInTheDocument();
    expect(screen.getByText(/triceps 6/)).toBeInTheDocument();
  });

  it("shows a half set as a half rather than rounding it away", () => {
    // Halves come from secondary muscles. Rounding would claim a number the log does not have.
    render(<WeekMuscles week={week()} />);
    expect(screen.getByText(/lats 3\.5/)).toBeInTheDocument();
  });

  it("draws the hammered muscles as primary and the trained ones as secondary", () => {
    const { container } = render(<WeekMuscles week={week()} />);
    expect(container.querySelectorAll("path.fill-primary").length).toBeGreaterThan(0);
    expect(container.querySelectorAll("path.fill-primary-300").length).toBeGreaterThan(0);
  });

  it("says so when nothing was logged, rather than drawing an empty figure", () => {
    render(<WeekMuscles week={week({ sets: new Map(), hammered: [], trained: [] })} />);
    expect(screen.getByText(/Nothing logged this week/)).toBeInTheDocument();
  });

  it("renders an empty band as a dash rather than an empty line", () => {
    render(<WeekMuscles week={week({ hammered: [] })} />);
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });
});

describe("SessionHeatmap", () => {
  const days: HeatDay[] = Array.from({ length: 14 }, (_, i) => ({
    day: `2026-09-${String(i + 1).padStart(2, "0")}`,
    sets: i === 3 ? 18 : i === 5 ? 4 : 0,
  }));

  it("gives every cell a date and a count a screen reader can read", () => {
    render(<SessionHeatmap days={days} />);
    expect(screen.getByLabelText("2026-09-04, 18 sets")).toBeInTheDocument();
    expect(screen.getByLabelText("2026-09-01, 0 sets")).toBeInTheDocument();
  });

  it("renders a cell for every day in the window, empty ones included", () => {
    const { container } = render(<SessionHeatmap days={days} />);
    expect(container.querySelectorAll("span[aria-label]").length).toBe(14);
  });

  it("shades a harder day differently from an easier one", () => {
    render(<SessionHeatmap days={days} />);
    const hard = screen.getByLabelText("2026-09-04, 18 sets").className;
    const easy = screen.getByLabelText("2026-09-06, 4 sets").className;
    const rest = screen.getByLabelText("2026-09-01, 0 sets").className;
    expect(hard).not.toBe(easy);
    expect(easy).not.toBe(rest);
  });

  it("counts the days trained and the sets in them", () => {
    render(<SessionHeatmap days={days} />);
    expect(screen.getByText(/days trained of 14/)).toBeInTheDocument();
    expect(screen.getByText("22")).toBeInTheDocument();
  });

  it("says so when there is nothing at all", () => {
    render(<SessionHeatmap days={[]} />);
    expect(screen.getByText(/No sessions logged yet/)).toBeInTheDocument();
  });
});
