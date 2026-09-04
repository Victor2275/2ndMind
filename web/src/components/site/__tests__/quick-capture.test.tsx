// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ActionState } from "@/lib/sprint-goals";

/**
 * The capture box (D-164).
 *
 * Two properties carry it. **It asks nothing but the text** — a box that wants a category is a
 * filing form, and filing is the work being deferred. And **it must not lose what was typed**:
 * the entire premise is that a thought is captured before it goes, so a failed save that also
 * blanked the field would be the one failure this box cannot afford. React blanks a
 * function-action form as soon as the action returns, success or not, so that is not free.
 */

const captured = vi.fn<(prev: ActionState | null, data: FormData) => Promise<ActionState>>();
let sent: FormData | null = null;

vi.mock("@/app/private/log/actions", () => ({
  captureQuick: (prev: ActionState | null, data: FormData) => {
    sent = data;
    return captured(prev, data);
  },
}));

const { QuickCapture } = await import("../quick-capture");

beforeEach(() => {
  vi.clearAllMocks();
  sent = null;
  captured.mockResolvedValue({ ok: true, message: "Noted." });
});

describe("what it asks for", () => {
  it("is one field and a send button", () => {
    render(<QuickCapture />);

    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save/i })).toBeInTheDocument();
  });

  it("offers no category, because choosing one is the work being deferred", () => {
    render(<QuickCapture />);

    for (const label of ["Training", "Study", "Reading", "People", "End of day"]) {
      expect(screen.queryByText(label)).toBeNull();
    }
  });

  it("defaults to a note, which is the cheaper mistake", async () => {
    // A note can be filed later. A task nobody meant sits in a list demanding to be ticked.
    render(<QuickCapture />);

    await userEvent.type(screen.getByRole("textbox"), "that stroke cue worked");
    await userEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(captured).toHaveBeenCalled());
    expect(sent?.get("as")).toBe("note");
    expect(sent?.get("text")).toBe("that stroke cue worked");
  });

  it("sends a task when asked, because only the writer knows which it is", async () => {
    render(<QuickCapture />);

    await userEvent.click(screen.getByRole("button", { name: "task" }));
    await userEvent.type(screen.getByRole("textbox"), "email the coach");
    await userEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(captured).toHaveBeenCalled());
    expect(sent?.get("as")).toBe("task");
  });

  it("changes the placeholder with the mode, so the mode is visible without reading a chip", async () => {
    render(<QuickCapture />);
    expect(screen.getByPlaceholderText(/on your mind/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "task" }));
    expect(screen.getByPlaceholderText(/to do/i)).toBeInTheDocument();
  });
});

describe("when the save fails", () => {
  it("puts back what was typed rather than losing the thought", async () => {
    captured.mockResolvedValue({ ok: false, message: "DATABASE_URL is not set." });
    render(<QuickCapture />);

    await userEvent.type(screen.getByRole("textbox"), "the thing I must not forget");
    await userEvent.click(screen.getByRole("button", { name: /save/i }));

    expect(await screen.findByRole("status")).toHaveTextContent("DATABASE_URL");
    await waitFor(() =>
      expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe(
        "the thing I must not forget",
      ),
    );
  });

  it("clears the field on success, so the next thought starts empty", async () => {
    render(<QuickCapture />);

    await userEvent.type(screen.getByRole("textbox"), "noted");
    await userEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe(""));
  });
});

describe("offline", () => {
  it("writes wherever it is told to, so the shell can enqueue instead of posting", async () => {
    // The same component runs on `/cached`, handed a writer that puts it in the outbox. The
    // box stays ignorant of the network, exactly as `LogForm` does (D-163).
    const local = vi.fn(async () => ({ ok: true, message: "Noted. It will send." }));
    render(<QuickCapture write={local} />);

    await userEvent.type(screen.getByRole("textbox"), "on a plane");
    await userEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(local).toHaveBeenCalled());
    expect(captured).not.toHaveBeenCalled();
  });
});
