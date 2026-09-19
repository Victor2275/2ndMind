import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  Chip,
  CONTROL,
  ErrorSummary,
  Field,
  StickySave,
  useBlurValidation,
  useDirty,
} from "@/components/site/field";

/**
 * The form vocabulary (V4 §5.2, Q245–Q256).
 *
 * Each of these pins one answer that is easy to un-answer later by writing an ordinary-looking
 * form. They are properties, not pixels — "the label points at the control" survives a redesign
 * in a way "the label is 11px" does not.
 */

describe("Field", () => {
  it("puts the label above and points it at the control (Q246)", () => {
    render(
      <Field label="Exercise" htmlFor="ex">
        <input id="ex" name="exercise" />
      </Field>,
    );
    // `getByLabelText` only finds it if the association is real, which is the whole assertion.
    expect(screen.getByLabelText("Exercise")).toHaveAttribute("id", "ex");
  });

  it("marks optional and never required (Q248)", () => {
    const { rerender } = render(
      <Field label="Note" htmlFor="n" optional>
        <input id="n" />
      </Field>,
    );
    expect(screen.getByText("optional")).toBeInTheDocument();

    rerender(
      <Field label="Note" htmlFor="n">
        <input id="n" />
      </Field>,
    );
    // Every field in the quick log is optional by design, so marking required would mark
    // nothing. There is deliberately no affordance for it.
    expect(screen.queryByText(/required/i)).toBeNull();
  });

  it("announces an error rather than only colouring it (Q250)", () => {
    render(
      <Field label="Split" htmlFor="s" error="Use m:ss, like 2:17.">
        <input id="s" />
      </Field>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Use m:ss");
  });

  it("gives the passive shortcuts a name a phone can read (Q253)", () => {
    render(
      <Field label="Kind" htmlFor="k" marks={["sticky", "keypad"]}>
        <input id="k" />
      </Field>,
    );
    // `title` alone is invisible on a phone (D-191), which is the device this app is for.
    expect(screen.getByLabelText("Kept from last time")).toBeInTheDocument();
    expect(screen.getByLabelText("Opens a number pad")).toBeInTheDocument();
  });
});

describe("the control", () => {
  it("is 48px and does not carry its own width (Q245, D-219)", () => {
    expect(CONTROL).toContain("min-h-12");
    // Two width utilities on one element resolve by Tailwind's emit order, not by the order
    // they are written. Keeping the width out of the base is the fix that cannot come back.
    expect(CONTROL).not.toMatch(/\bw-(full|\d)/);
  });
});

describe("Chip", () => {
  it("is a token that fills when chosen, and says so (Q255, Q256)", async () => {
    const pick = vi.fn();
    const { rerender } = render(
      <Chip selected={false} onClick={pick}>
        185 × 5
      </Chip>,
    );
    const chip = screen.getByRole("button", { name: "185 × 5" });
    expect(chip).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(chip);
    expect(pick).toHaveBeenCalledOnce();

    rerender(
      <Chip selected onClick={pick}>
        185 × 5
      </Chip>,
    );
    // Filled, not ticked (Q256) — and `aria-pressed` is what carries it to anything that
    // cannot see the fill.
    expect(screen.getByRole("button", { name: "185 × 5" })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("ErrorSummary", () => {
  const error = (n: number) => ({ field: `f${n}`, message: "wrong" });

  it("is silent at two or fewer, which is what makes it safe to mount always (Q250)", () => {
    const { rerender, container } = render(<ErrorSummary errors={[error(1), error(2)]} />);
    expect(container).toBeEmptyDOMElement();

    rerender(<ErrorSummary errors={[error(1), error(2), error(3)]} />);
    expect(screen.getByRole("alert")).toHaveTextContent("3 fields need another look.");
  });
});

describe("useBlurValidation", () => {
  function Harness() {
    const { errors, handlers } = useBlurValidation({
      split: (value) => (/^\d+:\d\d$/.test(value) || value === "" ? null : "Use m:ss."),
    });
    return (
      <form onBlur={handlers.onBlur} onInput={handlers.onInput}>
        <input name="split" aria-label="Split" />
        {errors.split && <p role="alert">{errors.split}</p>}
      </form>
    );
  }

  it("validates on blur, not while typing (Q249)", async () => {
    render(<Harness />);
    const input = screen.getByLabelText("Split");

    // `2:1` on the way to `2:17` is not an error yet. Live validation is what makes an
    // optional field feel like an interrogation.
    await userEvent.type(input, "2:1");
    expect(screen.queryByRole("alert")).toBeNull();

    await userEvent.tab();
    expect(screen.getByRole("alert")).toHaveTextContent("Use m:ss.");
  });

  it("clears the message the moment the field is touched again", async () => {
    render(<Harness />);
    const input = screen.getByLabelText("Split");

    await userEvent.type(input, "nope");
    await userEvent.tab();
    expect(screen.getByRole("alert")).toBeInTheDocument();

    // The half that is easy to leave out, and the half that makes blur bearable: a message
    // that outlives the value it was about contradicts what is now on screen.
    await userEvent.type(input, "2");
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("useDirty and StickySave", () => {
  function Harness() {
    const form = useRef<HTMLFormElement>(null);
    const { dirty, clear } = useDirty(form);
    return (
      <form ref={form}>
        <input name="a" aria-label="A" />
        <button type="button" onClick={clear}>
          reset
        </button>
        <StickySave dirty={dirty}>
          <button type="submit">Save</button>
        </StickySave>
      </form>
    );
  }

  it("appears only once there is something to save (Q251, Q252)", async () => {
    render(<Harness />);
    // A bar that is always there costs vertical space on every screen to offer a button that
    // does nothing. Appearing when there is something to save means it is never in the way.
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();

    await userEvent.type(screen.getByLabelText("A"), "x");
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(screen.getByText("Not saved yet")).toBeInTheDocument();
  });

  it("goes away when the form is cleared, which a reset does not announce", async () => {
    render(<Harness />);
    await userEvent.type(screen.getByLabelText("A"), "x");

    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: "reset" }));
    });
    // React resets a `<form action={fn}>` itself and fires no event `useDirty` could hear,
    // which is why `clear` is exposed rather than watched for.
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
  });
});
