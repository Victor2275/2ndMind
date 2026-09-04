// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CachedView } from "@/lib/offline/read";

/**
 * The app with no signal (§2.1).
 *
 * The property worth a test rather than a comment: **a cached screen must read as cached.**
 * Every view says how old its data is, and it says so whether that is two minutes or two
 * weeks. A dashboard that looks live and is three days old is worse than no dashboard, because
 * it gets acted on.
 *
 * The second one, nearly as easy to lose: a panel this screen cannot fill must say it cannot,
 * not render empty. An empty "Schedule" reads as "nothing on today".
 */

const readCachedView = vi.fn<() => Promise<CachedView>>();
vi.mock("@/lib/offline/read", () => ({ readCachedView: () => readCachedView() }));

const { CachedApp } = await import("../cached-app");

const BLANK: CachedView = {
  freshness: { lastSyncAt: Date.now() - 60_000, ageMs: 60_000, level: "fresh" },
  due: [],
  backlog: [],
  byCourse: [],
  loggedToday: [],
  recentSets: [],
  weight: null,
  rehabToday: [],
  chips: {},
  empty: false,
};

function at(from: string) {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { search: from ? `?from=${encodeURIComponent(from)}` : "" },
  });
}

beforeEach(() => {
  at("/private");
  readCachedView.mockResolvedValue(BLANK);
});

describe("it always says how old it is", () => {
  it("puts the age on the page even when the copy is fresh", async () => {
    render(<CachedApp />);
    expect(await screen.findByText(/as of .* ago/i)).toBeInTheDocument();
  });

  it("says so plainly when the device has never synced", async () => {
    readCachedView.mockResolvedValue({
      ...BLANK,
      freshness: { lastSyncAt: null, ageMs: null, level: "never" },
      empty: true,
    });
    render(<CachedApp />);

    expect(await screen.findByText(/never synced/i)).toBeInTheDocument();
    expect(screen.getByText(/copies your tasks/i)).toBeInTheDocument();
  });

  it("warns when the copy is old enough to be misleading", async () => {
    readCachedView.mockResolvedValue({
      ...BLANK,
      freshness: { lastSyncAt: 0, ageMs: 5 * 24 * 60 * 60 * 1000, level: "stale" },
    });
    render(<CachedApp />);

    expect(await screen.findByText(/record of what was/i)).toBeInTheDocument();
  });
});

describe("which view it shows", () => {
  it("renders training for a failed athletics navigation", async () => {
    at("/private/athletics");
    readCachedView.mockResolvedValue({
      ...BLANK,
      weight: { measuredOn: "2026-09-05", weightLbs: 178 },
      recentSets: [
        {
          exercise: "Bench Press",
          performedAt: "2026-09-05T10:00:00.000Z",
          weightLbs: 185,
          reps: 5,
          distanceM: null,
          durationS: null,
        },
      ],
    });
    render(<CachedApp />);

    expect(await screen.findByText("178 lb")).toBeInTheDocument();
    expect(screen.getByText("Bench Press")).toBeInTheDocument();
    expect(screen.getByText("185 × 5")).toBeInTheDocument();
  });

  it("renders an erg piece without multiplying it by anything", async () => {
    at("/private/athletics");
    readCachedView.mockResolvedValue({
      ...BLANK,
      recentSets: [
        {
          exercise: "2k",
          performedAt: "2026-09-05T10:00:00.000Z",
          weightLbs: null,
          reps: null,
          distanceM: 2000,
          durationS: 432,
        },
      ],
    });
    render(<CachedApp />);

    expect(await screen.findByText("2000m 7:12")).toBeInTheDocument();
  });

  it("renders coursework grouped by course for academics", async () => {
    at("/private/academics");
    readCachedView.mockResolvedValue({
      ...BLANK,
      byCourse: [
        {
          course: "M51A",
          tasks: [
            {
              id: "1",
              title: "Problem set 3",
              dueAt: null,
              courseCode: "M51A",
              domain: null,
              overdue: false,
            },
          ],
        },
      ],
    });
    render(<CachedApp />);

    expect(await screen.findByText("M51A")).toBeInTheDocument();
    expect(screen.getByText("Problem set 3")).toBeInTheDocument();
  });

  it("falls back to Today for a path it does not recognise", async () => {
    at("/private/hobbies");
    render(<CachedApp />);
    expect(await screen.findByText("Due")).toBeInTheDocument();
  });
});

describe("what it admits it cannot show", () => {
  it("names the missing panels rather than rendering them empty", async () => {
    // An empty Schedule reads as "nothing on today", which is a different and wrong claim.
    render(<CachedApp />);
    expect(await screen.findByText(/calendar and the day's summary/i)).toBeInTheDocument();
    expect(screen.getByText(/need the network/i)).toBeInTheDocument();
  });

  it("does not compute records from a partial mirror", async () => {
    // Records are derived from the whole history (D-025) and only part of it is here. A PR
    // board built from a partial mirror is wrong in the direction that matters — too low —
    // and looks authoritative.
    at("/private/athletics");
    render(<CachedApp />);

    expect(await screen.findByText(/Records, charts/i)).toBeInTheDocument();
  });

  it("does write here, though — the log form is the whole of §2.2", async () => {
    // Was "says the log is read-only here". That sentence was the honest edge of §2.1 and is
    // now false: the form writes into the outbox and the ordinary flush sends it.
    at("/private/log");
    render(<CachedApp />);

    expect(await screen.findByRole("button", { name: /log training/i })).toBeInTheDocument();
    expect(screen.queryByText(/cannot write a new entry/i)).toBeNull();
  });

  it("says when the local database will not open, rather than showing nothing", async () => {
    readCachedView.mockRejectedValue(new Error("blocked"));
    render(<CachedApp />);
    expect(await screen.findByText(/will not open its local database/i)).toBeInTheDocument();
  });
});

describe("getting between the cached views", () => {
  it("links to the others through the shell, not through the live routes", async () => {
    // A link straight to /private/athletics with no signal is a navigation that fails. These
    // have to stay on the shell.
    render(<CachedApp />);
    await screen.findByText("Due");

    const training = screen.getByRole("link", { name: "Training" });
    expect(training.getAttribute("href")).toBe(
      `/cached?from=${encodeURIComponent("/private/athletics")}`,
    );
  });

  it("still offers the live app, for when there is signal again", async () => {
    render(<CachedApp />);
    await screen.findByText("Due");
    expect(screen.getByRole("link", { name: /live app/i }).getAttribute("href")).toBe("/private");
  });
});
