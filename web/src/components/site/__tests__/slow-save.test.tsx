// @vitest-environment jsdom
import { cleanup, fireEvent, render, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useFormStatus } from "react-dom";

import { SLOW_SAVE_MS, SlowSaveNotice } from "@/components/site/slow-save";

/**
 * The slow-save notice (V4 Phase N5).
 *
 * The failure it exists for is not a crash — it is silence. A Server Action is a
 * framework-owned POST with no `AbortSignal` to hand it, so unlike everywhere else in Phase N
 * the app cannot time this out; all it can observe is that `pending` is still true. A button
 * that has said "Saving…" for fifteen seconds is indistinguishable from an app that has died,
 * and the reasonable response to an app that has died is to close it — which is the one thing
 * that loses the entry.
 *
 * **The most important test in this file is the last one.** The obvious implementation — a
 * `useState` flipped by a timer — silently breaks the form it is trying to describe, and the
 * damage is invisible unless something checks (D-207).
 *
 * Real timers with the threshold passed in, because faking the clock around a running form
 * action makes its own pending state come apart. A 40ms threshold exercises the same code in a
 * fiftieth of the time.
 */

const AFTER = 40;

/**
 * Every stalled submission this file starts, so it can be released afterwards.
 *
 * A submission that is simply never resolved is the obvious way to stage a stall, and it
 * poisons the tests that follow: React keeps tracking an action whose promise never settles,
 * and the *next* form's `pending` then does not clear when its own action finishes. That showed
 * up as two later cases failing only when the file was run in order — the component was correct
 * and the fixture was not.
 */
const stalled: Array<() => void> = [];

function stall(): Promise<void> {
  return new Promise<void>((resolve) => stalled.push(resolve));
}

/** A form whose submission does not settle until the test is over. */
function Stalling({ children }: { children?: React.ReactNode }) {
  return (
    <form action={stall}>
      <SlowSaveNotice after={AFTER} />
      {children}
      <button type="submit">Save</button>
    </form>
  );
}

/**
 * Every query is scoped to the element this test rendered, never to `document.body`.
 *
 * `vitest.setup.ts` registers only jest-dom's matchers, so nothing here should assume a global
 * DOM is empty at the start of a test — and a stalled form left mounted by a neighbouring case
 * is exactly the kind of thing a `screen` query silently picks up instead.
 */
function mount(ui: React.ReactElement) {
  const view = render(ui);
  const scope = within(view.container);
  const notice = () => scope.getByText(/still trying/i);
  return {
    notice,
    showing: () => !notice().hidden,
    submit: () => fireEvent.click(scope.getByRole("button", { name: "Save" })),
  };
}

afterEach(() => {
  cleanup();
  for (const release of stalled.splice(0)) release();
});

describe("while a save is running", () => {
  it("says nothing at first", () => {
    const { showing, submit } = mount(<Stalling />);
    submit();

    expect(showing()).toBe(false);
  });

  it("speaks up once the save has been running too long", async () => {
    const { showing, submit } = mount(<Stalling />);
    submit();

    await waitFor(() => expect(showing()).toBe(true));
  });

  it("does not claim the entry is safe on this device, because it is not", async () => {
    // The plan's original wording promised exactly that. It is true on the cached shell and
    // false in the live app, and the live app is where someone would act on it — by closing the
    // app on an entry that has not landed anywhere (D-206).
    const { notice, showing, submit } = mount(<Stalling />);
    submit();

    await waitFor(() => expect(showing()).toBe(true));
    expect(notice().textContent).not.toMatch(/saved|safe|device|phone/i);
  });

  it("is announced without interrupting, since nothing has gone wrong yet", () => {
    const { notice } = mount(<Stalling />);
    expect(notice().getAttribute("role")).toBe("status");
  });
});

describe("on an ordinary save", () => {
  it("never appears", async () => {
    // The half that keeps this from becoming wallpaper. If it fired on every save it would be
    // ignored on the one that mattered.
    const { showing, submit } = mount(
      <form action={async () => {}}>
        <SlowSaveNotice after={AFTER} />
        <button type="submit">Save</button>
      </form>,
    );
    submit();

    await new Promise((resolve) => setTimeout(resolve, AFTER * 4));
    expect(showing()).toBe(false);
  });

  it("hides itself again when a slow save eventually lands", async () => {
    let finish: () => void = () => {};
    const { showing, submit } = mount(
      <form
        action={() =>
          new Promise<void>((resolve) => {
            finish = resolve;
          })
        }
      >
        <SlowSaveNotice after={AFTER} />
        <button type="submit">Save</button>
      </form>,
    );

    submit();
    await waitFor(() => expect(showing()).toBe(true));

    finish();

    await waitFor(() => expect(showing()).toBe(false));
  });
});

describe("it does not disturb the form it is describing", () => {
  function PendingProbe() {
    const { pending } = useFormStatus();
    return <span data-testid="pending">{String(pending)}</span>;
  }

  const isPending = () => document.querySelector("[data-testid=pending]")?.textContent === "true";

  it("leaves the save button disabled while the request is still in flight", async () => {
    /**
     * The regression this file exists to prevent, and it is not obvious.
     *
     * On React 19.2.8 a `setState` in **any** component inside a `<form>` ends
     * `useFormStatus().pending` for every component reading it, while the action's promise is
     * still unresolved. The first version of this notice used `useState`, so at six seconds it
     * would have flashed on and then re-enabled a `disabled={pending}` save button in the
     * middle of a POST — and the obvious thing to do with a re-enabled Save button is press it
     * again. It would have traded a silent save for a duplicated one.
     *
     * So: the notice must become visible, and `pending` must still be true afterwards.
     */
    const { showing, submit } = mount(
      <Stalling>
        <PendingProbe />
      </Stalling>,
    );
    submit();

    await waitFor(() => expect(isPending()).toBe(true));
    await waitFor(() => expect(showing()).toBe(true));

    expect(isPending()).toBe(true);
  });
});

describe("the threshold", () => {
  it("is six seconds in the app, whatever the tests pass", () => {
    // The parameter exists so these tests can run in milliseconds. The shipped value is the one
    // that has to be right: shorter and it fires on an ordinary slow connection and trains you
    // to ignore it; longer and it arrives after you have already decided the app is broken.
    expect(SLOW_SAVE_MS).toBe(6_000);
  });
});
