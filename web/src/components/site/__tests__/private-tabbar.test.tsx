// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
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

beforeEach(() => {
  resetReachability();
});

afterEach(() => {
  resetReachability();
  vi.unstubAllGlobals();
});

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
