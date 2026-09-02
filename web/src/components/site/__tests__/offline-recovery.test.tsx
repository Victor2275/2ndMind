// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import OfflinePage from "@/app/offline/page";

import { OfflineRecovery } from "../offline-recovery";

/**
 * The offline page (D-157, D-158).
 *
 * Two properties, and the second is the one that was got wrong. It must not claim there is no
 * signal without checking — that was the reported bug. And **the way out must not depend on
 * JavaScript**, because this is the page shown when something failed to load; putting the only
 * escape inside a client component made the fix for the first bug into a worse second one.
 * `<noscript>` would not have covered it either: a chunk that fails to *fetch* is not a browser
 * with scripting turned off.
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

describe("the way out", () => {
  it("is in the server output, so it survives the JavaScript not loading", () => {
    // Rendered without the client component doing anything — which is the state a phone is in
    // when the chunk this page needs is the thing that failed to arrive.
    render(OfflinePage());

    const escapes = screen.getAllByRole("link");
    expect(escapes.map((a) => a.getAttribute("href"))).toEqual(
      expect.arrayContaining(["/private", "/"]),
    );
  });

  it("says plainly that offline reading is not built yet", () => {
    // The honest edge of Phase 1. A page that implies this is a fault sends him looking for a
    // bug; saying it is unbuilt is both true and actionable.
    render(OfflinePage());
    expect(screen.getByText(/Phase 2/)).toBeInTheDocument();
  });

  it("does not claim there is no signal in its heading", () => {
    render(OfflinePage());
    expect(screen.queryByText(/needs a signal/i)).toBeNull();
  });
});

describe("what the client half adds", () => {
  it("does not claim there is no signal when the phone says there is", () => {
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

  it("offers to retry the exact page that failed", async () => {
    at("?from=%2Fprivate%2Flog");
    render(<OfflineRecovery />);

    await userEvent.click(screen.getByRole("button", { name: /\/private\/log/ }));

    expect(replace).toHaveBeenCalledWith("/private/log");
  });

  it("adds no retry button when nothing said what failed", () => {
    // Rather than a button pointing at a guess. The server-rendered links are already there.
    at("");
    render(<OfflineRecovery />);

    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("the target is untrusted input", () => {
  it("refuses an absolute URL, which would make Retry an open redirect", () => {
    // `?from=` arrives in a URL on a page anyone can reach. Sending Retry to another origin
    // would be a redirect this app hands out to whoever crafts the link.
    at("?from=https%3A%2F%2Fevil.example%2Fsteal");
    render(<OfflineRecovery />);

    expect(screen.queryByRole("button")).toBeNull();
  });

  it("refuses a protocol-relative URL, which is the same trick one slash shorter", () => {
    at("?from=%2F%2Fevil.example%2Fsteal");
    render(<OfflineRecovery />);

    expect(screen.queryByRole("button")).toBeNull();
  });
});
