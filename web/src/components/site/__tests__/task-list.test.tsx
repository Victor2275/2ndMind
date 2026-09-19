import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TaskList, type TaskView } from "@/components/site/task-list";
import { PrivateToaster } from "@/components/site/toasts";

/**
 * Undo, through the toast (V4 §5.2, Q265, Q268).
 *
 * This is the app's **first** `toast()` — D-192 established that the `Toaster` was mounted
 * nowhere and `toast()` was called nowhere, so until §5.2 the whole system was dead code that
 * looked alive. What matters here is not that a toast appears: it is that Q265's claim holds.
 * Q265 makes destructive actions **undoable rather than confirmed**, so there is no
 * confirmation dialog anywhere in this app, and the toast is therefore the entire safety story
 * for a delete. If it does not appear, or its Undo does not reach the same Server Action the
 * old inline row reached, a mis-swipe on a phone is permanent.
 *
 * The Server Actions are mocked because they are the boundary: what is being tested is the
 * wiring between a removal and its undo, not what the database does with either.
 */

const removeTask = vi.fn();
const undoTask = vi.fn();
const toggleTask = vi.fn();
const addTask = vi.fn();

vi.mock("@/app/private/actions", () => ({
  removeTask: (...args: unknown[]) => removeTask(...args),
  undoTask: (...args: unknown[]) => undoTask(...args),
  toggleTask: (...args: unknown[]) => toggleTask(...args),
  addTask: (...args: unknown[]) => addTask(...args),
}));

const TASK: TaskView = {
  id: 7,
  title: "Book the ergometer",
  source: "manual",
  domain: null,
  courseCode: null,
  dueAt: null,
  done: false,
  tags: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  // Sonner's queue is a **module singleton**, so it outlives `cleanup()` — unmounting the
  // `Toaster` takes the portal down and leaves the toasts in the store, and the next test's
  // `Toaster` renders them again. Without this the third test below finds two Undo buttons,
  // one of them left over from the first.
  toast.dismiss();
  removeTask.mockResolvedValue({ ok: true, message: "Removed.", undoId: 7 });
  undoTask.mockResolvedValue({ ok: true, message: "Back." });
  toggleTask.mockResolvedValue({ ok: true, message: "" });
  addTask.mockResolvedValue({ ok: true, message: "" });
});

/** The list plus the toaster it renders into — the layout mounts the second one in the app. */
function mount(tasks: TaskView[] = [TASK]) {
  return render(
    <>
      <TaskList tasks={tasks} emptyMessage="Nothing here." />
      <PrivateToaster />
    </>,
  );
}

describe("removing a task", () => {
  it("offers the undo in a toast rather than a row under the list", async () => {
    mount();
    await userEvent.click(screen.getByRole("button", { name: /remove book the ergometer/i }));

    // Bottom-anchored, so it is in the same place whatever the list is doing. The row it
    // replaced rendered *below* the list, which on Today is off screen.
    expect(await screen.findByRole("button", { name: "Undo" })).toBeInTheDocument();
  });

  it("sends the undo to the same action, carrying the id the removal returned", async () => {
    mount();
    await userEvent.click(screen.getByRole("button", { name: /remove book the ergometer/i }));
    await userEvent.click(await screen.findByRole("button", { name: "Undo" }));

    await waitFor(() => expect(undoTask).toHaveBeenCalled());
    const data = undoTask.mock.calls[0]?.[1] as FormData;
    // `undoId` comes back on the action state precisely so the UI can offer undo without a
    // second query. Losing it here would make the toast an apology rather than a way back.
    expect(data.get("id")).toBe("7");
  });

  it("offers nothing to undo when the removal failed", async () => {
    removeTask.mockResolvedValue({ ok: false, message: "The database is behind this build." });
    mount();
    await userEvent.click(screen.getByRole("button", { name: /remove book the ergometer/i }));

    // An undo for something that did not happen restores a row that was never gone, or fails
    // silently. Either way it tells the reader the delete worked when it did not.
    await waitFor(() => expect(removeTask).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
  });
});
