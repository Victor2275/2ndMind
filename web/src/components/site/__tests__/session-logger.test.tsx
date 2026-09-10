// @vitest-environment jsdom
import "fake-indexeddb/auto";

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SessionLogger } from "@/components/site/session-logger";
import { allOps, DB_NAME, openSyncDb, type SyncDb } from "@/lib/sync/store";

/**
 * The rebuilt logger (V4 Phase 2++ Stage 5).
 *
 * jsdom cannot lay out, so nothing here says the screen *looks* right — `npm run shots` and the
 * browser pass in `scripts/` do that, and they are what caught D-219 and D-220. What is testable
 * is the behaviour Stage 5 added and the behaviour it must not have broken: a set can be ticked
 * complete, ticking one starts the rest timer, a per-set note and a per-exercise note reach the
 * outbox op, and the ghost placeholder shows last time's numbers without filling them in.
 *
 * The catalogue comes from the bundle (D-224), so this renders with a real exercise list and no
 * sync at all — which is the same reason the screen works in a gym basement.
 */

let db: SyncDb;

beforeEach(async () => {
  db = await openSyncDb(DB_NAME);
  const tx = db.transaction(
    ["outbox", "workouts", "workout_sets", "exercises", "routines", "routine_exercises"],
    "readwrite",
  );
  await Promise.all([
    tx.objectStore("outbox").clear(),
    tx.objectStore("workouts").clear(),
    tx.objectStore("workout_sets").clear(),
    tx.objectStore("exercises").clear(),
    tx.objectStore("routines").clear(),
    tx.objectStore("routine_exercises").clear(),
  ]);
  await tx.done;
  vi.stubGlobal("navigator", { ...globalThis.navigator, vibrate: vi.fn(() => true) });
});

afterEach(() => {
  db?.close();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/**
 * The picker's selectable rows, in list order.
 *
 * Scoped to the `<ul>`s rather than to the whole panel: `aria-pressed` is the right semantics
 * for a toggle, and since D-232 the filter chips in the pinned header are toggles too, so
 * "every button that is not pressed" now finds "All" and "Any kit" before it finds an exercise.
 */
async function pickerRows() {
  const lists = await screen.findAllByRole("list");
  return lists.flatMap((list) => within(list).getAllByRole("button", { pressed: false }));
}

/** Opens the picker, selects the first row, and adds it. */
async function addFirstExercise() {
  fireEvent.click(screen.getByRole("button", { name: "Add exercise" }));
  const rows = await pickerRows();
  fireEvent.click(rows[0]);
  fireEvent.click(await screen.findByRole("button", { name: /Add 1 exercise$/ }));
}

describe("multi-select picking", () => {
  it("adds several exercises in one pass", async () => {
    render(<SessionLogger />);
    fireEvent.click(screen.getByRole("button", { name: "Add exercise" }));

    const rows = await pickerRows();
    fireEvent.click(rows[0]);
    fireEvent.click(rows[1]);

    // The button counts what is selected — "Add 3 exercises" in one pass is the point.
    const add = await screen.findByRole("button", { name: /Add 2 exercises/ });
    fireEvent.click(add);

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /^Remove / }).length).toBe(2);
    });
  });

  it("counts a single selection in the singular", async () => {
    render(<SessionLogger />);
    fireEvent.click(screen.getByRole("button", { name: "Add exercise" }));
    const rows = await pickerRows();
    fireEvent.click(rows[0]);
    expect(await screen.findByRole("button", { name: /Add 1 exercise$/ })).toBeInTheDocument();
  });

  it("deselects on a second tap rather than adding twice", async () => {
    render(<SessionLogger />);
    fireEvent.click(screen.getByRole("button", { name: "Add exercise" }));
    const rows = await pickerRows();
    fireEvent.click(rows[0]);
    fireEvent.click(rows[0]);
    expect(await screen.findByRole("button", { name: "Select an exercise" })).toBeDisabled();
  });
});

describe("tick to complete", () => {
  it("marks a set done and starts the rest timer", async () => {
    render(<SessionLogger />);
    await addFirstExercise();

    const [tick] = await screen.findAllByRole("checkbox", { name: /Mark set 1 done/ });
    expect(tick).toHaveAttribute("aria-checked", "false");

    fireEvent.click(tick);

    // The row's own state flips, and the countdown appears — no push notification, per the plan.
    expect(
      (await screen.findAllByRole("checkbox", { name: /Mark set 1 not done/ }))[0],
    ).toBeInTheDocument();
    expect(screen.getByText("Rest")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Skip" })).toBeInTheDocument();
  });

  it("un-ticks without clearing what was typed", async () => {
    render(<SessionLogger />);
    await addFirstExercise();

    const weight = screen.getAllByLabelText(/lbs/i)[0];
    fireEvent.change(weight, { target: { value: "185" } });

    fireEvent.click((await screen.findAllByRole("checkbox", { name: /Mark set 1 done/ }))[0]);
    fireEvent.click((await screen.findAllByRole("checkbox", { name: /Mark set 1 not done/ }))[0]);

    expect(screen.getAllByLabelText(/lbs/i)[0]).toHaveValue("185");
  });

  it("dismisses the timer when Skip is tapped", async () => {
    render(<SessionLogger />);
    await addFirstExercise();
    fireEvent.click((await screen.findAllByRole("checkbox", { name: /Mark set 1 done/ }))[0]);

    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    await waitFor(() => expect(screen.queryByText("Rest")).not.toBeInTheDocument());
  });
});

describe("what reaches the outbox", () => {
  it("carries completedAt, the per-set note and the per-exercise note", async () => {
    render(<SessionLogger />);
    await addFirstExercise();

    fireEvent.change(screen.getAllByLabelText(/lbs/i)[0], { target: { value: "185" } });
    fireEvent.change(screen.getAllByLabelText(/reps/i)[0], { target: { value: "5" } });
    fireEvent.change(screen.getAllByPlaceholderText("Note for this set")[0], {
      target: { value: "felt heavy" },
    });
    fireEvent.change(screen.getAllByPlaceholderText("Note for this exercise")[0], {
      target: { value: "left shoulder" },
    });
    fireEvent.click((await screen.findAllByRole("checkbox", { name: /Mark set 1 done/ }))[0]);

    fireEvent.click(screen.getByRole("button", { name: /Save session/ }));

    await waitFor(async () => {
      const ops = await allOps(db);
      expect(ops).toHaveLength(1);
    });

    const [op] = await allOps(db);
    const payload = op.payload as {
      exerciseNotes: Record<string, string>;
      sets: { completedAt: string | null; notes: string }[];
    };
    expect(payload.sets[0].completedAt).toBeTruthy();
    expect(payload.sets[0].notes).toBe("felt heavy");
    expect(Object.values(payload.exerciseNotes)).toContain("left shoulder");
  });
});

describe("the block header", () => {
  it("carries an editable rest default", async () => {
    render(<SessionLogger />);
    await addFirstExercise();

    const rest = screen.getAllByLabelText(/Rest, seconds/)[0];
    expect(rest).toHaveValue(90);
    fireEvent.change(rest, { target: { value: "150" } });
    expect(screen.getAllByLabelText(/Rest, seconds/)[0]).toHaveValue(150);
  });
});

describe("the set table and the set cards", () => {
  it("renders both, so one can be hidden per breakpoint by CSS alone", async () => {
    // jsdom applies no media queries, so both trees are present here — which is the point of
    // checking it: the responsive swap is `lg:hidden`/`hidden lg:block`, and a regression that
    // dropped one of the two would be invisible to every other test in this file.
    render(<SessionLogger />);
    await addFirstExercise();

    const table = screen.getByRole("table");
    expect(within(table).getByRole("checkbox", { name: /Mark set 1/ })).toBeInTheDocument();
    // And the card list's own copy, outside the table.
    expect(screen.getAllByRole("checkbox", { name: /Mark set 1/ }).length).toBe(2);
  });
});

describe("routines (V4 Phase 2++ Stage 6)", () => {
  it("saves the session on screen as a routine, weights and all", async () => {
    render(<SessionLogger />);
    await addFirstExercise();

    fireEvent.change(screen.getByLabelText("Session"), { target: { value: "Push A" } });
    fireEvent.change(screen.getAllByLabelText(/lbs/i)[0], { target: { value: "185" } });
    fireEvent.change(screen.getAllByLabelText(/reps/i)[0], { target: { value: "5" } });

    fireEvent.click(screen.getByRole("button", { name: "Save as routine" }));

    await waitFor(async () => {
      const ops = await allOps(db);
      expect(ops.some((op) => op.entity === "routine")).toBe(true);
    });

    const op = (await allOps(db)).find((o) => o.entity === "routine")!;
    const payload = op.payload as {
      name: string;
      exercises: { exercise: string; targetSets: number | null; targetWeightLbs: number | null }[];
    };
    expect(payload.name).toBe("Push A");
    expect(payload.exercises).toHaveLength(1);
    // "Pre-filled with last weights" means the numbers travel with the template.
    expect(payload.exercises[0].targetWeightLbs).toBe(185);
    expect(payload.exercises[0].targetSets).toBe(1);
  });

  it("offers no routine button before anything is added", () => {
    render(<SessionLogger />);
    expect(screen.queryByRole("button", { name: "Save as routine" })).not.toBeInTheDocument();
  });

  it("starts a saved routine pre-filled", async () => {
    const { unmount } = render(<SessionLogger />);
    await addFirstExercise();
    fireEvent.change(screen.getByLabelText("Session"), { target: { value: "Push A" } });
    fireEvent.change(screen.getAllByLabelText(/lbs/i)[0], { target: { value: "185" } });
    fireEvent.change(screen.getAllByLabelText(/reps/i)[0], { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Save as routine" }));
    await waitFor(async () => {
      expect((await allOps(db)).some((op) => op.entity === "routine")).toBe(true);
    });
    unmount();

    // A fresh screen reads the routine back out of the local store and starts it.
    render(<SessionLogger />);
    const chip = await screen.findByRole("button", { name: /^Push A/ });
    fireEvent.click(chip);

    await waitFor(() => {
      expect(screen.getAllByLabelText(/lbs/i)[0]).toHaveValue("185");
    });
    expect(screen.getAllByLabelText(/reps/i)[0]).toHaveValue("5");
  });
});
