// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { VoiceEntry } from "@/components/site/voice-entry";

/**
 * §4.3. The property that matters is not that it hears you — it is that **it cannot save**.
 *
 * "Always confirmed before saving" is the plan's requirement, and here it is a property of the
 * wiring rather than a rule someone keeps: this component's only output is a callback that
 * fills fields. There is no path from a microphone to a row.
 */

let recogniser: {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: unknown) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

const said = (transcript: string, isFinal = true) => ({
  results: Object.assign([Object.assign([{ transcript }], { isFinal })], { length: 1 }),
});

beforeEach(() => {
  recogniser = {
    lang: "",
    continuous: true,
    interimResults: false,
    start: vi.fn(),
    stop: vi.fn(),
    onresult: null,
    onerror: null,
    onend: null,
  };
  // A plain function, not an arrow: the component calls this with `new`, and an arrow function
  // is not a constructor. The first version of this test used one and every case failed with
  // the recogniser never being reached.
  vi.stubGlobal("webkitSpeechRecognition", function Recogniser() {
    return recogniser;
  });
  vi.stubGlobal("navigator", { onLine: true, userAgent: "test" });
  vi.stubGlobal("fetch", vi.fn());
});

describe("filling, never saving", () => {
  it("hands a parsed entry to its caller and does nothing else", async () => {
    const onParsed = vi.fn();
    render(<VoiceEntry onParsed={onParsed} />);

    fireEvent.click(screen.getByRole("button"));
    recogniser.onresult?.(said("bench press 185 for 5"));

    await waitFor(() => expect(onParsed).toHaveBeenCalledTimes(1));
    expect(onParsed.mock.calls[0][0]).toMatchObject({
      exercise: "Bench Press",
      sets: [{ weightLbs: 185, reps: 5 }],
    });
    // The grammar read it, so the model was never asked.
    expect(fetch).not.toHaveBeenCalled();
  });

  it("shows what it heard, so a wrong field is traceable to a misheard word", async () => {
    render(<VoiceEntry onParsed={vi.fn()} />);
    fireEvent.click(screen.getByRole("button"));
    recogniser.onresult?.(said("squat 225 for 3"));

    expect(await screen.findByRole("status")).toHaveTextContent("squat 225 for 3");
  });

  it("asks the model only when the grammar gives up", async () => {
    const onParsed = vi.fn();
    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({
        entry: { kind: "lift", exercise: "Squat", rpe: null, sets: [{ reps: 1 }] },
      }),
    } as Response);

    render(<VoiceEntry onParsed={onParsed} />);
    fireEvent.click(screen.getByRole("button"));
    recogniser.onresult?.(said("worked up to a heavy single on squat"));

    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/voice/parse", expect.anything()));
    await waitFor(() => expect(onParsed).toHaveBeenCalledTimes(1));
  });

  it("says so rather than filling anything when neither can read it", async () => {
    const onParsed = vi.fn();
    vi.mocked(fetch).mockResolvedValue({ json: async () => ({ entry: null }) } as Response);

    render(<VoiceEntry onParsed={onParsed} />);
    fireEvent.click(screen.getByRole("button"));
    recogniser.onresult?.(said("some thoughts about nothing in particular"));

    expect(await screen.findByRole("alert")).toHaveTextContent(/could not read that/i);
    expect(onParsed).not.toHaveBeenCalled();
  });
});

describe("what it says about itself", () => {
  it("refuses with an explicit reason when there is no signal", () => {
    // §4.3 asked for an explicit offline state. Recognition needs the network, and a button
    // that fails silently teaches you the feature is broken rather than unavailable.
    vi.stubGlobal("navigator", { onLine: false, userAgent: "test" });
    render(<VoiceEntry onParsed={vi.fn()} />);

    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleName(/needs a signal/i);
  });

  it("says where the audio goes, on the control itself", () => {
    // Chrome streams it to Google to transcribe. That is a real thing to know, not a detail.
    render(<VoiceEntry onParsed={vi.fn()} />);
    expect(screen.getByRole("button")).toHaveAccessibleName(/sends the audio to google/i);
  });

  it("renders nothing at all where the browser cannot do this", () => {
    // Firefox. A dead control is worse than no control.
    vi.stubGlobal("webkitSpeechRecognition", undefined);
    const { container } = render(<VoiceEntry onParsed={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});
