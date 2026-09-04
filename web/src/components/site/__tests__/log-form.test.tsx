// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { categoryByKey, type Category } from "@/lib/log/categories";
import type { ChipSets } from "@/lib/log/chips";
import type { ActionState } from "@/lib/sprint-goals";

/**
 * The form, as it behaves under a thumb.
 *
 * The three §1.6 shortcuts are each a claim about a real interaction, and each is a line of
 * code away from silently not happening: a chip that fills only its own field, a keypad
 * attribute on the wrong input, a sticky value that survives a save but not the remount after
 * it. None of those throws, and none of them is visible in a screenshot.
 *
 * `createLogEntry` is mocked because it is a Server Action reaching Postgres. What is not
 * mocked is the form: real inputs, real `FormData`, real `localStorage`.
 */

const createLogEntry = vi.fn<(prev: ActionState | null, data: FormData) => Promise<ActionState>>();
let lastSubmitted: FormData | null = null;

vi.mock("@/app/private/log/actions", () => ({
  createLogEntry: (prev: ActionState | null, data: FormData) => {
    lastSubmitted = data;
    return createLogEntry(prev, data);
  },
}));

vi.mock("@/components/site/dictate-button", () => ({ DictateButton: () => null }));

const { LogForm } = await import("../log-form");
const { resetStickyCache } = await import("@/lib/log/sticky");

const athletics = categoryByKey("athletics") as Category;
const reading = categoryByKey("reading") as Category;

const CHIPS: ChipSets = {
  exercise: [
    {
      value: "Bench Press",
      label: "Bench Press · 185 × 5",
      fills: { exercise: "Bench Press", "sets.0.weightLbs": "185", "sets.0.reps": "5" },
    },
  ],
};

const field = (name: string) => document.getElementById(`f-${name}`) as HTMLInputElement;

beforeEach(() => {
  vi.clearAllMocks();
  lastSubmitted = null;
  window.localStorage.clear();
  resetStickyCache();
  createLogEntry.mockResolvedValue({ ok: true, message: "Logged to Training." });
});

describe("chips", () => {
  it("fills the whole set from one tap, not just the field it belongs to", async () => {
    // The claim §1.6 is actually making: one tap replaces typing an exercise name and two
    // numbers. A chip that filled only `exercise` would look identical and save a third of it.
    render(<LogForm category={athletics} chips={CHIPS} />);

    await userEvent.click(screen.getByRole("button", { name: "Bench Press · 185 × 5" }));

    expect(field("exercise").value).toBe("Bench Press");
    expect(field("sets.0.weightLbs").value).toBe("185");
    expect(field("sets.0.reps").value).toBe("5");
  });

  it("puts what it filled into the submission", async () => {
    render(<LogForm category={athletics} chips={CHIPS} />);

    await userEvent.click(screen.getByRole("button", { name: "Bench Press · 185 × 5" }));
    await userEvent.click(screen.getByRole("button", { name: /log training/i }));

    await waitFor(() => expect(createLogEntry).toHaveBeenCalled());
    expect(lastSubmitted?.get("exercise")).toBe("Bench Press");
    expect(lastSubmitted?.get("sets.0.weightLbs")).toBe("185");
  });

  it("renders no chip row for a field with nothing recent", () => {
    render(<LogForm category={athletics} chips={{}} />);
    expect(screen.queryByRole("button", { name: /bench press/i })).toBeNull();
  });
});

describe("keypads", () => {
  it("asks for digits where only digits are valid, and a decimal point where it is not", () => {
    render(<LogForm category={athletics} />);

    expect(field("sets.0.reps").inputMode).toBe("numeric");
    expect(field("sets.0.weightLbs").inputMode).toBe("decimal");
    expect(field("bodyweightLbs").inputMode).toBe("decimal");
  });

  it("leaves the duration field on the full keyboard, because m:ss needs a colon", async () => {
    // `numeric` here would be the plausible-looking change that makes `2:17` untypeable on a
    // phone — and it is untypeable in a way nobody notices until they are standing at an erg.
    render(<LogForm category={athletics} />);
    await userEvent.selectOptions(document.getElementById("f-kind") as HTMLSelectElement, "erg");

    expect(field("sets.0.duration").inputMode).toBe("text");
    expect(field("sets.0.spm").inputMode).toBe("numeric");
  });

  it("lets the phone capitalise a name, which is what it is for", () => {
    render(<LogForm category={reading} />);
    expect(field("title").getAttribute("autocapitalize")).toBe("words");
  });
});

describe("sticky values", () => {
  it("opens empty the first time", () => {
    render(<LogForm category={athletics} />);
    expect((document.getElementById("f-kind") as HTMLSelectElement).value).toBe("");
  });

  it("remembers the context field after a save, and clears the measurements", async () => {
    render(<LogForm category={athletics} chips={CHIPS} />);

    await userEvent.selectOptions(document.getElementById("f-kind") as HTMLSelectElement, "erg");
    await userEvent.type(field("sets.0.distance"), "2000");
    await userEvent.click(screen.getByRole("button", { name: /log training/i }));

    await waitFor(() =>
      expect((document.getElementById("f-kind") as HTMLSelectElement).value).toBe("erg"),
    );
    // The safety property, end to end: the kind came back, the distance did not.
    expect(field("sets.0.distance").value).toBe("");
  });

  it("keeps nothing from a category that has no sticky fields", async () => {
    const day = categoryByKey("day") as Category;
    render(<LogForm category={day} />);

    await userEvent.click(screen.getByRole("button", { name: /log end of day/i }));
    await waitFor(() => expect(createLogEntry).toHaveBeenCalled());

    expect(window.localStorage.getItem("2m_sticky_day")).toBeNull();
  });
});

describe("sets", () => {
  it("adds a row that carries the row above it down", async () => {
    // The second set of an exercise is nearly always the first one again, and retyping 185
    // and 5 for every set is most of what made the old form not worth opening at a rack.
    render(<LogForm category={athletics} />);

    await userEvent.type(field("sets.0.weightLbs"), "185");
    await userEvent.type(field("sets.0.reps"), "5");
    await userEvent.click(screen.getByRole("button", { name: /add set/i }));

    await waitFor(() => expect(field("sets.1.weightLbs").value).toBe("185"));
    expect(field("sets.1.reps").value).toBe("5");
  });

  it("submits every set, which is the whole point of the change", async () => {
    render(<LogForm category={athletics} />);

    await userEvent.type(field("sets.0.weightLbs"), "185");
    await userEvent.click(screen.getByRole("button", { name: /add set/i }));
    await waitFor(() => expect(field("sets.1.weightLbs").value).toBe("185"));
    await userEvent.clear(field("sets.1.weightLbs"));
    await userEvent.type(field("sets.1.weightLbs"), "175");

    await userEvent.click(screen.getByRole("button", { name: /log training/i }));
    await waitFor(() => expect(createLogEntry).toHaveBeenCalled());

    expect(lastSubmitted?.get("sets.0.weightLbs")).toBe("185");
    expect(lastSubmitted?.get("sets.1.weightLbs")).toBe("175");
  });

  it("removes the row that was tapped, not the one that shares its position", async () => {
    // Keying rows by index means removing the middle one renumbers the last, React reuses the
    // removed row's DOM node, and the values on screen shuffle up by one — a silent
    // corruption of a record whose whole value is that its numbers can be trusted.
    render(<LogForm category={athletics} />);

    await userEvent.type(field("sets.0.weightLbs"), "135");
    await userEvent.click(screen.getByRole("button", { name: /add set/i }));
    await waitFor(() => expect(field("sets.1.weightLbs")).not.toBeNull());
    await userEvent.clear(field("sets.1.weightLbs"));
    await userEvent.type(field("sets.1.weightLbs"), "185");
    await userEvent.click(screen.getByRole("button", { name: /add set/i }));
    await waitFor(() => expect(field("sets.2.weightLbs")).not.toBeNull());
    await userEvent.clear(field("sets.2.weightLbs"));
    await userEvent.type(field("sets.2.weightLbs"), "225");

    await userEvent.click(screen.getByRole("button", { name: /remove set 2/i }));

    await waitFor(() => expect(field("sets.1.weightLbs")).toBeNull());
    expect(field("sets.0.weightLbs").value).toBe("135");
    expect(field("sets.2.weightLbs").value).toBe("225");
  });

  it("offers no remove button for the only row, so the form cannot be emptied", () => {
    render(<LogForm category={athletics} />);
    expect(screen.queryByRole("button", { name: /remove set/i })).toBeNull();
  });

  it("renders no rows for a category that has none", () => {
    render(<LogForm category={reading} />);
    expect(screen.queryByRole("button", { name: /add set/i })).toBeNull();
  });
});

describe("which fields a set has (D-162)", () => {
  /**
   * Reported on 2026-09-05: a bench press was offering a distance, a time and a stroke rate.
   * Not merely untidy — four things to read past on a phone between sets, which is most of the
   * fifteen seconds the whole category is built around.
   */
  const has = (name: string) => document.getElementById(`f-sets.0.${name}`) !== null;

  it("opens on weight and reps, because lifting is the common case", () => {
    render(<LogForm category={athletics} />);

    expect(has("weightLbs")).toBe(true);
    expect(has("reps")).toBe(true);
    expect(has("distance")).toBe(false);
    expect(has("duration")).toBe(false);
    expect(has("spm")).toBe(false);
  });

  it("swaps to distance, time and stroke rate for an erg piece", async () => {
    render(<LogForm category={athletics} />);
    await userEvent.selectOptions(document.getElementById("f-kind") as HTMLSelectElement, "erg");

    expect(has("distance")).toBe(true);
    expect(has("duration")).toBe(true);
    expect(has("spm")).toBe(true);
    expect(has("weightLbs")).toBe(false);
  });

  it("gives conditioning time, distance and reps, and no stroke rate", async () => {
    render(<LogForm category={athletics} />);
    await userEvent.selectOptions(
      document.getElementById("f-kind") as HTMLSelectElement,
      "conditioning",
    );

    expect(has("duration")).toBe(true);
    expect(has("distance")).toBe(true);
    expect(has("reps")).toBe(true);
    expect(has("spm")).toBe(false);
  });

  it("keeps the set type in every shape", async () => {
    render(<LogForm category={athletics} />);
    expect(has("setType")).toBe(true);

    await userEvent.selectOptions(document.getElementById("f-kind") as HTMLSelectElement, "water");
    expect(has("setType")).toBe(true);
  });

  it("offers every field on request, because a shape is a guess and not a rule", async () => {
    render(<LogForm category={athletics} />);
    expect(has("spm")).toBe(false);

    await userEvent.click(screen.getByRole("button", { name: /every field/i }));
    expect(has("spm")).toBe(true);

    await userEvent.click(screen.getByRole("button", { name: /fewer fields/i }));
    expect(has("spm")).toBe(false);
  });

  it("does not post a value from a field the shape dropped", async () => {
    // The bug a CSS-hidden field would have: a split typed into an erg piece and then switched
    // to a lift would arrive on the entry as a number nobody meant. This form's whole claim is
    // that its numbers can be trusted.
    render(<LogForm category={athletics} />);
    const kind = document.getElementById("f-kind") as HTMLSelectElement;

    await userEvent.selectOptions(kind, "erg");
    await userEvent.type(field("sets.0.duration"), "7:12");
    await userEvent.selectOptions(kind, "lift");
    await userEvent.type(field("sets.0.weightLbs"), "185");

    await userEvent.click(screen.getByRole("button", { name: /log training/i }));
    await waitFor(() => expect(createLogEntry).toHaveBeenCalled());

    expect(lastSubmitted?.get("sets.0.duration")).toBeNull();
    expect(lastSubmitted?.get("sets.0.weightLbs")).toBe("185");
  });

  it("offers no shape control for a category with no shapes", () => {
    render(<LogForm category={reading} />);
    expect(screen.queryByRole("button", { name: /every field/i })).toBeNull();
  });
});

describe("when the save fails", () => {
  it("puts back what was typed instead of leaving him to retype it", async () => {
    // React blanks a function-action form as soon as the action returns, success or not. Left
    // alone, a save rejected for a reason outside the form costs the entry as well.
    createLogEntry.mockResolvedValue({ ok: false, message: "DATABASE_URL is not set." });
    render(<LogForm category={athletics} />);

    await userEvent.type(field("exercise"), "Romanian Deadlift");
    await userEvent.click(screen.getByRole("button", { name: /log training/i }));

    expect(await screen.findByRole("status")).toHaveTextContent("DATABASE_URL");
    await waitFor(() => expect(field("exercise").value).toBe("Romanian Deadlift"));
  });
});
