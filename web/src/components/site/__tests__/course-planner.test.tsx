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

    expect(screen.getByText(/might count/i)).toBeInTheDocument();
    expect(screen.getByText(/not checked/i)).toBeInTheDocument();
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
