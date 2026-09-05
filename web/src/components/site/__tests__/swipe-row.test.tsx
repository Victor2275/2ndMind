// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SwipeRow } from "@/components/site/swipe-row";

/**
 * §3.3. Three properties, and the first is the one that decides whether this is usable at all.
 *
 * A swipe row that steals vertical scroll makes the list it is in worse than before it existed,
 * and it fails in the least reportable way: the page just feels sticky. So the guard is asserted
 * directly rather than trusted to `touch-action`.
 */
const drag = (
  el: Element,
  path: { x: number; y: number }[],
  { release = true }: { release?: boolean } = {},
) => {
  fireEvent.pointerDown(el, { clientX: 0, clientY: 0, isPrimary: true, pointerId: 1, button: 0 });
  for (const point of path) {
    fireEvent.pointerMove(el, {
      clientX: point.x,
      clientY: point.y,
      isPrimary: true,
      pointerId: 1,
    });
  }
  if (release) fireEvent.pointerUp(el, { isPrimary: true, pointerId: 1 });
};

let right: ReturnType<typeof vi.fn<() => void>>;
let left: ReturnType<typeof vi.fn<() => void>>;

function renderRow(props: Partial<Parameters<typeof SwipeRow>[0]> = {}) {
  right = vi.fn<() => void>();
  left = vi.fn<() => void>();
  render(
    <SwipeRow
      onSwipeRight={right}
      onSwipeLeft={left}
      rightLabel="Complete"
      leftLabel="Remove"
      {...props}
    >
      <span>a task</span>
    </SwipeRow>,
  );
  return screen.getByText("a task").parentElement as HTMLElement;
}

beforeEach(() => {
  vi.stubGlobal("navigator", { vibrate: vi.fn() });
});

describe("it does not take the page's scroll", () => {
  it("ignores a drag that is mostly vertical", () => {
    const row = renderRow();
    drag(row, [
      { x: 4, y: 40 },
      { x: 120, y: 60 },
    ]);
    // The second move is far to the right, but the gesture was already conceded to the page.
    // Without that latch, a diagonal scroll snags every row it passes.
    expect(right).not.toHaveBeenCalled();
    expect(left).not.toHaveBeenCalled();
  });

  it("engages once the movement is clearly horizontal", () => {
    const row = renderRow();
    drag(row, [
      { x: 30, y: 4 },
      { x: 100, y: 6 },
    ]);
    expect(right).toHaveBeenCalledTimes(1);
  });
});

describe("committing, and not", () => {
  it("does nothing when the finger stops short", () => {
    const row = renderRow();
    drag(row, [
      { x: 30, y: 0 },
      { x: 60, y: 0 },
    ]);
    expect(right).not.toHaveBeenCalled();
    expect(left).not.toHaveBeenCalled();
  });

  it("completes on a full right swipe", () => {
    const row = renderRow();
    drag(row, [{ x: 100, y: 0 }]);
    expect(right).toHaveBeenCalledTimes(1);
    expect(left).not.toHaveBeenCalled();
  });

  it("removes on a full left swipe", () => {
    const row = renderRow();
    drag(row, [{ x: -100, y: 0 }]);
    expect(left).toHaveBeenCalledTimes(1);
    expect(right).not.toHaveBeenCalled();
  });

  it("resists, then springs back, when a direction has no handler", () => {
    // A log entry: left removes, right means nothing. It has to move — silence reads as a
    // broken gesture — but it must not move far enough to look like it is about to act, and it
    // must not act. Asserted mid-drag, because on release the row returns to zero either way
    // and an assertion after release passes whatever the row did on the way there.
    const removed = vi.fn();
    render(
      <SwipeRow onSwipeLeft={removed} leftLabel="Remove">
        <span>an entry</span>
      </SwipeRow>,
    );
    const row = screen.getByText("an entry").parentElement as HTMLElement;

    drag(row, [{ x: 140, y: 0 }], { release: false });
    const travelled = Number(row.style.transform.match(/-?\d+(\.\d+)?/)?.[0] ?? 0);
    expect(travelled).toBeGreaterThan(0);
    expect(travelled).toBeLessThan(140 / 2);

    fireEvent.pointerUp(row, { isPrimary: true, pointerId: 1 });
    expect(removed).not.toHaveBeenCalled();
    expect(row.style.transform).toBe("");
  });

  it("buzzes when it commits, because there is no button to press", () => {
    const vibrate = vi.fn();
    vi.stubGlobal("navigator", { vibrate });
    const row = renderRow();
    drag(row, [{ x: 100, y: 0 }]);
    expect(vibrate).toHaveBeenCalled();
  });
});

describe("what it leaves alone", () => {
  it("keeps the buttons inside it working", () => {
    // The gesture is a shortcut for a thumb, never the only way to do something. A tap must
    // still reach the control underneath.
    const clicked = vi.fn();
    render(
      <SwipeRow onSwipeLeft={vi.fn()} leftLabel="Remove">
        <button onClick={clicked}>Remove entry</button>
      </SwipeRow>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Remove entry" }));
    expect(clicked).toHaveBeenCalledTimes(1);
  });

  it("leaves vertical panning to the page", () => {
    const row = renderRow();
    expect(row.style.touchAction).toBe("pan-y");
  });
});
