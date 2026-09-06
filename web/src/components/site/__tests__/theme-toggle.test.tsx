// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const setTheme = vi.fn<(t: string) => void>();
let theme: string | undefined = "system";

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme, setTheme }),
}));

const { ThemeToggle } = await import("../theme-toggle");

beforeEach(() => {
  setTheme.mockReset();
  theme = "system";
});

/**
 * §4.2. Three states, not two — and "system" is one of them rather than the absence of a
 * choice. A two-way switch has to start somewhere and whichever way it starts is wrong for half
 * the day; the phone already knows whether it is night.
 */
describe("cycling", () => {
  it("goes system → light → dark → system", () => {
    for (const [from, to] of [
      ["system", "light"],
      ["light", "dark"],
      ["dark", "system"],
    ]) {
      theme = from;
      const { unmount } = render(<ThemeToggle />);
      fireEvent.click(screen.getByRole("button"));
      expect(setTheme, `${from} should go to ${to}`).toHaveBeenCalledWith(to);
      setTheme.mockReset();
      unmount();
    }
  });

  it("treats an unrecognised stored value as system rather than breaking", () => {
    // localStorage is a place other things write to, and a value from an older build must not
    // leave the control stuck.
    theme = "sepia";
    render(<ThemeToggle />);
    expect(screen.getByRole("button")).toHaveAccessibleName(/match the phone/i);
  });
});

describe("what it says", () => {
  it("names where a press will take you, not only where you are", () => {
    // "Dark" on a button that is currently dark is the ambiguity every theme toggle has.
    theme = "light";
    render(<ThemeToggle />);
    expect(screen.getByRole("button")).toHaveAccessibleName(/switch to dark/i);
  });
});
