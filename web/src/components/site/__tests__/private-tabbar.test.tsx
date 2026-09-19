// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The tab bar's prefetching (V4 Phase N6).
 *
 * Every link in this bar prefetches an RSC payload when it renders, so the bar alone puts eight
 * speculative requests on the wire. Over HTTP/2 they share one TCP connection with the request
 * the user is actually waiting for — so on a stalled connection they are not free background
 * work, they are competing with the navigation and winning nothing.
 *
 * The property is two-sided and both halves matter. Prefetching is what makes a tab tap instant
 * on a connection that works, so "off when degraded" is the feature and "off always" would be a
 * regression dressed up as a fix.
 */

// A <Link> and an <a> are indistinguishable in the DOM, and `prefetch` never reaches it — so
// the mock surfaces the prop as an attribute. Same reasoning as `cached-app.test.tsx`.
vi.mock("next/link", () => ({
  default: ({
    children,
    prefetch,
    ...props
  }: {
    children?: unknown;
    prefetch?: boolean;
    [k: string]: unknown;
  }) => (
    <a data-next-link="yes" data-prefetch={String(prefetch)} {...(props as Record<string, string>)}>
      {children as never}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({ usePathname: () => "/private" }));

const { PrivateTabBar } = await import("../private-tabbar");
const { record, resetReachability } = await import("@/lib/net/reachability");
const { publishOutbox, resetOutboxStatus } = await import("@/lib/sync/status");

beforeEach(() => {
  resetReachability();
  resetOutboxStatus();
});

afterEach(() => {
  resetReachability();
  resetOutboxStatus();
  vi.unstubAllGlobals();
});

/** Opens the More sheet and hands back its dialog. */
function openSheet() {
  fireEvent.click(screen.getByRole("button", { name: /More/ }));
  return screen.getByRole("dialog");
}

/** The grabber is the drag surface; the sheet is what it moves. */
function grabber() {
  return screen.getByRole("dialog").firstElementChild as HTMLElement;
}

function drag(from: number, to: number, ms = 300) {
  const handle = grabber();
  fireEvent.pointerDown(handle, { clientY: from, button: 0, pointerId: 1 });
  fireEvent.pointerMove(handle, { clientY: to, pointerId: 1 });
  fireEvent.pointerUp(handle, { clientY: to, pointerId: 1, timeStamp: ms });
}

/** Every link the bar rendered through `<Link>`, ignoring the plain anchors. */
function clientLinks() {
  return screen
    .getAllByRole("link")
    .filter((element) => element.getAttribute("data-next-link") === "yes");
}

describe("prefetching", () => {
  it("leaves Next's own policy alone on a healthy connection", () => {
    // `undefined`, not `true`: the default is Next's decision and this file has no reason to
    // make a second one.
    render(<PrivateTabBar />);

    const links = clientLinks();
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) expect(link.getAttribute("data-prefetch")).toBe("undefined");
  });

  it("stops prefetching once requests are stalling", () => {
    render(<PrivateTabBar />);

    act(() => record("stalled"));

    const links = clientLinks();
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) expect(link.getAttribute("data-prefetch")).toBe("false");
  });

  it("starts again as soon as something answers", () => {
    // The half that stops this being "turn prefetch off". A connection that recovers gets its
    // instant transitions back with no reload.
    render(<PrivateTabBar />);
    act(() => record("stalled"));
    expect(clientLinks()[0].getAttribute("data-prefetch")).toBe("false");

    act(() => record("ok"));

    expect(clientLinks()[0].getAttribute("data-prefetch")).toBe("undefined");
  });

  it("does not prefetch on the offline shell, where there is no server to ask", () => {
    // Not N6 — this is D-132's document-navigation rule, asserted here because the two are
    // easy to confuse and breaking it looks identical to breaking N6.
    render(<PrivateTabBar offline path="/private" />);

    expect(clientLinks()).toHaveLength(0);
    expect(screen.getAllByRole("link").length).toBeGreaterThan(0);
  });
});

describe("the outbox badge (§4.3, Q287)", () => {
  it("says nothing until the runner has actually looked", () => {
    // `null` is not zero. A badge painted on first render would be asserting something about a
    // device's queue that nothing has read yet.
    render(<PrivateTabBar />);
    expect(screen.queryByText(/not sent/)).toBeNull();
  });

  it("marks More, because More is where the sync screen lives", () => {
    publishOutbox({ pending: 2, failed: 0, oldestMs: 500, urgency: "quiet", label: "2 waiting" });
    render(<PrivateTabBar />);

    // The dot is `aria-hidden`; this is what a screen reader is given instead.
    expect(screen.getByText("2 entries not sent")).toBeTruthy();
  });

  it("puts the count on the row inside as well, so it names the screen to open", () => {
    publishOutbox({ pending: 3, failed: 0, oldestMs: 500, urgency: "quiet", label: "3 waiting" });
    render(<PrivateTabBar />);
    openSheet();

    const row = screen.getAllByRole("link").find((a) => a.getAttribute("href") === "/private/sync");
    expect(row?.textContent).toContain("3");
  });
});

describe("the sheet (§4.3, Q172/Q173)", () => {
  it("dismisses on a drag down that goes far enough", () => {
    render(<PrivateTabBar />);
    openSheet();

    // jsdom reports every element as 0px tall, so the component's `|| 1` fallback makes any
    // real distance "far". That is fine for this assertion — what is being checked is that the
    // gesture is wired to `settle` at all; the thresholds themselves are tested as arithmetic
    // in `lib/ui/__tests__/sheet-drag.test.ts`, where they are not at jsdom's mercy.
    drag(100, 400);

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("expands rather than closing when the drag goes up", () => {
    render(<PrivateTabBar />);
    openSheet();

    drag(400, 100);

    const sheet = screen.getByRole("dialog");
    expect(sheet.style.height).toBe("85dvh");
  });

  it("leaves a tap on the grabber alone", () => {
    render(<PrivateTabBar />);
    openSheet();

    drag(200, 202);

    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("ignores a secondary button, so a right-click cannot start a drag nothing ends", () => {
    render(<PrivateTabBar />);
    openSheet();

    const handle = grabber();
    fireEvent.pointerDown(handle, { clientY: 100, button: 2, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientY: 500, pointerId: 1 });
    fireEvent.pointerUp(handle, { clientY: 500, pointerId: 1 });

    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});
