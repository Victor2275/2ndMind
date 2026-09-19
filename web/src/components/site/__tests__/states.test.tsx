import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AsOf, Empty, SaveState, Unavailable } from "@/components/site/states";
import { AGING_MS, STALE_MS } from "@/lib/ui/staleness";

/**
 * The shared states (V4 §5.1).
 *
 * What is worth testing here is not that a `<div>` renders — it is the four properties the
 * questions actually asked for, each of which is easy to break by accident later:
 *
 * - the "as of" badge grades, and says *stale* in words as well as in colour (Q286, §2 rule 1);
 * - `Empty` offers the action that fills it, and tells the two empties apart (Q275, Q277);
 * - `Unavailable` recognises "the database is behind this build" and is not red (Q292);
 * - queued and failed are distinguishable without colour (Q289).
 */

const NOW = Date.UTC(2026, 8, 19, 20, 0, 0);

describe("AsOf", () => {
  it("grades by age", () => {
    const { rerender } = render(<AsOf at={NOW - 60_000} now={NOW} />);
    expect(screen.getByText(/as of/).closest("[data-as-of]")).toHaveAttribute(
      "data-as-of",
      "fresh",
    );

    rerender(<AsOf at={NOW - AGING_MS} now={NOW} />);
    expect(screen.getByText(/as of/).closest("[data-as-of]")).toHaveAttribute(
      "data-as-of",
      "aging",
    );

    rerender(<AsOf at={NOW - STALE_MS} now={NOW} />);
    expect(screen.getByText(/as of/).closest("[data-as-of]")).toHaveAttribute(
      "data-as-of",
      "stale",
    );
  });

  it("says stale in a word, not only in a colour", () => {
    render(<AsOf at={NOW - STALE_MS} now={NOW} />);
    // DESIGN.md §2 rule 1. Without the word this badge is amber-or-not, which is nothing in
    // greyscale and nothing in sunlight.
    expect(screen.getByText(/stale/)).toBeInTheDocument();
  });

  it("does not say 'just now ago'", () => {
    render(<AsOf at={NOW - 5_000} now={NOW} />);
    expect(screen.getByText(/as of just now/)).toBeInTheDocument();
    expect(screen.queryByText(/just now ago/)).toBeNull();
  });

  it("takes per-subject thresholds, because stale differs per subject", () => {
    // Six hours is `aging` for the offline mirror (panels.ts) and `stale` for nothing by
    // default. The argument is what lets one badge serve both.
    render(<AsOf at={NOW - 6 * 60 * 60 * 1000} now={NOW} stale={6 * 60 * 60 * 1000} />);
    expect(screen.getByText(/as of/).closest("[data-as-of]")).toHaveAttribute(
      "data-as-of",
      "stale",
    );
  });

  it("carries a machine-readable timestamp beside the judgement", () => {
    render(<AsOf at={NOW} now={NOW} />);
    expect(screen.getByText(/Sep 19/)).toHaveAttribute("dateTime", new Date(NOW).toISOString());
  });
});

describe("Empty", () => {
  it("offers the action that fills it", () => {
    render(
      <Empty action={{ href: "/private/log", label: "Log something" }}>Nothing logged yet.</Empty>,
    );
    expect(screen.getByRole("link", { name: /log something/i })).toHaveAttribute(
      "href",
      "/private/log",
    );
  });

  it("still renders with nothing but a sentence, for the call sites that have not moved yet", () => {
    render(<Empty>Nothing logged yet.</Empty>);
    expect(screen.getByText("Nothing logged yet.")).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });
});

describe("Unavailable", () => {
  const BEHIND =
    "The database is behind this build — it is missing a column this code expects. " +
    "Run `npm run db:migrate`, then reload. (column x does not exist)";

  it("recognises the schema case and does not dress it as a crash", () => {
    render(<Unavailable subject="Tasks" detail={BEHIND} />);
    const panel = screen.getByRole("status");
    // Q292: a schema that is behind is a step not yet run. Colouring it the same as a crash is
    // how a crash stops being alarming.
    expect(panel).toHaveAttribute("data-unavailable", "schema");
    expect(panel.className).not.toMatch(/destructive/);
  });

  it("lifts the command out of the sentence so it can be copied", () => {
    render(<Unavailable subject="Tasks" detail={BEHIND} />);
    expect(screen.getByText("npm run db:migrate").tagName).toBe("CODE");
  });

  it("does not leave 'Run , then reload.' behind when it lifts the command out", () => {
    // Caught in `.shots/private-today-390.png`, not by reasoning — the first version removed
    // the backticked token and left the sentence around it, so the panel read "Run , then
    // reload." The instruction is a sentence, so removing it has to be a sentence-level
    // operation. This is the argument for the screenshot sweep in one assertion.
    render(<Unavailable subject="Tasks" detail={BEHIND} />);
    expect(screen.queryByText(/Run\s*,/)).toBeNull();
    expect(screen.queryByText(/then reload/)).toBeNull();
  });

  it("keeps the parenthetical that names the column", () => {
    // The only part of D-156's message a person cannot reconstruct from the heading.
    render(<Unavailable subject="Tasks" detail={BEHIND} />);
    expect(screen.getByText(/column x does not exist/)).toBeInTheDocument();
  });

  it("falls back to the plain failure for anything else", () => {
    render(<Unavailable subject="Tasks" detail="Connection terminated unexpectedly" />);
    const panel = screen.getByRole("status");
    expect(panel).toHaveAttribute("data-unavailable", "error");
    expect(screen.getByText("Tasks is unavailable.")).toBeInTheDocument();
  });
});

describe("SaveState", () => {
  it("tells queued and failed apart in words, not only in colour", () => {
    const { rerender } = render(<SaveState state="queued" message="on this phone" />);
    expect(screen.getByText("Waiting")).toBeInTheDocument();

    rerender(<SaveState state="failed" message="the server refused it" />);
    expect(screen.getByText("Not saved")).toBeInTheDocument();
  });

  it("interrupts for a failure and waits its turn for anything else", () => {
    // A queued save resolves itself and costs nothing to miss; a failed one never resolves and
    // costs an entry. The two are not symmetric, so neither is the announcement.
    const { rerender } = render(<SaveState state="failed" message="x" />);
    expect(screen.getByRole("alert")).toBeInTheDocument();

    rerender(<SaveState state="queued" message="x" />);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});
