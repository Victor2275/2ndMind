// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { ChartPin } from "@/components/site/chart-pin";
import { TrendChart, leadFromSeries, type ChartSeries } from "@/components/site/chart";

/**
 * The chart, after V4 §5.9 (Q230, Q231, Q232, Q235, Q240).
 *
 * The drawing itself is geometry and is not worth asserting pixel by pixel. What is worth
 * pinning is the part that makes a claim: the number a chart leads with, and whether a change
 * is reported as good. `leadFromSeries` gets those wrong in a way nobody would notice — a
 * falling split rendered as a loss looks like a normal chart, and it is the opposite of what
 * happened.
 */

const series = (values: (number | null)[]): ChartSeries => ({
  label: "Split",
  color: "var(--primary)",
  values,
});

const seconds = (value: number) => `${value.toFixed(1)}s`;

describe("the number a chart leads with (Q230, Q240)", () => {
  it("is the last value, with the change from the first", () => {
    const lead = leadFromSeries(series([130, 126, 122]), seconds, { label: "best" });
    expect(lead?.value).toBe("122.0s");
    expect(lead?.delta?.text).toBe("8.0s");
    expect(lead?.delta?.direction).toBe("down");
  });

  it("calls a falling split good, and a falling lift bad", () => {
    // The whole reason `lowerIsBetter` exists. Direction and verdict are different questions,
    // and a split that improves goes *down*.
    const split = leadFromSeries(series([130, 122]), seconds, {
      label: "best",
      lowerIsBetter: true,
    });
    const lift = leadFromSeries(series([225, 205]), seconds, {
      label: "est. 1RM",
      lowerIsBetter: false,
    });

    expect(split?.delta?.good).toBe(true);
    expect(lift?.delta?.good).toBe(false);
  });

  it("passes no verdict where none was asked for", () => {
    // Bodyweight. Neither direction is better, and a chart is not entitled to imply one.
    const lead = leadFromSeries(series([180, 176]), seconds, { label: "latest" });
    expect(lead?.delta?.good).toBeUndefined();
  });

  it("says nothing about a single reading", () => {
    const lead = leadFromSeries(series([180]), seconds, { label: "latest" });
    expect(lead?.value).toBe("180.0s");
    expect(lead?.delta).toBeUndefined();
  });

  it("reports an unchanged series as flat rather than as zero", () => {
    const lead = leadFromSeries(series([180, 180]), seconds, { label: "latest" });
    expect(lead?.delta?.direction).toBe("flat");
    expect(lead?.delta?.text).toBe("no change");
    expect(lead?.delta?.good).toBeUndefined();
  });

  it("is undefined when there is nothing to lead with", () => {
    expect(leadFromSeries(series([null, null]), seconds, { label: "x" })).toBeUndefined();
  });

  it("renders above the chart, with the arrow beside the figure", () => {
    render(
      <TrendChart
        labels={["2026-09-01", "2026-09-08"]}
        series={[series([130, 122])]}
        format={seconds}
        lead={leadFromSeries(series([130, 122]), seconds, {
          label: "best",
          lowerIsBetter: true,
        })}
      />,
    );

    // Twice: the headline and the caption's endpoint callout, which is what carries the
    // number on a phone where the axis labels are gone (Q231).
    expect(screen.getAllByText("122.0s").length).toBeGreaterThan(0);
    expect(screen.getByText("best")).toBeInTheDocument();
    expect(screen.getByText("↓")).toBeInTheDocument();
  });
});

describe("the axis and the empty state", () => {
  it("hides the axis labels on a phone and keeps them on a desktop", () => {
    const { container } = render(
      <TrendChart labels={["a", "b"]} series={[series([1, 2])]} format={seconds} />,
    );

    // One server-rendered SVG is both charts (Q231): the labels carry the app's own display
    // switch rather than the page rendering two of everything.
    const labels = container.querySelectorAll("text.phone-hidden");
    expect(labels.length).toBeGreaterThan(0);
  });

  it("says what is missing rather than drawing an empty box", () => {
    render(<TrendChart labels={[]} series={[]} format={seconds} />);
    expect(screen.getByText(/not enough data/i)).toBeInTheDocument();
  });
});

describe("tap to pin (Q235)", () => {
  const points = [
    { label: "2026-09-01", entries: [{ label: "Split", color: "var(--primary)", text: "2:10" }] },
    { label: "2026-09-08", entries: [{ label: "Split", color: "var(--primary)", text: "2:02" }] },
  ];

  it("shows nothing until something is tapped", () => {
    render(<ChartPin points={points} />);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("pins the point under the tap", async () => {
    const { container } = render(<ChartPin points={points} />);
    const overlay = container.querySelector('[role="presentation"]') as HTMLElement;

    // jsdom gives every element a zero-width box, so the fraction is 0 and the first point is
    // the one picked. That is enough to prove the wiring; which point a real tap lands on is
    // arithmetic, tested by the reader's finger.
    overlay.getBoundingClientRect = () => ({ left: 0, width: 100, top: 0, height: 50 }) as DOMRect;

    await userEvent.pointer({
      target: overlay,
      coords: { clientX: 0, clientY: 10 },
      keys: "[MouseLeft]",
    });

    expect(await screen.findByRole("status")).toHaveTextContent("2:10");
  });

  it("unpins when the same point is tapped again", async () => {
    const { container } = render(<ChartPin points={points} />);
    const overlay = container.querySelector('[role="presentation"]') as HTMLElement;
    overlay.getBoundingClientRect = () => ({ left: 0, width: 100, top: 0, height: 50 }) as DOMRect;

    const tap = () =>
      userEvent.pointer({
        target: overlay,
        coords: { clientX: 0, clientY: 10 },
        keys: "[MouseLeft]",
      });

    await tap();
    await screen.findByRole("status");
    await tap();

    // The same gesture puts it up and takes it down — there is no hover and no Escape key on
    // the device this is for.
    expect(screen.queryByRole("status")).toBeNull();
  });
});
