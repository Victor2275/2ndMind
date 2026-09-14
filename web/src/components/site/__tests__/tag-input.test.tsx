// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { MAX_TAGS } from "@/lib/log/tags";
import { TagInput } from "../tag-input";

/**
 * Free tags on a form (V4 Phase 3, §3.2).
 *
 * Uncontrolled from the form's point of view: nothing here posts anywhere, so these tests read
 * back what the component would submit — one hidden `<input name="tags">` per committed tag —
 * rather than mocking a server action the way `QuickCapture`'s tests do.
 *
 * `userEvent.setup({ delay: null })` throughout: this file types full words followed by Enter
 * or comma more densely than most tests here, and the default per-keystroke real-timer delay
 * made it flaky under load — a full `npm test` run (many parallel workers) occasionally
 * delivered a scrambled string ("go1n9e" instead of "one") that a run of this file alone never
 * reproduced. `delay: null` makes each keystroke synchronous inside `act()` instead of
 * scheduling it on a real timer, which is the documented fix for exactly this failure mode.
 */

function hiddenTagValues(container: HTMLElement, name = "tags"): string[] {
  return [
    ...container.querySelectorAll<HTMLInputElement>(`input[type="hidden"][name="${name}"]`),
  ].map((el) => el.value);
}

describe("committing a tag", () => {
  it("commits on Enter and clears the draft", async () => {
    const user = userEvent.setup({ delay: null });
    const { container } = render(<TagInput />);

    const input = screen.getByRole("textbox", { name: "Tags" });
    await user.type(input, "recipe{Enter}");

    expect(screen.getByText("recipe")).toBeInTheDocument();
    expect(hiddenTagValues(container)).toEqual(["recipe"]);
    expect(input).toHaveValue("");
  });

  it("commits on a comma, without the comma landing in the tag", async () => {
    const user = userEvent.setup({ delay: null });
    const { container } = render(<TagInput />);

    await user.type(screen.getByRole("textbox", { name: "Tags" }), "recipe,");

    expect(hiddenTagValues(container)).toEqual(["recipe"]);
  });

  it("normalises on the way in — trimmed and lowercased", async () => {
    const user = userEvent.setup({ delay: null });
    const { container } = render(<TagInput />);

    await user.type(screen.getByRole("textbox", { name: "Tags" }), "  Reading Group  {Enter}");

    expect(hiddenTagValues(container)).toEqual(["reading group"]);
  });

  it("does not add the same tag twice", async () => {
    const user = userEvent.setup({ delay: null });
    const { container } = render(<TagInput />);
    const input = screen.getByRole("textbox", { name: "Tags" });

    await user.type(input, "recipe{Enter}");
    await user.type(input, "Recipe{Enter}");

    expect(hiddenTagValues(container)).toEqual(["recipe"]);
  });

  it("commits whatever is left in the draft when the field loses focus", async () => {
    const user = userEvent.setup({ delay: null });
    const { container } = render(<TagInput />);

    await user.type(screen.getByRole("textbox", { name: "Tags" }), "recipe");
    await user.tab();

    expect(hiddenTagValues(container)).toEqual(["recipe"]);
  });

  it("ignores an attempt to commit an empty draft", async () => {
    const user = userEvent.setup({ delay: null });
    const { container } = render(<TagInput />);

    await user.type(screen.getByRole("textbox", { name: "Tags" }), "{Enter}");
    expect(hiddenTagValues(container)).toEqual([]);
  });

  it("refuses a 21st tag", async () => {
    const user = userEvent.setup({ delay: null });
    const { container } = render(<TagInput />);
    const input = screen.getByRole("textbox", { name: "Tags" });

    for (let i = 0; i < MAX_TAGS + 1; i += 1) {
      await user.type(input, `tag${i}{Enter}`);
    }

    expect(hiddenTagValues(container)).toHaveLength(MAX_TAGS);
    expect(screen.getByText(new RegExp(`${MAX_TAGS} is the most`))).toBeInTheDocument();
  });
});

describe("removing a tag", () => {
  it("removes it on click", async () => {
    const user = userEvent.setup({ delay: null });
    const { container } = render(<TagInput />);

    await user.type(screen.getByRole("textbox", { name: "Tags" }), "recipe{Enter}");
    await user.click(screen.getByRole("button", { name: "Remove tag recipe" }));

    expect(hiddenTagValues(container)).toEqual([]);
    expect(screen.queryByText("recipe")).toBeNull();
  });

  it("pops the last tag on Backspace against an empty draft", async () => {
    const user = userEvent.setup({ delay: null });
    const { container } = render(<TagInput />);
    const input = screen.getByRole("textbox", { name: "Tags" });

    await user.type(input, "one{Enter}");
    await user.type(input, "two{Enter}");
    await user.type(input, "{Backspace}");

    expect(hiddenTagValues(container)).toEqual(["one"]);
  });

  it("does not pop a tag while the draft still has text in it", async () => {
    const user = userEvent.setup({ delay: null });
    const { container } = render(<TagInput />);
    const input = screen.getByRole("textbox", { name: "Tags" });

    await user.type(input, "one{Enter}");
    await user.type(input, "abc");
    await user.keyboard("{Backspace}");

    expect(hiddenTagValues(container)).toEqual(["one"]);
    expect(input).toHaveValue("ab");
  });
});

describe("initial tags and suggestions", () => {
  it("renders tags the entry already carries", () => {
    const { container } = render(<TagInput initialTags={["recipe", "reading"]} />);
    expect(hiddenTagValues(container)).toEqual(["recipe", "reading"]);
    expect(screen.getByText("recipe")).toBeInTheDocument();
    expect(screen.getByText("reading")).toBeInTheDocument();
  });

  it("offers suggestions that are not already committed", () => {
    const { container } = render(
      <TagInput initialTags={["recipe"]} suggestions={["recipe", "reading", "athletics"]} />,
    );

    // A native <option value="…"> with no text child has no accessible *name* for
    // getByRole to match on, even though it renders and works in a real browser — so this
    // reads the datalist's option values directly rather than through the a11y tree.
    const values = [...container.querySelectorAll("datalist option")].map((o) =>
      o.getAttribute("value"),
    );
    expect(values).not.toContain("recipe");
    expect(values).toEqual(["reading", "athletics"]);
  });
});

describe("form field name", () => {
  it("uses a custom name when given, so two tag inputs on one page do not collide", async () => {
    const user = userEvent.setup({ delay: null });
    const { container } = render(<TagInput name="fileTags" />);

    await user.type(screen.getByRole("textbox", { name: "Tags" }), "recipe{Enter}");

    expect(hiddenTagValues(container, "fileTags")).toEqual(["recipe"]);
    expect(hiddenTagValues(container, "tags")).toEqual([]);
  });
});
