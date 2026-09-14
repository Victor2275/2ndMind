// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TAB_CATEGORIES } from "@/lib/log/categories";
import type { ActionState } from "@/lib/sprint-goals";
import type { EntryView } from "../log-console";

/**
 * The log page's console (D-164).
 *
 * Two reported problems, both about what is on screen rather than what is stored.
 *
 * **Every category must be visible without swiping.** The tab row used to scroll sideways,
 * which kept it to one line and hid whatever did not fit — on a 360px phone that was the last
 * two categories, with nothing on screen to say they existed. A tab you cannot see is a tab
 * that does not get used.
 *
 * **A captured note must not appear twice.** It is shown in the unsorted pile, which is where
 * it is acted on; rendering it again in Today would cost the vertical space this whole change
 * is about.
 */

const file = vi.fn<(prev: ActionState | null, data: FormData) => Promise<ActionState>>();
let filed: FormData | null = null;

vi.mock("@/app/private/log/actions", () => ({
  removeLogEntry: vi.fn(async () => ({ ok: true, message: "Removed." })),
  undoLogEntry: vi.fn(async () => ({ ok: true, message: "Restored." })),
  createLogEntry: vi.fn(async () => ({ ok: true, message: "Logged." })),
  captureQuick: vi.fn(async () => ({ ok: true, message: "Noted." })),
  fileLogEntry: (prev: ActionState | null, data: FormData) => {
    filed = data;
    return file(prev, data);
  },
  tagLogEntry: vi.fn(async () => ({ ok: true, message: "Tagged." })),
}));

const { LogConsole } = await import("../log-console");

const note = (id: number, text: string): EntryView => ({
  id,
  category: "note",
  occurredAt: "2026-09-05T18:00:00.000Z",
  note: text,
  data: {},
  tags: [],
});

beforeEach(() => {
  vi.clearAllMocks();
  filed = null;
  file.mockResolvedValue({ ok: true, message: "Filed under Training." });
});

describe("the tab row", () => {
  /** The tab row itself, not every button on the page. */
  const tabs = (container: HTMLElement) =>
    [...container.querySelectorAll("[aria-pressed]")].filter(
      (element) => element.getAttribute("type") === "button",
    );

  it("shows every category, with none hidden behind a swipe", () => {
    const { container } = render(<LogConsole entries={[]} loggedToday={[]} />);

    const labels = tabs(container).map((tab) => tab.textContent?.trim());
    for (const category of TAB_CATEGORIES) {
      expect(labels).toContain(category.label);
    }
  });

  it("wraps rather than scrolling sideways", () => {
    // The actual regression, and it is a CSS one: `overflow-x-auto` is what put two categories
    // off-screen with nothing on screen to indicate they were there.
    const { container } = render(<LogConsole entries={[]} loggedToday={[]} />);

    expect(container.querySelector('[class*="flex-wrap"]')).not.toBeNull();
    expect(container.querySelector('[class*="overflow-x-auto"]')).toBeNull();
  });

  it("does not give the capture category a tab", () => {
    // The whole point of a quick note is not choosing a category. (The capture box's own
    // note/task toggle is a different control and is not in the tab row.)
    const { container } = render(<LogConsole entries={[]} loggedToday={[]} />);
    expect(tabs(container).map((tab) => tab.textContent?.trim())).not.toContain("Note");
  });
});

describe("the capture box", () => {
  it("is above the tabs, and present whatever category is selected", async () => {
    render(<LogConsole entries={[]} loggedToday={[]} />);
    expect(screen.getByPlaceholderText(/on your mind/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /reading/i }));
    expect(screen.getByPlaceholderText(/on your mind/i)).toBeInTheDocument();
  });
});

describe("the unsorted pile", () => {
  it("does not appear at all when it is empty", () => {
    // A second inbox is a real cost. It earns its place by disappearing completely.
    render(<LogConsole entries={[]} loggedToday={[]} />);
    expect(screen.queryByText("Unsorted")).toBeNull();
  });

  it("shows what has been captured, with a count", () => {
    render(
      <LogConsole
        entries={[]}
        unsorted={[note(1, "that stroke cue worked"), note(2, "ask about the lab report")]}
        loggedToday={[]}
      />,
    );

    expect(screen.getByText("Unsorted")).toBeInTheDocument();
    expect(screen.getByText("that stroke cue worked")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("offers every real category as a one-tap target", () => {
    // A select on a phone is a modal wheel. Filing is meant to cost less than writing the
    // thing did.
    render(<LogConsole entries={[]} unsorted={[note(1, "a thought")]} loggedToday={[]} />);

    const buttons = screen.getAllByRole("button").map((b) => b.textContent);
    for (const category of TAB_CATEGORIES) {
      expect(buttons.filter((text) => text === category.label).length).toBeGreaterThan(0);
    }
  });

  it("files the note it was tapped on, into the category that was tapped", async () => {
    render(<LogConsole entries={[]} unsorted={[note(7, "a thought")]} loggedToday={[]} />);

    // "Study" rather than "Training": Phase 2.7 retired the athletics category, so it is no
    // longer one of the destinations an unsorted note can be filed into. What is under test is
    // the filing, not which categories exist.
    const study = screen
      .getAllByRole("button", { name: "Study" })
      .find((button) => button.getAttribute("type") === "submit");
    await userEvent.click(study!);

    await waitFor(() => expect(file).toHaveBeenCalled());
    expect(filed?.get("id")).toBe("7");
    expect(filed?.get("category")).toBe("academics");
  });
});

describe("opening on a category, from the icon's shortcut", () => {
  /**
   * §3.5. The long-press shortcut arrives at `/private/log?category=…`; the page validates the
   * key and hands it down. Arriving on the wrong tab costs exactly the tap the shortcut exists
   * to save.
   *
   * The training shortcut no longer comes here at all — Phase 2.7 pointed it at
   * `/private/athletics/log` — but the mechanism still serves "End of day" and anything added
   * later, so it is still worth pinning.
   */
  it("starts on the category it was asked for", () => {
    render(<LogConsole entries={[]} loggedToday={[]} initialCategory="day" />);
    expect(screen.getByRole("button", { name: /log end of day/i })).toBeInTheDocument();
  });

  it("starts on the first tab when nothing was asked for", () => {
    // Training was the first tab until Phase 2.7 retired it; Study is now.
    render(<LogConsole entries={[]} loggedToday={[]} />);
    expect(screen.getByRole("button", { name: /log study/i })).toBeInTheDocument();
  });
});
