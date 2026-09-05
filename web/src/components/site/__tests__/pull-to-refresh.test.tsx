// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PullToRefresh } from "@/components/site/pull-to-refresh";
import { SYNC_DONE_EVENT, SYNC_EVENT } from "@/components/site/sync-runner";

/**
 * §3.3. The gesture is worth little; not stealing the page's scroll is worth everything.
 *
 * A pull-to-refresh that arms halfway down a list makes every list in the app feel broken, and
 * it fails unreportably — the page just goes sticky and nobody can say when. So "only from the
 * top, only downward" is asserted rather than left to `overscroll-behavior`.
 */
let asked: number;
const count = () => asked;

beforeEach(() => {
  asked = 0;
  window.addEventListener(SYNC_EVENT, bump);
  scrollTo(0);
});
afterEach(() => {
  window.removeEventListener(SYNC_EVENT, bump);
});
function bump() {
  asked += 1;
}

function scrollTo(y: number) {
  Object.defineProperty(window, "scrollY", { value: y, configurable: true, writable: true });
}

const pull = (path: number[], { release = true }: { release?: boolean } = {}) => {
  fireEvent.pointerDown(window, { clientY: 0, isPrimary: true, pointerId: 1 });
  for (const y of path)
    fireEvent.pointerMove(window, { clientY: y, isPrimary: true, pointerId: 1 });
  if (release) fireEvent.pointerUp(window, { isPrimary: true, pointerId: 1 });
};

describe("it only arms at the top of the page", () => {
  it("asks for a sync on a full pull from the top", () => {
    render(<PullToRefresh />);
    pull([40, 120]);
    expect(count()).toBe(1);
  });

  it("does nothing when the page is already scrolled", () => {
    // Halfway down a list, a downward drag is a scroll and nothing else.
    render(<PullToRefresh />);
    scrollTo(400);
    pull([40, 120]);
    expect(count()).toBe(0);
  });

  it("does nothing on an upward drag", () => {
    render(<PullToRefresh />);
    pull([-40, -120]);
    expect(count()).toBe(0);
  });

  it("gives up for the rest of the gesture once the page scrolls under it", () => {
    render(<PullToRefresh />);
    fireEvent.pointerDown(window, { clientY: 0, isPrimary: true, pointerId: 1 });
    fireEvent.pointerMove(window, { clientY: 30, isPrimary: true, pointerId: 1 });
    scrollTo(200);
    fireEvent.pointerMove(window, { clientY: 200, isPrimary: true, pointerId: 1 });
    fireEvent.pointerUp(window, { isPrimary: true, pointerId: 1 });
    expect(count()).toBe(0);
  });

  it("does nothing when the pull stops short", () => {
    render(<PullToRefresh />);
    pull([10, 20]);
    expect(count()).toBe(0);
  });
});

describe("what it says while it is doing it", () => {
  it("shows nothing at rest, so it cannot cover the page", () => {
    render(<PullToRefresh />);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("changes its mind at the threshold, before you let go", () => {
    render(<PullToRefresh />);
    pull([20], { release: false });
    expect(screen.getByRole("status")).toHaveTextContent("Pull to send");
    fireEvent.pointerMove(window, { clientY: 160, isPrimary: true, pointerId: 1 });
    expect(screen.getByRole("status")).toHaveTextContent("Release to send");
  });

  it("stops when the sync stops, not on a timer", () => {
    // A spinner that hides itself after a fixed delay is an animation that lies about whether
    // anything happened.
    render(<PullToRefresh />);
    pull([40, 120]);
    expect(screen.getByRole("status")).toHaveTextContent("Sending…");

    fireEvent(window, new Event(SYNC_DONE_EVENT));
    expect(screen.queryByRole("status")).toBeNull();
  });
});
