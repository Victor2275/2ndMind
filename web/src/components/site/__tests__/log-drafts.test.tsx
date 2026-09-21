// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { categoryByKey, type Category } from "@/lib/log/categories";
import type { ActionState } from "@/lib/sprint-goals";

/**
 * The half-typed entry, across a restart (V4 §5.5, Q394).
 *
 * The form is real — real inputs, real `FormData`, real `localStorage`. Only the Server Action
 * is mocked, because it is the boundary. What is being tested is the promise the feature makes:
 * close the app mid-entry, come back, and what you typed is in front of you **and says it has
 * not been saved**. The second half is what keeps this safe; a restored measurement that looks
 * like a fresh one is worse than a lost draft.
 *
 * **Real timers, deliberately.** The write is debounced, and the obvious `vi.useFakeTimers()`
 * deadlocks against `userEvent`'s own scheduling here — every test in the file times out, which
 * is a slower and much more confusing failure than waiting 500ms. `waitFor` covers the delay
 * without making the debounce interval part of the test's contract. `drafts.test.ts` owns the
 * exact-behaviour assertions.
 */

const createLogEntry = vi.fn<(prev: ActionState | null, data: FormData) => Promise<ActionState>>();

vi.mock("@/app/private/log/actions", () => ({
  createLogEntry: (prev: ActionState | null, data: FormData) => createLogEntry(prev, data),
}));

vi.mock("@/components/site/dictate-button", () => ({ DictateButton: () => null }));

const { LogForm } = await import("../log-form");
const { resetStickyCache } = await import("@/lib/log/sticky");
const { resetDraftCache, readDraft } = await import("@/lib/log/drafts");

const reading = categoryByKey("reading") as Category;

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  resetStickyCache();
  resetDraftCache();
  createLogEntry.mockResolvedValue({ ok: true, message: "Logged." });
});

describe("a draft is kept while typing", () => {
  it("lands in storage without the entry being saved", async () => {
    render(<LogForm category={reading} />);
    await userEvent.type(screen.getByLabelText(/title/i), "Thinking in Systems");

    await waitFor(() =>
      expect(readDraft(window.localStorage, reading).title).toBe("Thinking in Systems"),
    );
    // Nothing has been sent anywhere. The draft is a local convenience, not a save.
    expect(createLogEntry).not.toHaveBeenCalled();
  });
});

describe("a draft comes back, and says what it is", () => {
  it("fills the fields and announces the restore", async () => {
    window.localStorage.setItem(
      "2m_draft_reading",
      JSON.stringify({ title: "Seeing Like a State" }),
    );
    resetDraftCache();

    render(<LogForm category={reading} />);

    await waitFor(() =>
      expect((screen.getByLabelText(/title/i) as HTMLInputElement).value).toBe(
        "Seeing Like a State",
      ),
    );

    // Q394 restores the entry; this sentence is what stops a restored value reading as a
    // saved one.
    expect(screen.getByText(/nothing here has been saved yet/i)).toBeInTheDocument();
  });

  it("can be thrown away in one tap", async () => {
    window.localStorage.setItem("2m_draft_reading", JSON.stringify({ title: "Half a thought" }));
    resetDraftCache();

    render(<LogForm category={reading} />);
    await screen.findByText(/nothing here has been saved yet/i);

    await userEvent.click(screen.getByRole("button", { name: /start fresh/i }));

    expect(readDraft(window.localStorage, reading)).toEqual({});
    await waitFor(() =>
      expect((screen.getByLabelText(/title/i) as HTMLInputElement).value).toBe(""),
    );
  });

  it("says nothing when there is no draft", () => {
    render(<LogForm category={reading} />);
    expect(screen.queryByText(/nothing here has been saved yet/i)).toBeNull();
  });
});

describe("a saved entry is not a draft", () => {
  it("clears the draft once the save succeeds", async () => {
    render(<LogForm category={reading} />);
    await userEvent.type(screen.getByLabelText(/title/i), "Thinking in Systems");
    await waitFor(() =>
      expect(readDraft(window.localStorage, reading).title).toBe("Thinking in Systems"),
    );

    await userEvent.click(screen.getByRole("button", { name: /log reading/i }));

    // The entry exists now. A draft of it would come back tomorrow as a second copy waiting to
    // be saved again.
    await waitFor(() => expect(readDraft(window.localStorage, reading)).toEqual({}));
  });
});
