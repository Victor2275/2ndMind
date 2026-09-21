// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it } from "vitest";

import { Announcer, announce, resetAnnouncer, useAnnounce } from "@/components/site/announcer";

/**
 * The one live region — V4 §7.4 (Q449, D-313).
 *
 * The property worth testing is not "it renders text". It is the three reasons this replaced
 * twenty per-form regions, and each one is a test below:
 *
 *   - the region exists **before** anything is announced, because a live region created by its
 *     own message is one several screen readers never announce;
 *   - the same message twice is two announcements, because saving the same thing twice is two
 *     saves and a region set to the string it already holds mutates nothing;
 *   - a queued save says so, because `ok: true, queued: true` is a different outcome from
 *     `ok: true` and the outbox pill that distinguishes them cannot be glanced at.
 */

beforeEach(() => {
  // The store is module-level on purpose — `announce()` has to be callable from outside
  // React — so it survives between tests unless it is cleared. Same seam as
  // `resetOutboxStatus`.
  resetAnnouncer();
});

function Harness({ initial = null }: { initial?: { ok: boolean; message: string } | null }) {
  const [state, setState] = useState(initial);
  useAnnounce(state);
  return (
    <>
      <Announcer />
      <button onClick={() => setState({ ok: true, message: "Saved" })}>save</button>
      <button onClick={() => setState({ ok: true, message: "Saved" })}>save again</button>
    </>
  );
}

describe("the live region", () => {
  it("is in the DOM before anything is announced", () => {
    render(<Announcer />);

    // Present, and empty. This is the whole reason it is mounted by the layout rather than by
    // the form: a region has to exist and then change for the change to be announced.
    const region = screen.getByRole("status");
    expect(region).toBeInTheDocument();
    expect(region).toBeEmptyDOMElement();
  });

  it("is polite and atomic, so a save never interrupts and is read whole", () => {
    render(<Announcer />);

    const region = screen.getByRole("status");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toHaveAttribute("aria-atomic", "true");
  });

  it("is visually hidden — it is for screen readers, not a second copy of the message", () => {
    render(<Announcer />);
    expect(screen.getByRole("status")).toHaveClass("sr-only");
  });
});

describe("announce()", () => {
  it("carries the message into the region", () => {
    render(<Announcer />);

    // `act` because `announce` publishes through a module store rather than through React:
    // the whole point of the store is that it can be called from outside a component, and
    // outside a component is also outside React's update batching.

    act(() => announce("Logged"));
    expect(screen.getByRole("status")).toHaveTextContent("Logged");
  });

  it("makes a repeat of the same message a fresh mutation", () => {
    render(<Announcer />);
    const region = screen.getByRole("status");

    act(() => announce("Saved"));
    const first = region.textContent;
    act(() => announce("Saved"));
    const second = region.textContent;

    // Same sentence to a reader, different string to the DOM — which is what makes the second
    // save announce at all. The zero-width space is the only difference.
    expect(second).not.toBe(first);
    expect(second?.replace(/​/g, "")).toBe("Saved");
  });

  it("ignores an empty message rather than announcing silence", () => {
    render(<Announcer />);

    act(() => announce("Logged"));
    act(() => announce(""));
    expect(screen.getByRole("status")).toHaveTextContent("Logged");
  });
});

describe("useAnnounce", () => {
  it("says nothing until a result arrives", () => {
    render(<Harness />);
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("announces a result when it arrives", async () => {
    const { rerender } = render(<Harness initial={{ ok: true, message: "Task added" }} />);
    rerender(<Harness initial={{ ok: true, message: "Task added" }} />);

    expect(await screen.findByText("Task added")).toBeInTheDocument();
  });

  it("spells out a queued save, which is not the same outcome as a saved one", () => {
    function Queued() {
      useAnnounce({ ok: true, message: "Saved.", queued: true });
      return <Announcer />;
    }
    render(<Queued />);

    // §5.2 made `queued` a field precisely so this distinction is not a regex over a sentence.
    expect(screen.getByRole("status")).toHaveTextContent("Saved. Queued on this device.");
  });

  it("skips a result that has no message, such as a TailorState carrying only advice", () => {
    function NoMessage() {
      useAnnounce({ ok: true });
      return <Announcer />;
    }
    render(<NoMessage />);

    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });
});
