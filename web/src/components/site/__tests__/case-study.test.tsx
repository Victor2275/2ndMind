import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CaseStudy } from "../case-study";
import { Prose } from "../prose";

/**
 * What these pin down, in order of how badly each would fail in public:
 *
 * 1. `Prose` renders identically for everything that is not a case-study results section.
 *    It also renders experience entries, lab write-ups, the private calendar's rules and
 *    every vault document; a treatment leaking into those is a regression on four surfaces.
 * 2. Number emphasis wraps and never rewrites. Altering a measured figure on a portfolio
 *    page is the D-069 failure mode with extra steps.
 * 3. Partially-filled projects look deliberate — no skipped indices advertising a gap.
 */

const FULL = [
  "## The problem",
  "",
  "A constraint.",
  "",
  "## Architecture",
  "",
  "A coil.",
  "",
  "## What did not work",
  "",
  "Polarity encoding.",
  "",
  "## Measured results",
  "",
  "Decoded at 100% accuracy with a 40 mm limit.",
].join("\n");

describe("Prose is unaffected outside a results section", () => {
  it("renders numbers as plain text by default", () => {
    const { container } = render(<Prose>{"Measured 100% at 40 mm."}</Prose>);
    expect(container.querySelector("span")).toBeNull();
    expect(container.textContent).toBe("Measured 100% at 40 mm.");
  });

  it("wraps numbers only when asked", () => {
    const { container } = render(<Prose numbers>{"Measured 100% at 40 mm."}</Prose>);
    const spans = [...container.querySelectorAll("span")].map((s) => s.textContent);
    expect(spans).toEqual(["100%", "40 mm"]);
  });

  it("never changes the text it wraps", () => {
    // The whole point: presentation only. If this ever fails, a number on a public page is
    // not the number Victor measured.
    const source = "Four sequences at 100% accuracy, 40 mm resolution, 2.5 ms per bit.";
    const plain = render(<Prose>{source}</Prose>).container.textContent;
    const marked = render(<Prose numbers>{source}</Prose>).container.textContent;
    expect(marked).toBe(plain);
    expect(marked).toContain("2.5 ms");
  });

  it("reaches numbers inside list items and bold runs", () => {
    const { container } = render(<Prose numbers>{"- **99.9%** uptime"}</Prose>);
    expect(container.querySelector("li span")?.textContent).toBe("99.9%");
  });
});

describe("CaseStudy", () => {
  it("numbers the four sections in order", () => {
    render(<CaseStudy>{FULL}</CaseStudy>);
    expect(screen.getByText("01")).toBeInTheDocument();
    expect(screen.getByText("04")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Measured results" })).toBeInTheDocument();
  });

  it("numbers what is present, never what is missing", () => {
    // A project with the problem and the results written must read 01, 02 — not 01, 04.
    // Skipped indices advertise the gap that dropUnwritten (D-073) exists to hide.
    render(<CaseStudy>{"## The problem\n\nA.\n\n## Measured results\n\n40 mm."}</CaseStudy>);
    expect(screen.getByText("01")).toBeInTheDocument();
    expect(screen.getByText("02")).toBeInTheDocument();
    expect(screen.queryByText("04")).toBeNull();
  });

  it("does not index a lone section", () => {
    render(<CaseStudy>{"## The problem\n\nA constraint."}</CaseStudy>);
    expect(screen.queryByText("01")).toBeNull();
    expect(screen.getByRole("heading", { name: "The problem" })).toBeInTheDocument();
  });

  it("keeps a section's own heading rather than retitling it", () => {
    render(
      <CaseStudy>{"## Design decisions\n\nPresence-based.\n\n## Results\n\n100%."}</CaseStudy>,
    );
    expect(screen.getByRole("heading", { name: "Design decisions" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Results" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Architecture" })).toBeNull();
  });

  it("emphasises numbers in results but not in the other sections", () => {
    const { container } = render(<CaseStudy>{FULL}</CaseStudy>);
    const marked = [...container.querySelectorAll("span.text-primary")].map((s) => s.textContent);
    expect(marked).toEqual(["100%", "40 mm"]);
  });

  it("renders an unrecognised heading as plain prose, in place", () => {
    const body = "## The problem\n\nA.\n\n## Post-mortem\n\nLearned big O.";
    render(<CaseStudy>{body}</CaseStudy>);
    expect(screen.getByRole("heading", { name: "Post-mortem" })).toBeInTheDocument();
    expect(screen.getByText("Learned big O.")).toBeInTheDocument();
    // Only the recognised section counts toward the index, and one section is not numbered.
    expect(screen.queryByText("01")).toBeNull();
  });

  it("falls back to plain prose when no section is recognised", () => {
    const { container } = render(<CaseStudy>{"Just a paragraph about the build."}</CaseStudy>);
    expect(container.querySelector("section")).toBeNull();
    expect(screen.getByText("Just a paragraph about the build.")).toBeInTheDocument();
  });
});
