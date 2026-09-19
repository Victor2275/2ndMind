// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The private app's rail (V4 §4.1, Q359–Q363).
 *
 * Three properties are worth a test and the rest is a stylesheet:
 *
 * 1. **Every route is still one tap away.** The grouping answers Q258's "too much going on"
 *    with structure and merges nothing — C11 is still open, and a refactor that quietly
 *    dropped a route would look like an answer to it.
 * 2. **The collapse persists** (Q362), and writes the attribute the CSS reads as well as the
 *    storage the next load reads. Either one alone is a sidebar that forgets, or one that
 *    remembers and does not apply it.
 * 3. **The active entry is marked by path**, including the case Training exists for: an entry
 *    that points at one page and stands for a whole area.
 */

let pathname = "/private";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));
vi.mock("next/link", () => ({
  default: ({ children, ...props }: { children?: unknown; [k: string]: unknown }) => (
    <a {...(props as Record<string, string>)}>{children as never}</a>
  ),
}));

const { PrivateSidebar } = await import("../private-sidebar");
const { NAV_ATTRIBUTE, NAV_STORAGE_KEY, resetSidebarStore } = await import("@/lib/nav/sidebar");
const { publishOutbox, resetOutboxStatus } = await import("@/lib/sync/status");

beforeEach(() => {
  pathname = "/private";
  localStorage.clear();
  document.documentElement.removeAttribute(NAV_ATTRIBUTE);
  resetOutboxStatus();
});

afterEach(() => {
  resetSidebarStore();
  document.documentElement.removeAttribute(NAV_ATTRIBUTE);
});

function hrefs() {
  return screen
    .getAllByRole("link")
    .map((a) => a.getAttribute("href"))
    .filter((href): href is string => href !== null);
}

describe("what it reaches", () => {
  it("still reaches every route the scrolling row did, plus settings and sync", () => {
    render(<PrivateSidebar />);

    // The eight sections, spelled out rather than counted: a count passes while a route is
    // swapped for another, which is exactly the change C11 is reserved for.
    for (const href of [
      "/private",
      "/private/now",
      "/private/log",
      "/private/athletics/log",
      "/private/academics",
      "/private/work",
      "/private/calendar",
      "/private/hobbies",
      "/private/sync",
      "/private/settings",
    ]) {
      expect(hrefs()).toContain(href);
    }
  });

  it("groups without nesting anything out of reach", () => {
    render(<PrivateSidebar />);
    expect(screen.getByText("Daily")).toBeTruthy();
    expect(screen.getByText("Areas")).toBeTruthy();
  });
});

describe("marking where you are", () => {
  it("matches the index exactly, so it does not light up everywhere", () => {
    pathname = "/private/work";
    render(<PrivateSidebar />);

    const today = screen.getAllByRole("link").find((a) => a.getAttribute("href") === "/private");
    expect(today?.getAttribute("aria-current")).toBeNull();
  });

  it("keeps Training marked on the pages inside it", () => {
    // The entry points at the logger and stands for the whole area (D-225). Without that
    // split, standing on the record board lights nothing at all, which reads as being lost.
    pathname = "/private/athletics/history";
    render(<PrivateSidebar />);

    const training = screen
      .getAllByRole("link")
      .find((a) => a.getAttribute("href") === "/private/athletics/log");
    expect(training?.getAttribute("aria-current")).toBe("page");
  });
});

describe("collapsing", () => {
  it("writes both the attribute the CSS reads and the storage the next load reads", () => {
    render(<PrivateSidebar />);

    fireEvent.click(screen.getByRole("button", { name: "Collapse navigation" }));

    expect(document.documentElement.getAttribute(NAV_ATTRIBUTE)).toBe("collapsed");
    expect(localStorage.getItem(NAV_STORAGE_KEY)).toBe("1");
  });

  it("expands again, and says so to a screen reader", () => {
    render(<PrivateSidebar />);
    const toggle = screen.getByRole("button", { name: "Collapse navigation" });
    expect(toggle.getAttribute("aria-expanded")).toBe("true");

    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(screen.getByRole("button", { name: "Expand navigation" }));
    expect(document.documentElement.hasAttribute(NAV_ATTRIBUTE)).toBe(false);
    expect(localStorage.getItem(NAV_STORAGE_KEY)).toBe("0");
  });
});

describe("the outbox count", () => {
  it("shows nothing before anything has been read", () => {
    // `null` is "the runner has not looked yet", which is not the same as an empty outbox. A
    // zero painted on first render would be a claim the page cannot support.
    render(<PrivateSidebar />);
    expect(screen.queryByText("3")).toBeNull();
  });

  it("counts everything waiting, failed included", () => {
    publishOutbox({
      pending: 2,
      failed: 1,
      oldestMs: 1000,
      urgency: "failed",
      label: "1 not sent",
    });
    render(<PrivateSidebar />);

    expect(screen.getByText("3")).toBeTruthy();
  });
});
