// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BarChart, TrendChart } from "@/components/site/chart";
import { ChartTable } from "@/components/site/chart-table";

/**
 * The chart text alternative — V4 §7.4 (Q450, D-312).
 *
 * `role="img"` plus an `aria-label` names a chart; it does not convey one. These tests are
 * about the difference: that the data is actually reachable as text, in the chart's own units,
 * with the gaps still marked as gaps.
 */

const kg = (v: number) => `${v}kg`;

describe("ChartTable", () => {
  it("renders a row per point and a column per series", () => {
    render(
      <ChartTable
        labels={["Mar 1", "Mar 8"]}
        rowHeader="Session"
        columns={[
          { label: "Squat", cells: ["100kg", "105kg"] },
          { label: "Bench", cells: ["70kg", "72kg"] },
        ]}
      />,
    );

    expect(screen.getByRole("columnheader", { name: "Session" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Squat" })).toBeInTheDocument();
    expect(screen.getByRole("rowheader", { name: "Mar 8" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "105kg" })).toBeInTheDocument();
  });

  it("marks a gap as a gap rather than leaving a blank cell", () => {
    render(
      <ChartTable
        labels={["Mar 1", "Mar 8"]}
        columns={[{ label: "Squat", cells: ["100kg", null] }]}
      />,
    );

    // A missing point is a fact about the data. An empty cell reads as a rendering fault.
    expect(screen.getByRole("cell", { name: "—" })).toBeInTheDocument();
  });

  it("is closed by default, because it is the same data twice", () => {
    const { container } = render(
      <ChartTable labels={["Mar 1"]} columns={[{ label: "Squat", cells: ["100kg"] }]} />,
    );

    const details = container.querySelector("details");
    expect(details).not.toBeNull();
    expect(details).not.toHaveAttribute("open");
  });

  it("renders nothing when there is nothing to tabulate", () => {
    const { container } = render(<ChartTable labels={[]} columns={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("the charts carry it", () => {
  it("TrendChart tabulates its series in the chart's own format", () => {
    render(
      <TrendChart
        labels={["Mar 1", "Mar 8"]}
        series={[{ label: "Squat", color: "var(--chart-1)", values: [100, null] }]}
        format={kg}
      />,
    );

    const table = screen.getByRole("table");
    // Formatted through `format`, not printed raw — the table reads in the axis's units.
    expect(within(table).getByRole("cell", { name: "100kg" })).toBeInTheDocument();
    expect(within(table).getByRole("cell", { name: "—" })).toBeInTheDocument();
  });

  it("BarChart tabulates its bars", () => {
    render(
      <BarChart
        bars={[
          { label: "Week of Mar 1", value: 3 },
          { label: "Week of Mar 8", value: 5 },
        ]}
        format={(v) => `${v} sessions`}
      />,
    );

    const table = screen.getByRole("table");
    expect(within(table).getByRole("rowheader", { name: "Week of Mar 8" })).toBeInTheDocument();
    expect(within(table).getByRole("cell", { name: "5 sessions" })).toBeInTheDocument();
  });

  it("leaves the graphic labelled rather than hiding it behind the table", () => {
    render(
      <TrendChart
        labels={["Mar 1", "Mar 8"]}
        series={[{ label: "Squat", color: "var(--chart-1)", values: [100, 105] }]}
        format={kg}
        caption="Squat, estimated 1RM"
      />,
    );

    // Both routes stay open: the `role="img"` label says what the chart is where it sits, and
    // the disclosure holds what it contains. Hiding the SVG would make a closed `<details>`
    // the only way to the data.
    expect(screen.getByRole("img", { name: "Squat, estimated 1RM" })).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
  });
});
