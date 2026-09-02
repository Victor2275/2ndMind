// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OfflineRecovery } from "../offline-recovery";

/**
 * The offline page's recovery half (D-157).
 *
 * Every one of these is a property the page did not have when it was reported from the phone:
 * it claimed there was no signal without checking, it offered nothing to do, and it had no way
 * back to the app. A page shown *because* something failed is the worst place to leave someone
 * without an action.
 */

const replace = vi.fn();

function at(search: string, { online = true } = {}) {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { search, replace, href: `https://victorgusev.com/offline${search}` },
  });
  Object.defineProperty(navigator, "onLine", { configurable: true, value: online });
}

beforeEach(() => replace.mockClear());
afterEach(() => vi.restoreAllMocks());

describe("what it says", () => {
  it("does not claim there is no signal when the phone says there is", () => {
    // The reported wording bug. "This page needs a signal" on a phone with four bars sends you
    // looking for a network problem that is not there.
    at("?from=%2Fprivate%2Flog", { online: true });
    render(<OfflineRecovery />);

    expect(screen.getByText(/says it is online/i)).toBeInTheDocument();
    expect(screen.queryByText(/there is no network right now/i)).toBeNull();
  });

  it("says plainly that there is no network when there is not", () => {
    at("", { online: false });
    render(<OfflineRecovery />);

    expect(screen.getByText(/there is no network right now/i)).toBeInTheDocument();
  });

  it("promises nothing is lost either way, because that is the actual worry", () => {
    for (const online of [true, false]) {
      at("", { online });
      const { unmount } = render(<OfflineRecovery />);
      expect(screen.getByText(/already logged on this device is safe/i)).toBeInTheDocument();
      unmount();
    }
  });

  it("names the page that failed, so it is not a mystery", () => {
    at("?from=%2Fprivate%2Flog");
    render(<OfflineRecovery />);

    expect(screen.getByText(/could not load \/private\/log/i)).toBeInTheDocument();
  });
});

describe("getting out of it", () => {
  it("retries the page that failed, not whatever this page is", async () => {
    at("?from=%2Fprivate%2Flog");
    render(<OfflineRecovery />);

    await userEvent.click(screen.getByRole("button", { name: /try again/i }));

    expect(replace).toHaveBeenCalledWith("/private/log");
  });

  it("falls back to the dashboard when nothing said what failed", async () => {
    at("");
    render(<OfflineRecovery />);

    await userEvent.click(screen.getByRole("button", { name: /try again/i }));

    expect(replace).toHaveBeenCalledWith("/private");
  });

  it("offers a way back that is not a retry", async () => {
    at("?from=%2Fprivate%2Flog");
    render(<OfflineRecovery />);

    await userEvent.click(screen.getByRole("button", { name: /back to today/i }));

    expect(replace).toHaveBeenCalledWith("/private");
  });

  it("does not offer a second button that goes where the first one already goes", () => {
    at("?from=%2Fprivate");
    render(<OfflineRecovery />);

    expect(screen.queryByRole("button", { name: /back to today/i })).toBeNull();
  });
});

describe("the target is untrusted input", () => {
  it("refuses an absolute URL, which would make Retry an open redirect", async () => {
    // `?from=` arrives in a URL on a page anyone can reach. Sending Retry to another origin
    // would be a redirect this app hands out to whoever crafts the link.
    at("?from=https%3A%2F%2Fevil.example%2Fsteal");
    render(<OfflineRecovery />);

    await userEvent.click(screen.getByRole("button", { name: /try again/i }));

    expect(replace).toHaveBeenCalledWith("/private");
  });

  it("refuses a protocol-relative URL, which is the same trick one slash shorter", async () => {
    at("?from=%2F%2Fevil.example%2Fsteal");
    render(<OfflineRecovery />);

    await userEvent.click(screen.getByRole("button", { name: /try again/i }));

    expect(replace).toHaveBeenCalledWith("/private");
    expect(screen.queryByText(/could not load/i)).toBeNull();
  });
});
