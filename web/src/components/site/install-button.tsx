"use client";

import { DownloadIcon } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * `beforeinstallprompt` is Chromium-only and not in lib.dom. Declared narrowly rather than
 * cast to `any`, so the two members actually used are still type-checked.
 */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * Offers to install the app, and shows nothing at all when there is nothing to offer
 * (V3 §1.1).
 *
 * Chrome fires `beforeinstallprompt` only when the app is installable and not already
 * installed, so this button's own absence is the honest answer in every other case — already
 * installed, unsupported browser, criteria not met. No "how to install" instructions: the
 * Next.js guidance is explicitly against building a cross-browser install UI, and the one
 * device that matters here is a Samsung running Chrome.
 *
 * Nothing sensitive may appear in this file — it is a Client Component.
 */
export function InstallButton() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handler = (event: Event) => {
      // Without this, Chrome shows its own mini-infobar and the event is wasted. Preventing
      // the default is what lets the prompt be saved and fired from a real tap later.
      event.preventDefault();
      setPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    // Once installed the saved prompt is spent; drop it so the button disappears rather than
    // sitting there doing nothing.
    const installed = () => setPrompt(null);
    window.addEventListener("appinstalled", installed);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);

  if (!prompt) return null;

  return (
    <button
      type="button"
      onClick={async () => {
        await prompt.prompt();
        // A saved prompt can only be used once, whichever way the user answers.
        setPrompt(null);
      }}
      className="flex min-h-12 items-center gap-2 rounded-md border border-primary/50 bg-primary/10 px-3 text-sm text-primary transition-colors hover:bg-primary/20"
    >
      <DownloadIcon className="size-4" aria-hidden />
      Install app
    </button>
  );
}
