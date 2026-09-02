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
const work = categoryByKey("work") as Category;

const CHIPS: ChipSets = {
  exercise: [
    {
      value: "Bench Press",
      label: "Bench Press · 185 × 5",
      fills: { exercise: "Bench Press", weightLbs: "185", reps: "5" },
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
    expect(field("weightLbs").value).toBe("185");
    expect(field("reps").value).toBe("5");
  });

  it("puts what it filled into the submission", async () => {
    render(<LogForm category={athletics} chips={CHIPS} />);

    await userEvent.click(screen.getByRole("button", { name: "Bench Press · 185 × 5" }));
    await userEvent.click(screen.getByRole("button", { name: /log training/i }));

    await waitFor(() => expect(createLogEntry).toHaveBeenCalled());
    expect(lastSubmitted?.get("exercise")).toBe("Bench Press");
    expect(lastSubmitted?.get("weightLbs")).toBe("185");
  });

  it("renders no chip row for a field with nothing recent", () => {
    render(<LogForm category={athletics} chips={{}} />);
    expect(screen.queryByRole("button", { name: /bench press/i })).toBeNull();
  });
});

describe("keypads", () => {
  it("asks for digits where only digits are valid, and a decimal point where it is not", () => {
    render(<LogForm category={athletics} />);

    expect(field("reps").inputMode).toBe("numeric");
    expect(field("spm").inputMode).toBe("numeric");
    expect(field("weightLbs").inputMode).toBe("decimal");
  });

  it("leaves the duration field on the full keyboard, because m:ss needs a colon", () => {
    // `numeric` here would be the plausible-looking change that makes `2:17` untypeable on a
    // phone — and it is untypeable in a way nobody notices until they are standing at an erg.
    render(<LogForm category={athletics} />);
    expect(field("duration").inputMode).toBe("text");
  });

  it("stops the phone capitalising a URL", () => {
    render(<LogForm category={work} />);

    expect(field("link").inputMode).toBe("url");
    expect(field("link").getAttribute("autocapitalize")).toBe("none");
    expect(field("company").getAttribute("autocapitalize")).toBe("words");
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
    await userEvent.type(field("weightLbs"), "185");
    await userEvent.click(screen.getByRole("button", { name: /log training/i }));

    await waitFor(() =>
      expect((document.getElementById("f-kind") as HTMLSelectElement).value).toBe("erg"),
    );
    // The safety property, end to end: the kind came back, the weight did not.
    expect(field("weightLbs").value).toBe("");
  });

  it("keeps nothing from a category that has no sticky fields", async () => {
    const day = categoryByKey("day") as Category;
    render(<LogForm category={day} />);

    await userEvent.click(screen.getByRole("button", { name: /log end of day/i }));
    await waitFor(() => expect(createLogEntry).toHaveBeenCalled());

    expect(window.localStorage.getItem("2m_sticky_day")).toBeNull();
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
