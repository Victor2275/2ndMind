"use client";

import { BellIcon, BellOffIcon } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";

import { reportError } from "@/lib/errors/client";

/**
 * Turning notifications on, deliberately (V3 §4.1, D-185).
 *
 * **It never asks on its own.** Victor's call, and the reason is that the prompt is a
 * consumable: Chrome hardens against sites that spend it badly, and on Android a denial is
 * sticky and awkward enough to reverse that most people never do. One tap on a control you went
 * looking for cannot be spent by accident, and it arrives with the answer already decided.
 *
 * Nothing sensitive may appear in this file; it compiles into `/_next/static/chunks/`. The VAPID
 * public key is public by construction — a subscription cannot be created without it and it
 * grants nothing on its own.
 */

const ON_CLIENT = () => true;
const ON_SERVER = () => false;
const NEVER_CHANGES = () => () => {};

type State = "unsupported" | "blocked" | "off" | "on" | "working";

function currentState(): State {
  if (typeof Notification === "undefined" || !("serviceWorker" in navigator)) return "unsupported";
  if (Notification.permission === "denied") return "blocked";
  return "off";
}

export function PushToggle({
  publicKey,
  className = "",
}: {
  publicKey: string;
  className?: string;
}) {
  // Same reason as the theme toggle: permission lives in the browser, so anything rendered
  // before hydration is a guess, and the guess flickers on every load.
  const ready = useSyncExternalStore(NEVER_CHANGES, ON_CLIENT, ON_SERVER);

  // A lazy initialiser, not an effect. It runs once per mount and `currentState()` answers
  // "unsupported" where there is no `Notification` at all, so this is safe during a server
  // render and correct on the first client one — with no synchronous `setState` in an effect,
  // which is a cascading render and which `react-hooks/set-state-in-effect` rejects.
  const [state, setState] = useState<State>(() => currentState());

  // Whether this device already holds a subscription can only be asked asynchronously, so this
  // one genuinely is an effect. Asynchronous `setState` inside it is not the pattern the rule
  // is about.
  useEffect(() => {
    let cancelled = false;
    void existingSubscription().then((subscription) => {
      if (!cancelled && subscription) setState("on");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) return <span aria-hidden className={`inline-block size-10 ${className}`} />;

  // Nothing to offer if the deployment has no keys, or the browser cannot do this at all. Said
  // rather than shown as a dead switch — a control that does nothing is worse than no control.
  if (publicKey === "") return null;
  if (state === "unsupported") return null;

  const label =
    state === "blocked"
      ? "Notifications blocked in browser settings"
      : state === "on"
        ? "Notifications on"
        : "Turn notifications on";

  return (
    <button
      type="button"
      disabled={state === "blocked" || state === "working"}
      onClick={async () => {
        setState("working");
        try {
          if (await currentlyOn()) {
            await unsubscribe();
            setState("off");
            return;
          }
          const granted = await Notification.requestPermission();
          if (granted !== "granted") {
            setState(granted === "denied" ? "blocked" : "off");
            return;
          }
          await subscribe(publicKey);
          setState("on");
        } catch (error) {
          void reportError(error);
          setState(currentState());
        }
      }}
      aria-label={label}
      title={label}
      className={`flex min-h-10 items-center gap-2 rounded-md px-2 transition-colors disabled:opacity-60 ${
        state === "on" ? "text-primary" : "text-muted-foreground hover:text-foreground"
      } ${className}`}
    >
      {state === "on" ? (
        <BellIcon className="size-4" aria-hidden />
      ) : (
        <BellOffIcon className="size-4" aria-hidden />
      )}
      <span className="font-mono text-xs">
        {state === "working" ? "…" : state === "on" ? "Notifying" : "Notify"}
      </span>
    </button>
  );
}

async function existingSubscription(): Promise<PushSubscription | null> {
  try {
    const registration = await navigator.serviceWorker.ready;
    return await registration.pushManager.getSubscription();
  } catch {
    return null;
  }
}

async function currentlyOn(): Promise<boolean> {
  return (await existingSubscription()) !== null;
}

async function subscribe(publicKey: string): Promise<void> {
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    // Required by Chrome: a push that cannot be shown is not allowed. This app has no use for
    // silent pushes anyway — every notification it sends is something to read.
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });

  const response = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      ...subscription.toJSON(),
      // Coarse only, to tell one device from another in a list. Never the full user agent.
      agent: navigator.userAgent.includes("Android")
        ? "Android"
        : navigator.userAgent.includes("Mac")
          ? "Mac"
          : "Desktop",
    }),
  });

  if (!response.ok) {
    // The browser now holds a subscription the server does not know about, which would look
    // like "on" forever while nothing ever arrived. Undo it rather than leave that.
    await subscription.unsubscribe().catch(() => {});
    throw new Error(`subscribe failed: ${response.status}`);
  }
}

async function unsubscribe(): Promise<void> {
  const subscription = await existingSubscription();
  if (!subscription) return;
  await fetch("/api/push/subscribe", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  }).catch(() => {});
  await subscription.unsubscribe().catch(() => {});
}

/**
 * The VAPID public key, as the browser wants it.
 *
 * `applicationServerKey` takes raw bytes; the key is distributed as base64url. This is the
 * conversion every Web Push guide carries, and it is here rather than in a library because it
 * is eight lines and a dependency for eight lines is a dependency to update forever.
 */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(padded);
  // Backed by an explicit `ArrayBuffer` rather than `Uint8Array.from`, whose result is typed
  // over `ArrayBufferLike` — and `applicationServerKey` will not take a view that might be
  // over a `SharedArrayBuffer`.
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}
