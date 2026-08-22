"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

/**
 * Speech-to-text for a note field, via the Web Speech API.
 *
 * Worth building because Victor logs from Android/Chrome, where the API exists (D-038). It
 * does *not* exist in Safari on iOS — so this feature-detects and renders nothing at all
 * rather than showing a button that does nothing. A dead control is worse than no control.
 *
 * The typed surface is hand-rolled because `SpeechRecognition` is not in the DOM lib: it is
 * still prefixed in Chrome and absent from the standard typings.
 */

type SpeechResult = { transcript: string };
type SpeechAlternatives = { 0: SpeechResult; isFinal: boolean; length: number };
type SpeechEvent = { resultIndex: number; results: { length: number } & SpeechAlternatives[] };

type Recognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type RecognitionCtor = new () => Recognition;

function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Capability detection is external state, so it is read rather than stored. The server
 *  snapshot is `false`, which keeps the first client render identical to the markup and
 *  avoids a hydration mismatch; the client snapshot then reveals the real answer. */
const NO_SUBSCRIBE = () => () => {};
const clientSnapshot = () => getRecognitionCtor() !== null;
const serverSnapshot = () => false;

export function DictateButton({ targetId }: { targetId: string }) {
  const supported = useSyncExternalStore(NO_SUBSCRIBE, clientSnapshot, serverSnapshot);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognition = useRef<Recognition | null>(null);

  useEffect(() => {
    return () => recognition.current?.stop();
  }, []);

  if (!supported) return null;

  function toggle() {
    if (listening) {
      recognition.current?.stop();
      return;
    }

    const Ctor = getRecognitionCtor();
    if (!Ctor) return;

    const instance = new Ctor();
    instance.continuous = true;
    instance.interimResults = false;
    instance.lang = "en-US";

    instance.onresult = (event) => {
      const field = document.getElementById(targetId) as HTMLTextAreaElement | null;
      if (!field) return;

      let added = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        if (event.results[i].isFinal) added += event.results[i][0].transcript;
      }
      if (!added) return;

      // Append rather than replace, so dictation adds to whatever was typed.
      const spacer = field.value && !field.value.endsWith(" ") ? " " : "";
      field.value = `${field.value}${spacer}${added.trim()}`;
      // React does not see a direct value assignment, so the change is announced manually.
      field.dispatchEvent(new Event("input", { bubbles: true }));
    };

    instance.onerror = (event) => {
      setError(
        event.error === "not-allowed"
          ? "Microphone permission denied."
          : `Dictation failed (${event.error}).`,
      );
      setListening(false);
    };

    instance.onend = () => setListening(false);

    recognition.current = instance;
    setError(null);
    setListening(true);
    instance.start();
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={toggle}
        aria-pressed={listening}
        aria-label={listening ? "Stop dictation" : "Dictate a note"}
        className={`rounded-md border px-2 py-1 transition-colors ${
          listening
            ? "border-primary bg-primary/15 text-primary"
            : "border-border text-muted-foreground hover:border-primary/60 hover:text-foreground"
        }`}
      >
        <svg viewBox="0 0 16 16" className="size-3.5 fill-none stroke-current stroke-[1.5]">
          <rect x="6" y="2" width="4" height="7" rx="2" />
          <path d="M3.5 7.5a4.5 4.5 0 0 0 9 0M8 12v2" />
        </svg>
      </button>
      {listening && (
        <span className="font-mono text-[0.6rem] text-primary">listening…</span>
      )}
      {error && <span className="font-mono text-[0.6rem] text-destructive">{error}</span>}
    </span>
  );
}
