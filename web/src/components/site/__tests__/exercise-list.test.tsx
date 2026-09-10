import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ExerciseList } from "@/components/site/exercise-list";
import type { LocalExercise } from "@/lib/athletics/local";

/**
 * The exercise browser's list (V4 Phase 2++ Stage 4). One component for the standalone page and
 * the logger's sheet — see its module doc — so what is tested here is what both places get.
 */

function entry(over: Partial<LocalExercise> = {}): LocalExercise {
  return {
    seedKey: "bench-press",
    clientId: "11111111-0000-4000-8000-000000000001",
    name: "Bench Press (Barbell)",
    modality: "lift",
    equipment: "barbell",
    primaryMuscles: ["chest"],
    secondaryMuscles: ["triceps"],
    aliases: [],
    howTo: "",
    notes: "",
    restSeconds: null,
    archivedAt: null,
    userEditedFields: [],
    ...over,
  };
}

const ENTRIES: LocalExercise[] = [
  entry(),
  entry({
    seedKey: "back-squat",
    clientId: "11111111-0000-4000-8000-000000000002",
    name: "Back Squat (Barbell)",
    primaryMuscles: ["quads"],
    secondaryMuscles: ["glutes"],
  }),
  entry({
    seedKey: "deadlift",
    clientId: "11111111-0000-4000-8000-000000000003",
    name: "Deadlift (Barbell)",
    primaryMuscles: ["hamstrings"],
    secondaryMuscles: ["glutes", "lower back"],
  }),
  entry({
    seedKey: null,
    clientId: "11111111-0000-4000-8000-000000000004",
    name: "Archived Curl (Barbell)",
    primaryMuscles: ["biceps"],
    secondaryMuscles: [],
    archivedAt: "2026-09-01T00:00:00.000Z",
  }),
];

describe("grouping", () => {
  it("groups entries by their primary muscle's coarse group", () => {
    render(<ExerciseList entries={ENTRIES} />);
    expect(screen.getByRole("heading", { name: /^Chest/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Legs/ })).toBeInTheDocument();
  });
});

describe("archived entries", () => {
  it("hides archived entries by default", () => {
    render(<ExerciseList entries={ENTRIES} />);
    expect(screen.queryByText("Archived Curl (Barbell)")).not.toBeInTheDocument();
  });

  it("shows them once the checkbox is ticked", () => {
    render(<ExerciseList entries={ENTRIES} />);
    fireEvent.click(screen.getByRole("checkbox", { name: /show archived/i }));
    expect(screen.getByText("Archived Curl (Barbell)")).toBeInTheDocument();
    expect(screen.getByText(/archived/, { selector: "span" })).toBeInTheDocument();
  });
});

describe("filters", () => {
  it("narrows to one muscle group", () => {
    render(<ExerciseList entries={ENTRIES} />);
    fireEvent.change(screen.getByRole("combobox", { name: /filter by muscle group/i }), {
      target: { value: "Legs" },
    });
    expect(screen.getByText("Back Squat (Barbell)")).toBeInTheDocument();
    expect(screen.getByText("Deadlift (Barbell)")).toBeInTheDocument();
    expect(screen.queryByText("Bench Press (Barbell)")).not.toBeInTheDocument();
  });

  it("narrows by equipment", () => {
    const withMachine = [...ENTRIES, entry({ name: "Leg Press (Machine)", equipment: "machine" })];
    render(<ExerciseList entries={withMachine} />);
    fireEvent.change(screen.getByRole("combobox", { name: /filter by equipment/i }), {
      target: { value: "machine" },
    });
    expect(screen.getByText("Leg Press (Machine)")).toBeInTheDocument();
    expect(screen.queryByText("Bench Press (Barbell)")).not.toBeInTheDocument();
  });

  it("searches by name", () => {
    render(<ExerciseList entries={ENTRIES} />);
    fireEvent.change(screen.getByRole("textbox", { name: /search exercises/i }), {
      target: { value: "deadlift" },
    });
    expect(screen.getByText("Deadlift (Barbell)")).toBeInTheDocument();
    expect(screen.queryByText("Bench Press (Barbell)")).not.toBeInTheDocument();
  });
});

describe("row mode", () => {
  it("renders a link to the detail page when no onSelect is given", () => {
    render(<ExerciseList entries={[entry()]} />);
    const link = screen.getByRole("link", { name: /Bench Press/ });
    expect(link).toHaveAttribute("href", "/private/athletics/exercises/bench-press");
  });

  it("renders a button and calls onSelect, given one", () => {
    const onSelect = vi.fn();
    render(<ExerciseList entries={[entry()]} onSelect={onSelect} />);
    const button = screen.getByRole("button", { name: /Bench Press/ });
    fireEvent.click(button);
    expect(onSelect).toHaveBeenCalledWith(entry());
    expect(screen.queryByRole("link", { name: /Bench Press/ })).not.toBeInTheDocument();
  });
});

describe("PR display", () => {
  it("shows the heaviest set for a lift with logged history", () => {
    render(
      <ExerciseList
        entries={[entry()]}
        efforts={[
          {
            exercise: "Bench Press (Barbell)",
            performedAt: new Date("2026-09-01"),
            setType: "normal",
            weightLbs: 185,
            reps: 5,
            distanceM: null,
            durationS: null,
            spm: null,
          },
        ]}
      />,
    );
    expect(screen.getByText("185 × 5")).toBeInTheDocument();
  });

  it("shows nothing when there is no history", () => {
    const { container } = render(<ExerciseList entries={[entry()]} />);
    expect(within(container).queryByText(/×/)).not.toBeInTheDocument();
  });
});

describe("empty state", () => {
  it("says so when nothing matches", () => {
    render(<ExerciseList entries={ENTRIES} emptyLabel="Nothing here." />);
    fireEvent.change(screen.getByRole("textbox", { name: /search exercises/i }), {
      target: { value: "zzzznotreal" },
    });
    expect(screen.getByText("Nothing here.")).toBeInTheDocument();
  });
});
