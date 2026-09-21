// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { categoryByKey, type Category } from "@/lib/log/categories";
import type { ChipSets } from "@/lib/log/chips";
import type { ActionState } from "@/lib/sprint-goals";

/**
 * Focus order on the log form — V4 §7.4 (Q442, Q447), D-314.
 *
 * Q442 asks for focus order to be tested "on the log form at minimum", and the log form is the
 * right minimum for a reason worth stating: it is the densest keyboard surface in the app —
 * chips, a variable number of set rows, a sticky save bar — and it is the one screen where all
 * three of the things that break tab order are present at once.
 *
 * Those three are what these tests check, rather than pinning an exact sequence of elements:
 *
 *   - **No positive `tabindex`.** A single `tabindex="1"` anywhere moves that element to the
 *     front of the *document's* tab sequence, ahead of everything with a 0, and the symptom is
 *     that focus jumps to the far side of the page. This is the failure that is invisible in
 *     every screenshot and in every other test in this repo.
 *   - **Tab order matches DOM order**, which on this form is visual order. A control reachable
 *     but out of sequence is worse than one that is not reachable, because it moves focus
 *     somewhere the eye is not.
 *   - **The save button is reachable** by tabbing forward from the first field, with no trap in
 *     between. A form you can fill and not submit from the keyboard is not keyboard-usable, and
 *     §5.2's sticky bar is exactly the kind of thing that ends up outside the form's flow.
 *
 * Pinning the literal element list was considered and rejected: the fields differ per category
 * and the set rows are dynamic, so that test would fail on every content change and say nothing
 * about focus. What is asserted is the *property*, which survives the form being edited.
 */

const createLogEntry = vi.fn<(prev: ActionState | null, data: FormData) => Promise<ActionState>>();

vi.mock("@/app/private/log/actions", () => ({
  createLogEntry: (prev: ActionState | null, data: FormData) => createLogEntry(prev, data),
}));

vi.mock("@/components/site/dictate-button", () => ({ DictateButton: () => null }));

const { LogForm } = await import("../log-form");
const { resetStickyCache } = await import("@/lib/log/sticky");

const athletics = categoryByKey("athletics") as Category;

const CHIPS: ChipSets = {
  exercise: [
    {
      value: "Bench Press",
      label: "Bench Press · 185 × 5",
      fills: { exercise: "Bench Press", "sets.0.weightLbs": "185", "sets.0.reps": "5" },
    },
  ],
};

/** Everything the browser would stop at, in document order. */
function tabbables(root: HTMLElement): HTMLElement[] {
  return [
    ...root.querySelectorAll<HTMLElement>(
      'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
    ),
  ].filter((el) => {
    if (el.hasAttribute("disabled")) return false;
    if (el.getAttribute("aria-hidden") === "true") return false;
    // jsdom has no layout, so `hidden` and `display:none` are the only invisibility it can see.
    if (el.hidden) return false;
    // `<input type="hidden">` matches the selector and is not tabbable. The form carries one
    // for `category`, which is enough to put every later assertion off by one.
    if (el instanceof HTMLInputElement && el.type === "hidden") return false;
    return true;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  resetStickyCache();
  createLogEntry.mockResolvedValue({ ok: true, message: "Logged to Training." });
});

describe("the log form's focus order", () => {
  it("has no positive tabindex, so the document's own order is the tab order", () => {
    const { container } = render(<LogForm category={athletics} chips={CHIPS} />);

    const positive = [...container.querySelectorAll("[tabindex]")].filter(
      (el) => Number(el.getAttribute("tabindex")) > 0,
    );

    // The message matters here: a bare count tells whoever broke it nothing about where.
    expect(
      positive.map((el) => `${el.tagName.toLowerCase()}[tabindex=${el.getAttribute("tabindex")}]`),
    ).toEqual([]);
  });

  it("moves through the controls in DOM order", async () => {
    const { container } = render(<LogForm category={athletics} chips={CHIPS} />);
    const expected = tabbables(container);
    expect(expected.length).toBeGreaterThan(3);

    const user = userEvent.setup();
    const seen: HTMLElement[] = [];
    for (let i = 0; i < expected.length; i += 1) {
      await user.tab();
      const active = document.activeElement as HTMLElement;
      if (!container.contains(active)) break;
      seen.push(active);
    }

    // Compare the prefix rather than the whole list: what is being asserted is that the order
    // is the document's, not that nothing else on the page can ever take focus.
    expect(seen).toEqual(expected.slice(0, seen.length));
    expect(seen.length).toBeGreaterThan(3);
  });

  it("reaches the save button by tabbing forward, with nothing trapping focus first", async () => {
    const { container } = render(<LogForm category={athletics} chips={CHIPS} />);

    const save = screen.getByRole("button", { name: /log training/i });
    const user = userEvent.setup();

    let reached = false;
    // One pass over every tabbable on the form, and no further: a trap shows up as the loop
    // ending without the button, not as a hang.
    for (let i = 0; i < tabbables(container).length + 2; i += 1) {
      await user.tab();
      if (document.activeElement === save) {
        reached = true;
        break;
      }
    }

    expect(reached).toBe(true);
  });

  it("keeps a chip with the fields it fills rather than off at the end of the form", () => {
    const { container } = render(<LogForm category={athletics} chips={CHIPS} />);

    const order = tabbables(container);
    const at = (el: Element | null) => order.indexOf(el as HTMLElement);

    const chip = screen.getByRole("button", { name: "Bench Press · 185 × 5" });
    const exercise = document.getElementById("f-exercise");
    const weight = document.getElementById("f-sets.0.weightLbs");

    // This chip fills `exercise` and the first set's weight and reps, and it sits between
    // them: immediately after the input it is named for, and before the set row it also
    // fills. That is the property worth holding — a shortcut belongs beside the fields it is
    // a shortcut *for*. A chip row collected at the top or bottom of the form would still be
    // reachable and would still pass every other test here, while making the keyboard path
    // jump the length of the form and back.
    expect(at(chip)).toBe(at(exercise) + 1);
    expect(at(chip)).toBeLessThan(at(weight));
  });
});
