// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The persistent connection glyph (V4 §4.5, Q375).
 *
 * What it says is `describe`, and that is where the thinking is: the ordering is not the
 * ordering of severity, and getting it wrong sends someone looking for a fault that is a
 * tunnel. The component around it is a dot and a link.
 */

vi.mock("next/link", () => ({
  default: ({ children, ...props }: { children?: unknown; [k: string]: unknown }) => (
    <a {...(props as Record<string, string>)}>{children as never}</a>
  ),
}));

const { ConnectionGlyph, describe: say } = await import("../connection-glyph");
const { publishOutbox, resetOutboxStatus } = await import("@/lib/sync/status");
const { resetReachability } = await import("@/lib/net/reachability");

type Summary = NonNullable<Parameters<typeof publishOutbox>[0]>;

const summary = (over: Partial<Summary> = {}): Summary => ({
  pending: 0,
  failed: 0,
  oldestMs: null,
  urgency: "none",
  label: "",
  ...over,
});

beforeEach(() => {
  resetOutboxStatus();
  resetReachability();
});

describe("what it says", () => {
  it("puts a rejected op above everything, including being offline", () => {
    // The only state that will still be here tomorrow without a person. Phase N7 made this
    // argument for the pill; it is the same argument.
    expect(say("unreachable", { urgency: "failed", pending: 0, label: "1 not sent" })).toEqual({
      tone: "fault",
      label: "1 not sent",
    });
  });

  it("leads with the connection when there is nothing rejected", () => {
    // A queue on a phone with no signal is not a problem, and "3 waiting" without "offline"
    // invites someone to go looking for a fault that is a tunnel.
    expect(say("unreachable", { urgency: "quiet", pending: 3, label: "3 waiting" })).toEqual({
      tone: "attention",
      label: "Offline",
    });
    expect(say("degraded", { urgency: "quiet", pending: 3, label: "3 waiting" })).toEqual({
      tone: "attention",
      label: "Poor connection",
    });
  });

  it("carries the quiet count that the pill stopped showing", () => {
    expect(say("healthy", { urgency: "quiet", pending: 3, label: "3 waiting" })).toEqual({
      tone: "working",
      label: "3 waiting",
    });
  });

  it("raises its voice for a queue that has been waiting a day", () => {
    expect(say("healthy", { urgency: "stale", pending: 1, label: "1 waiting · 30h" }).tone).toBe(
      "attention",
    );
  });

  it("refuses to claim it is up to date before anything has been read", () => {
    // `null` is "the runner has not reported yet". Dressing that up as an empty outbox is
    // exactly the failure a persistent indicator exists to make impossible.
    expect(say("healthy", null)).toEqual({ tone: "idle", label: "Checking sync" });
  });

  it("says so plainly when there is genuinely nothing to send", () => {
    expect(say("healthy", { urgency: "none", pending: 0, label: "" })).toEqual({
      tone: "idle",
      label: "Up to date",
    });
  });
});

describe("the element", () => {
  it("is a link to the screen that explains it, and never prefetches it", () => {
    // The state that makes anyone look at this is the state where a speculative request is
    // competing with the navigation they are waiting for — Phase N6's argument.
    render(<ConnectionGlyph />);
    const link = screen.getByRole("link");

    expect(link.getAttribute("href")).toBe("/private/sync");
    expect(link.getAttribute("prefetch")).not.toBe("true");
  });

  it("names itself for a screen reader, because a dot is not a label", () => {
    publishOutbox(summary({ urgency: "quiet", pending: 2, label: "2 waiting" }));
    render(<ConnectionGlyph />);

    expect(screen.getByRole("link").getAttribute("aria-label")).toBe(
      "Connection and sync: 2 waiting",
    );
  });
});
