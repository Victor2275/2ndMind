// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { THEMES } from "@/lib/theme/registry";

const setTheme = vi.fn<(t: string) => void>();
let theme: string | undefined = "system";
let resolvedTheme: string | undefined = "dark";

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme, setTheme, resolvedTheme }),
}));

const { ThemePicker } = await import("../theme-picker");

beforeEach(() => {
  setTheme.mockReset();
  theme = "system";
  resolvedTheme = "dark";
});

/**
 * The picker is two controls, not a six-item list (V4 §4.4).
 *
 * "Match the phone" is a different kind of choice from "use Carbon", and the reason it is a
 * switch above the list rather than a row inside it is that the app changing colour at sunset
 * has to be explainable from the screen. These tests pin that behaviour, because it is the part
 * that is easy to simplify away later.
 */

describe("following the phone", () => {
  it("marks the theme the OS resolved to, rather than nothing", () => {
    // The failure this prevents: while following the phone, `theme` is the string "system",
    // which matches no entry — so a naive `theme === entry.name` check leaves every row
    // unselected and the screen cannot answer "which one am I looking at".
    theme = "system";
    resolvedTheme = "light";
    render(<ThemePicker />);

    const teal = screen.getByRole("button", { name: /Teal/ });
    expect(teal).toHaveAttribute("aria-current", "true");
  });

  it("says out loud which theme the phone asked for", () => {
    theme = "system";
    resolvedTheme = "light";
    render(<ThemePicker />);
    expect(screen.getByText(/The phone is asking for/)).toBeInTheDocument();
  });

  it("keeps the list visible while following, so the answer stays on screen", () => {
    theme = "system";
    render(<ThemePicker />);
    for (const entry of THEMES) {
      expect(screen.getByRole("button", { name: new RegExp(entry.label) })).toBeInTheDocument();
    }
  });
});

describe("the switch", () => {
  it("turning it off keeps the theme that was showing", () => {
    // Not "dark" blindly: turning the switch off while the phone had resolved light should
    // leave you on light. Snapping to the default here would be a visible flash and a change
    // nobody asked for.
    theme = "system";
    resolvedTheme = "light";
    render(<ThemePicker />);

    fireEvent.click(screen.getByRole("checkbox"));
    expect(setTheme).toHaveBeenCalledWith("light");
  });

  it("turning it on hands the choice back to the phone", () => {
    theme = "carbon";
    resolvedTheme = "carbon";
    render(<ThemePicker />);

    fireEvent.click(screen.getByRole("checkbox"));
    expect(setTheme).toHaveBeenCalledWith("system");
  });

  it("is checked exactly when the theme is system", () => {
    theme = "carbon";
    const { unmount } = render(<ThemePicker />);
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    unmount();

    theme = "system";
    render(<ThemePicker />);
    expect(screen.getByRole("checkbox")).toBeChecked();
  });
});

describe("picking one", () => {
  it("sets the theme by its next-themes name, not its css id", () => {
    // The distinction that breaks silently: `setTheme("light-teal")` does nothing, because
    // next-themes stores names and maps them to ids. It would leave the UI unchanged with no
    // error anywhere.
    theme = "dark";
    render(<ThemePicker />);

    fireEvent.click(screen.getByRole("button", { name: /Teal/ }));
    expect(setTheme).toHaveBeenCalledWith("light");
  });

  it("offers every selectable theme", () => {
    render(<ThemePicker />);
    const selectable = THEMES.filter((t) => t.selectable);
    for (const entry of selectable) {
      expect(screen.getByRole("button", { name: new RegExp(entry.label) })).toBeInTheDocument();
    }
  });
});
