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

/** The two chip rows are `role="group"`, so a chip is looked up inside the row it belongs to —
 *  "Legs" as a muscle group and "Legs" as anything else could otherwise collide. */
const groupFilters = () => screen.getByRole("group", { name: /filter by muscle group/i });
const equipmentFilters = () => screen.getByRole("group", { name: /filter by equipment/i });

/** Row labels in the order they are painted, which is the thing search ranking is about. */
function rowNames(): string[] {
  return (
    screen
      .getAllByRole("listitem")
      .map((li) => li.textContent ?? "")
      // The row leads with the muscle figure, whose two labels land in `textContent` ahead of the
      // exercise name. Stripped so an assertion can anchor on the name.
      .map((text) => text.replace(/^(?:Front|Back)+/, "").trim())
  );
}

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

  it("shows them once the chip is pressed", () => {
    render(<ExerciseList entries={ENTRIES} />);
    fireEvent.click(screen.getByRole("button", { name: /show archived/i }));
    expect(screen.getByText("Archived Curl (Barbell)")).toBeInTheDocument();
    expect(screen.getByText(/archived/, { selector: "span" })).toBeInTheDocument();
  });
});

describe("filters", () => {
  it("narrows to one muscle group", () => {
    render(<ExerciseList entries={ENTRIES} />);
    fireEvent.click(within(groupFilters()).getByRole("button", { name: "Legs" }));
    expect(screen.getByText("Back Squat (Barbell)")).toBeInTheDocument();
    expect(screen.getByText("Deadlift (Barbell)")).toBeInTheDocument();
    expect(screen.queryByText("Bench Press (Barbell)")).not.toBeInTheDocument();
  });

  it("narrows by equipment", () => {
    const withMachine = [...ENTRIES, entry({ name: "Leg Press (Machine)", equipment: "machine" })];
    render(<ExerciseList entries={withMachine} />);
    fireEvent.click(within(equipmentFilters()).getByRole("button", { name: "machine" }));
    expect(screen.getByText("Leg Press (Machine)")).toBeInTheDocument();
    expect(screen.queryByText("Bench Press (Barbell)")).not.toBeInTheDocument();
  });

  it("searches by name", () => {
    render(<ExerciseList entries={ENTRIES} />);
    fireEvent.change(screen.getByRole("searchbox", { name: /search exercises/i }), {
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
            pieceType: null,
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
    fireEvent.change(screen.getByRole("searchbox", { name: /search exercises/i }), {
      target: { value: "zzzznotreal" },
    });
    expect(screen.getByText("Nothing here.")).toBeInTheDocument();
  });
});

describe("search ranking", () => {
  /**
   * The bug of 2026-09-10: `Row (Erg)` is tagged `full body`, which has no coarse group, so the
   * grouping dropped it into "Other" — painted last — however well it had scored. A query now
   * abandons the grouping entirely and renders one ranked list.
   */
  const ERG = entry({
    seedKey: "row-erg",
    clientId: "11111111-0000-4000-8000-000000000005",
    name: "Row (Erg)",
    modality: "erg",
    equipment: "erg",
    primaryMuscles: ["full body"],
    secondaryMuscles: [],
  });

  it("puts the best match first rather than in its muscle group's slot", () => {
    render(<ExerciseList entries={[...ENTRIES, ERG]} />);
    fireEvent.change(screen.getByRole("searchbox", { name: /search exercises/i }), {
      target: { value: "erg" },
    });
    expect(rowNames()[0]).toMatch(/Row \(Erg\)/);
  });

  it("collapses to a single section while searching, and restores the groups when cleared", () => {
    render(<ExerciseList entries={[...ENTRIES, ERG]} />);
    const box = screen.getByRole("searchbox", { name: /search exercises/i });

    fireEvent.change(box, { target: { value: "press" } });
    expect(screen.getAllByRole("heading")).toHaveLength(1);
    expect(screen.getByRole("heading", { name: /^Best matches/ })).toBeInTheDocument();

    fireEvent.change(box, { target: { value: "" } });
    expect(screen.getByRole("heading", { name: /^Chest/ })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /^Best matches/ })).not.toBeInTheDocument();
  });

  it("lets history break a tie without overturning a better match", () => {
    // "Squat (Barbell)" is the exact prefix for "squat"; "Back Squat (Barbell)" is a strong but
    // weaker match that was performed today. The prefix must still win.
    const plain = entry({
      seedKey: "squat",
      clientId: "11111111-0000-4000-8000-000000000006",
      name: "Squat (Barbell)",
      primaryMuscles: ["quads"],
    });
    render(
      <ExerciseList
        entries={[plain, ENTRIES[1]]}
        efforts={[
          {
            exercise: "Back Squat (Barbell)",
            performedAt: new Date(),
            setType: "normal",
            weightLbs: 225,
            reps: 5,
            distanceM: null,
            durationS: null,
            spm: null,
            pieceType: null,
          },
        ]}
      />,
    );
    fireEvent.change(screen.getByRole("searchbox", { name: /search exercises/i }), {
      target: { value: "squat" },
    });
    expect(rowNames()[0]).toMatch(/^Squat \(Barbell\)/);
  });
});

describe("filter chips", () => {
  it("offers only the groups and equipment that actually occur", () => {
    render(<ExerciseList entries={ENTRIES} />);
    expect(within(groupFilters()).getByRole("button", { name: "Chest" })).toBeInTheDocument();
    // Nothing in ENTRIES is tagged to a shoulder, so there is no dead-end chip for it.
    expect(within(groupFilters()).queryByRole("button", { name: "Shoulders" })).toBeNull();
    expect(within(equipmentFilters()).queryByRole("button", { name: "machine" })).toBeNull();
  });

  it("toggles a pressed chip back off", () => {
    render(<ExerciseList entries={ENTRIES} />);
    const legs = within(groupFilters()).getByRole("button", { name: "Legs" });
    fireEvent.click(legs);
    expect(screen.queryByText("Bench Press (Barbell)")).not.toBeInTheDocument();
    fireEvent.click(legs);
    expect(screen.getByText("Bench Press (Barbell)")).toBeInTheDocument();
  });
});
