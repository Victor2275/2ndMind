import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RequirementProgress } from "@/components/site/requirement-progress";
import { parseAudit, type Requirement } from "@/lib/academics/requirements";

/**
 * The degree audit as structure (V4 §5.7, Q415).
 *
 * The audit is generated markdown, and this panel is the first thing that renders it as
 * anything other than prose. Two claims matter: the meter is readable by something that is not
 * an eye, and a requirement the audit could not fully describe says so rather than looking
 * complete — the same honesty D-187 built into the planner's logic.
 *
 * The fixture is a slice of the real generated file, parsed by the real parser. A hand-built
 * `Requirement[]` would test the component against an idea of the format rather than the format.
 */

const AUDIT = `## Outstanding

### COMPUTER SCIENCE AND ENGINEERING REQUIRED COURSES

- **TWELVE COM SCI & ENGR'G UPPER DIVSN REQUIRED COURSES**
  - Needs: 8 COURSES
  - Select from: COM SCI 111 , 118 , M151B
  - Applied: COM SCI 131 (SP26, 4.00, B-)
  - Applied: EC ENGR 102 (FA26, 4.00, IP)

### FOUNDATIONS OF THE ARTS AND HUMANITIES

- **LITERARY & CULTURAL ANALYSIS**
  - Needs: 4.0 UNITS
  - Select from: AF AMER 1 , M25 , ART HIS 20, … and ~235 more (see the audit)
`;

const parsed: Requirement[] = parseAudit(AUDIT);

describe("the meter", () => {
  it("reports met against total, in text and in aria", () => {
    render(<RequirementProgress requirements={parsed} total={35} unfulfilled={14} />);

    const bar = screen.getByRole("progressbar", { name: /requirements met/i });
    expect(bar).toHaveAttribute("aria-valuenow", "21");
    expect(bar).toHaveAttribute("aria-valuemax", "35");
    // The same fact in words, because a bar is never the only signal (rule 10).
    expect(screen.getByText(/21/)).toBeInTheDocument();
    expect(screen.getByText(/of/)).toBeInTheDocument();
  });

  it("is absent when the audit's frontmatter does not carry the totals", () => {
    render(<RequirementProgress requirements={parsed} total={null} unfulfilled={null} />);
    expect(screen.queryByRole("progressbar")).toBeNull();
  });
});

describe("a requirement", () => {
  it("says what it still needs, as a figure rather than a sentence", () => {
    render(<RequirementProgress requirements={parsed} total={35} unfulfilled={14} />);
    expect(screen.getByText("8 courses")).toBeInTheDocument();
    expect(screen.getByText("4 units")).toBeInTheDocument();
  });

  it("shows what already counts, and marks in-progress differently from done", () => {
    render(<RequirementProgress requirements={parsed} total={35} unfulfilled={14} />);

    const done = screen.getByText("COM SCI 131").closest("li");
    const inProgress = screen.getByText("EC ENGR 102").closest("li");

    // `IP` is the audit's own word for a course being taken right now. A term in progress
    // counting as finished is the one way this panel could be actively wrong.
    expect(done?.className).not.toContain("border-dashed");
    expect(inProgress?.className).toContain("border-dashed");
    expect(inProgress?.textContent).toContain("IP");
  });

  it("admits when the audit's list of acceptable courses was cut short", () => {
    render(<RequirementProgress requirements={parsed} total={35} unfulfilled={14} />);
    expect(screen.getByText(/longer than this/i)).toBeInTheDocument();
  });

  it("does not hedge a requirement whose list is complete", () => {
    const complete = parsed.filter((requirement) => !requirement.truncated);
    render(<RequirementProgress requirements={complete} total={35} unfulfilled={14} />);
    expect(screen.queryByText(/longer than this/i)).toBeNull();
  });
});

describe("an empty audit", () => {
  it("says so rather than rendering an empty panel", () => {
    render(<RequirementProgress requirements={[]} total={null} unfulfilled={null} />);
    expect(screen.getByText(/nothing outstanding/i)).toBeInTheDocument();
  });
});
