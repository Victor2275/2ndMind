"use client";

import { MicIcon, SquareIcon } from "lucide-react";
import { useRef, useState, useSyncExternalStore } from "react";

import { reportError } from "@/lib/errors/client";
import { parseSpoken, type SpokenEntry } from "@/lib/voice/parse";

/**
 * Saying a training entry instead of typing it (V3 §4.3, D-186).
 *
 * **It fills the form. It never saves.** The plan's requirement is "always confirmed before
 * saving", and this is that requirement made structural rather than remembered: this component
 * has no way to write. It sets field values, and the same button you would have pressed anyway
 * is what turns them into a row. A misheard number therefore costs a correction, never a
 * wrong record — which is the only footing on which a transcript belongs near a training log.
 *
 * ## What it uses, and what that means
 *
 * The browser's own `SpeechRecognition`. Free, no key, no cost per entry — and, in Chrome,
 * **it streams the audio to Google to transcribe**, the same way a voice search does. Nothing
 * is stored by this app, and nothing about the vault is sent; what leaves the device is the
 * sentence you spoke into the microphone. That is a real thing to know rather than a detail,
 * so the control says it in its title.
 *
 * ## Offline
 *
 * Recognition needs the network, so with no signal this says so instead of failing silently.
 * §4.3 called for an explicit offline state and this is it: the button is disabled and labelled,
 * and the keyboard's own microphone still works on every field underneath.
 */

type Status = "idle" | "listening" | "thinking" | "unsupported";

/**
 * The slice of the Web Speech API this uses.
 *
 * Declared here rather than pulled in as `@types/dom-speech-recognition`: it is six members, the
 * API has not moved in years, and a dependency for six members is a dependency to keep updating.
 * Narrow on purpose — anything not written down here is not relied on.
 */
type Recogniser = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: RecogniserEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

type RecogniserEvent = {
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
};

/** The vendor-prefixed constructor Chrome still ships. */
function recognitionClass(): (new () => Recogniser) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => Recogniser;
    webkitSpeechRecognition?: new () => Recogniser;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const ON_CLIENT = () => true;
const ON_SERVER = () => false;
const NEVER_CHANGES = () => () => {};

export function VoiceEntry({ onParsed }: { onParsed: (entry: SpokenEntry) => void }) {
  const ready = useSyncExternalStore(NEVER_CHANGES, ON_CLIENT, ON_SERVER);
  const [status, setStatus] = useState<Status>("idle");
  const [heard, setHeard] = useState("");
  const [failed, setFailed] = useState<string | null>(null);
  const active = useRef<Recogniser | null>(null);

  if (!ready) return null;

  const Recognition = recognitionClass();
  // Nothing to offer rather than a dead button. Firefox has no support at all, and a control
  // that does nothing is worse than one that is not there.
  if (!Recognition) return null;

  const offline = typeof navigator !== "undefined" && navigator.onLine === false;

  async function handle(transcript: string) {
    setHeard(transcript);

    // The grammar first: instant, free, offline, and wrong the same way every time.
    const local = parseSpoken(transcript);
    if (local) {
      setStatus("idle");
      onParsed(local);
      return;
    }

    // Only then the model, and only for a phrasing the rules have never seen.
    setStatus("thinking");
    try {
      const response = await fetch("/api/voice/parse", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ transcript }),
      });
      const body = (await response.json()) as { entry?: SpokenEntry | null };
      if (body.entry) onParsed(body.entry);
      else setFailed("Could not read that. The fields below still take typing.");
    } catch (error) {
      void reportError(error);
      setFailed("Could not read that. The fields below still take typing.");
    } finally {
      setStatus("idle");
    }
  }

  function start() {
    setFailed(null);
    setHeard("");

    const recognition = new Recognition!();
    recognition.lang = "en-US";
    // One sentence, not a stream. The entry is a single utterance and continuous mode leaves
    // the microphone open on a phone in a gym.
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      const said = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? "")
        .join(" ")
        .trim();
      setHeard(said);
      if (event.results[event.results.length - 1]?.isFinal) void handle(said);
    };
    recognition.onerror = () => {
      setStatus("idle");
      setFailed("The microphone did not catch that.");
    };
    recognition.onend = () => {
      active.current = null;
      setStatus((current) => (current === "listening" ? "idle" : current));
    };

    active.current = recognition;
    setStatus("listening");
    recognition.start();
  }

  function stop() {
    active.current?.stop();
    active.current = null;
    setStatus("idle");
  }

  const listening = status === "listening";
  const label = offline
    ? "Dictation needs a signal"
    : listening
      ? "Stop listening"
      : "Say a training entry. Chrome sends the audio to Google to transcribe it.";

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={listening ? stop : start}
        disabled={offline || status === "thinking"}
        aria-label={label}
        title={label}
        className={`flex min-h-10 items-center gap-2 rounded-md border px-3 text-sm transition-colors disabled:opacity-60 ${
          listening
            ? "border-destructive/60 text-destructive"
            : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
        }`}
      >
        {listening ? (
          <SquareIcon className="size-4" aria-hidden />
        ) : (
          <MicIcon className="size-4" aria-hidden />
        )}
        <span className="font-mono text-xs">
          {offline
            ? "Needs signal"
            : status === "thinking"
              ? "Reading…"
              : listening
                ? "Listening…"
                : "Say it"}
        </span>
      </button>

      {/* What it heard, always — so a wrong field is traceable to a misheard word rather than
          looking like the parser inventing things. */}
      {heard !== "" && (
        <p role="status" aria-live="polite" className="mt-2 text-sm text-muted-foreground">
          “{heard}”
        </p>
      )}
      {failed && (
        <p role="alert" className="mt-1 font-mono text-xs text-destructive">
          {failed}
        </p>
      )}
    </div>
  );
}
