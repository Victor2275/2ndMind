// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { emptyPlan } from "@/lib/academics/plan";
import type { Requirement } from "@/lib/academics/requirements";

vi.mock("@/app/private/academics/plan/actions", () => ({ savePlan: vi.fn() }));

const { CoursePlanner } = await import("../course-planner");

/**
 * §5.2. The screen's job is to answer one question while you are still deciding, so the
 * assertions are about the answer moving as the text changes — not about layout.
 */

const requirement = (over: Partial<Requirement>): Requirement => ({
  id: "r",
  group: "CS REQUIRED",
  name: "TWO UPPER DIVISION COURSES",
  needsCourses: 2,
  needsUnits: null,
  selectFrom: ["COM SCI 111", "COM SCI 118"],
  truncated: false,
  applied: [],
  ...over,
});

describe("it answers while you type", () => {
  it("counts a course down as soon as it is entered", () => {
    render(<CoursePlanner requirements={[requirement({})]} initial={emptyPlan()} />);

    expect(screen.getByText(/2 course/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/courses planned for winter 2027/i), {
      target: { value: "COM SCI 111 (4)" },
    });
    expect(screen.getByText(/1 course/)).toBeInTheDocument();
  });

  it("says so plainly when the plan covers everything", () => {
    render(
      <CoursePlanner requirements={[requirement({ needsCourses: 1 })]} initial={emptyPlan()} />,
    );
    fireEvent.change(screen.getByLabelText(/courses planned for winter 2027/i), {
      target: { value: "COM SCI 111 (4)" },
    });
    expect(screen.getByText(/everything is covered/i)).toBeInTheDocument();
  });
});

describe("it distinguishes what it knows from what it guesses", () => {
  it("marks an unverifiable course as might count, not as counted", () => {
    // The GE lists are truncated in the generated audit. Rendering a guess as a fact would be
    // the planner asserting something the audit never said.
    render(
      <CoursePlanner
        requirements={[
          requirement({
            needsUnits: 8,
            needsCourses: 2,
            truncated: true,
            selectFrom: ["ART HIS 20"],
          }),
        ]}
        initial={emptyPlan()}
      />,
    );
    fireEvent.change(screen.getByLabelText(/courses planned for winter 2027/i), {
      target: { value: "ART HIS 55 (5)" },
    });

    // V4 §5.7 (Q417) turned this from one grey sentence into two kinds of token. The claim
    // under test is unchanged: an unverifiable course must not read as a counted one.
    // The code appears twice — once as a chip in the phone table, once as a token in the
    // outstanding list — so this asks whether *a* rendering of it is the hedged one.
    const classes = screen
      .getAllByText("ART HIS 55")
      .map((element) => element.closest("span")?.className ?? "");
    expect(classes.some((name) => name.includes("border-dashed"))).toBe(true);
    expect(screen.getAllByText("unchecked").length).toBeGreaterThan(0);
    expect(screen.getByText(/cut short/i)).toBeInTheDocument();
  });

  it("marks a course the audit does name as counted, with no hedge", () => {
    render(
      <CoursePlanner
        requirements={[requirement({ needsUnits: 8, needsCourses: 2, selectFrom: ["ART HIS 20"] })]}
        initial={emptyPlan()}
      />,
    );
    fireEvent.change(screen.getByLabelText(/courses planned for winter 2027/i), {
      target: { value: "ART HIS 20 (5)" },
    });

    const classes = screen
      .getAllByText("ART HIS 20")
      .map((element) => element.closest("span")?.className ?? "");
    expect(classes.some((name) => name.includes("border-primary/40"))).toBe(true);
    expect(classes.some((name) => name.includes("border-dashed"))).toBe(false);
    expect(screen.queryAllByText("unchecked")).toHaveLength(0);
  });
});

describe("the plan reads as a table before it reads as a form (Q416)", () => {
  it("renders every term as a row, with its units", () => {
    render(
      <CoursePlanner
        requirements={[requirement({})]}
        initial={{ "Winter 2027": [{ course: "COM SCI 111", units: 4 }] }}
      />,
    );

    // The table is the phone's default view. It is in the DOM at every width — `lg:hidden` is
    // a media rule — so this asserts structure, not paint.
    const row = screen.getByRole("row", { name: /winter 2027/i });
    expect(row).toBeInTheDocument();
    expect(row.textContent).toContain("COM SCI 111");
  });

  it("offers a way into editing on a phone", () => {
    render(<CoursePlanner requirements={[requirement({})]} initial={emptyPlan()} />);

    // D-187 keeps planning a laptop activity; taking editing away from the phone entirely
    // would be a regression dressed up as a decision.
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
  });
});

describe("it warns about a term, not about an empty one", () => {
  it("flags a term over the cap", () => {
    render(<CoursePlanner requirements={[requirement({})]} initial={emptyPlan()} />);
    fireEvent.change(screen.getByLabelText(/courses planned for spring 2027/i), {
      target: { value: "A 1 (8)\nB 2 (8)\nC 3 (8)" },
    });
    expect(screen.getByText(/over 19 units/i)).toBeInTheDocument();
  });

  it("says nothing about a term nobody has filled in yet", () => {
    // A warning on all five terms of an empty plan is a warning that gets ignored.
    render(<CoursePlanner requirements={[requirement({})]} initial={emptyPlan()} />);
    expect(screen.queryByText(/under 12 units/i)).toBeNull();
    expect(screen.queryByText(/over 19 units/i)).toBeNull();
  });
});
