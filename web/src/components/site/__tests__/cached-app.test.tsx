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

/**
 * `next/link` renders a plain anchor with the same href, so nothing about the rendered DOM
 * distinguishes it — the first two attempts at the test below both passed whichever was used,
 * and jsdom has no router context for a click handler to cancel. Marking the module is the only
 * honest way to assert which one the code reached for.
 */
vi.mock("next/link", () => ({
  default: ({ children, ...props }: { children?: unknown; [k: string]: unknown }) => (
    <a data-next-link="yes" {...(props as Record<string, string>)}>
      {children as never}
    </a>
  ),
}));

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
  summary: null,
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

  // Inverted 2026-09-05, not deleted. It asserted that an unrecognised path falls back to
  // Today, which is what it did until Victor tapped one on the phone: showing the dashboard
  // for a Calendar tap reads as the tap having failed, or as Calendar being empty. The
  // fall-through survives for `/private` itself, which is the app's start_url and is covered
  // below (D-174).
  it("names a screen it does not keep, rather than falling back to Today", async () => {
    at("/private/hobbies");
    render(<CachedApp />);
    expect(await screen.findByText(/hobbies needs a signal/i)).toBeInTheDocument();
    expect(screen.queryByText("Due")).toBeNull();
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

describe("it looks like the app, not like the public site", () => {
  /**
   * Reported from the phone on 2026-09-05: *"it takes me to the public page, and doesn't let me
   * go to private."* Logging offline worked the whole time — what was wrong was that the shell
   * rendered with the portfolio's header and none of the app's own navigation, so it did not
   * read as the app at all (D-174).
   *
   * Two halves, and both are here because either one alone leaves the same symptom.
   */
  it("carries the app's bottom tab bar", async () => {
    render(<CachedApp />);
    await screen.findByText("Due");
    expect(screen.getByRole("navigation", { name: /private sections/i })).toBeInTheDocument();
  });

  it("navigates by document, because a client transition needs a server", async () => {
    // The whole point of this screen is that there is no server to answer an RSC request. A
    // <Link> here fails in exactly the situation the bar exists for, and it fails silently:
    // the tap does nothing.
    render(<CachedApp />);
    await screen.findByText("Due");

    // Not just the tab bar — the whole screen. Every link here is reached with no server to
    // answer for the next page, so a client transition is wrong everywhere, not only in the
    // bar. "Try the live app" was the last <Link> on this page and was exactly the control
    // whose job is to find out whether the server is back.
    const links = [...document.querySelectorAll("a")];
    expect(links.length).toBeGreaterThan(3);
    expect(links.filter((a) => a.hasAttribute("data-next-link"))).toEqual([]);

    const bar = screen.getByRole("navigation", { name: /private sections/i });
    for (const link of bar.querySelectorAll("a")) {
      expect(link.getAttribute("href")).toMatch(/^\/private/);
    }
  });

  it("lights the tab for the page the failed navigation was aimed at", async () => {
    // usePathname() is "/cached" on every one of these screens, so without the path being
    // passed in explicitly no tab would ever be marked current.
    at("/private/athletics");
    render(<CachedApp />);
    await screen.findByText(/training/i);

    const current = screen
      .getByRole("navigation", { name: /private sections/i })
      .querySelector('[aria-current="page"]');
    expect(current?.getAttribute("href")).toBe("/private/athletics");
  });

  it("does not offer sign-out, which cannot work with no network", async () => {
    render(<CachedApp />);
    await screen.findByText("Due");
    expect(screen.queryByRole("button", { name: /sign out/i })).toBeNull();
  });
});

describe("the last AI summary, offline", () => {
  /**
   * §3.6. The daily summary is the one thing on Today that cannot be recomputed without a
   * network, so before this it was simply absent with no explanation.
   */
  it("renders the stored summary with the day it describes", async () => {
    readCachedView.mockResolvedValue({
      ...BLANK,
      summary: { periodStart: "2026-09-03", summary: "Two erg pieces and a problem set." },
    });
    render(<CachedApp />);
    expect(await screen.findByText(/two erg pieces/i)).toBeInTheDocument();
    // The date is the caveat. Without it the text reads as a description of today.
    expect(screen.getByText("2026-09-03")).toBeInTheDocument();
  });

  it("says nothing at all when the phone has never stored one", async () => {
    render(<CachedApp />);
    await screen.findByText("Due");
    expect(screen.queryByText(/the last summary/i)).toBeNull();
  });
});

describe("a screen the phone does not keep", () => {
  /**
   * Before this, every unrecognised path fell through to Today — so tapping Calendar offline
   * showed the dashboard, which reads as the tap having failed or, worse, as Calendar being
   * empty. Naming it is the same choice `Missing` already makes inside the views.
   */
  it("names the screen rather than showing Today", async () => {
    at("/private/calendar");
    render(<CachedApp />);
    expect(await screen.findByText(/calendar needs a signal/i)).toBeInTheDocument();
    expect(screen.queryByText("Due")).toBeNull();
  });

  it("matches the longest path first, so Tailor is not called Work", async () => {
    at("/private/work/tailor");
    render(<CachedApp />);
    expect(await screen.findByText(/tailor needs a signal/i)).toBeInTheDocument();
  });

  it("still takes a captured note, which is why anyone is on a dead screen", async () => {
    at("/private/hobbies");
    render(<CachedApp />);
    expect(await screen.findByText(/hobbies needs a signal/i)).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: /private sections/i })).toBeInTheDocument();
  });

  it("still opens on Today for the app's own start_url", async () => {
    // start_url is /private, so the ordinary launch lands here. If this ever became an
    // "absent" screen, opening the app offline would show a refusal.
    at("/private");
    render(<CachedApp />);
    expect(await screen.findByText("Due")).toBeInTheDocument();
  });
});
