import {
  coarseAgent,
  MAX_MESSAGE,
  MAX_STACK,
  safeRoute,
  scrub,
  type Source,
} from "@/lib/errors/report";

/**
 * Sending a crash report from the browser (V3 §2.4, D-165).
 *
 * Three rules shape all of it, and each is a way this file could make things worse rather than
 * better:
 *
 * 1. **It must never throw.** Every call site is a `catch` or a global handler — somewhere
 *    already going wrong. An exception here replaces a handled failure with an unhandled one.
 * 2. **It must never loop.** A report that fails and reports its own failure is an outage
 *    generator. `reporting` is the guard, and the endpoint answering 204 to everything is the
 *    other half of it.
 * 3. **It must not lose the phone's errors.** A crash with no signal is the case D-137
 *    scheduled this for, and it is exactly the case a naive `fetch` drops. Failures are held
 *    in `localStorage` and flushed on the next load.
 *
 * Nothing sensitive may be hard-coded here — it compiles into `/_next/static/chunks/`.
 */

/** Bounded hard: this is a queue for a device that may be offline for days. */
const HELD_KEY = "2m_errors";
const MAX_HELD = 20;

/** True while a report is in flight, so a failure inside one cannot start another. */
let reporting = false;

type Payload = {
  source: Source;
  name: string;
  message: string;
  stack: string;
  route: string;
  buildId: string;
  agent: string;
};

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    // A private window can throw on access, not just on write.
    return null;
  }
}

function held(): Payload[] {
  try {
    const raw = storage()?.getItem(HELD_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_HELD) : [];
  } catch {
    return [];
  }
}

function hold(payloads: Payload[]): void {
  try {
    // Newest kept, oldest dropped. On a device that has been offline for a week the first
    // twenty errors are the least interesting ones — they are the same crash from Tuesday.
    storage()?.setItem(HELD_KEY, JSON.stringify(payloads.slice(-MAX_HELD)));
  } catch {
    // Full, or refused. Losing a held report is acceptable; throwing here is not.
  }
}

/**
 * The build this page is running, for telling "still broken" from "broken again".
 *
 * `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA` is set by the platform and inlined at build time, so this
 * needs no plumbing of its own. Empty in local development, which is correct: there is no
 * commit a dev server is "running".
 *
 * It is deliberately *not* read from the service worker's build stamp (D-146), even though that
 * is the number that identifies what is running. The worker and the page can be one deploy
 * apart — that is the entire reason the update prompt exists — so a page reporting the worker's
 * id would misattribute its own errors to a build it is not made of.
 */
function buildId(): string {
  return (process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? "").slice(0, 12);
}

async function send(payload: Payload): Promise<boolean> {
  try {
    const response = await fetch("/api/errors", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      // Diagnostics must never delay or block anything a person is waiting for.
      keepalive: true,
      credentials: "same-origin",
    });
    return response.ok;
  } catch {
    return false;
  }
}

function describe(error: unknown): { name: string; message: string; stack: string } {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack ?? "",
    };
  }
  // A thrown string, a rejected object, `undefined`. Worth reporting and easy to crash on.
  return { name: "Thrown", message: String(error), stack: "" };
}

/**
 * Report one error. Never throws, never loops, holds it if there is no network.
 *
 * The scrub runs here as well as on the server. Not redundancy for its own sake: it means a
 * report waiting in `localStorage` on a phone is already clean, so a device that never
 * reconnects is not sitting on an unscrubbed copy of something.
 */
export async function reportError(error: unknown, source: Source = "browser"): Promise<void> {
  if (reporting) return;
  reporting = true;

  try {
    const { name, message, stack } = describe(error);
    const payload: Payload = {
      source,
      name: name.slice(0, 120),
      // Truncate then scrub, not the other way round: the email pattern is quadratic in the
      // length of a word-character run, and a deep recursion's stack really is 50KB of them.
      // Doing it backwards burned a second of CPU on the phone, inside the error handler.
      message: scrub(message, MAX_MESSAGE),
      stack: scrub(stack, MAX_STACK),
      route: safeRoute(typeof location === "undefined" ? "" : location.pathname),
      buildId: buildId(),
      agent: coarseAgent(typeof navigator === "undefined" ? "" : navigator.userAgent),
    };

    if (!(await send(payload))) hold([...held(), payload]);
  } catch {
    // Rule 1. There is nowhere left to report a failure to report.
  } finally {
    reporting = false;
  }
}

/**
 * Send whatever was held while there was no network.
 *
 * Called on load rather than on `online`: the event is unreliable (a captive portal reports
 * online), and a page load is a moment when nobody is waiting for anything.
 */
export async function flushHeldErrors(): Promise<void> {
  const queue = held();
  if (queue.length === 0) return;

  // Cleared first, on purpose. If a flush fails halfway, losing a diagnostic beats a queue
  // that grows every load and re-sends the same twenty reports forever.
  hold([]);

  for (const payload of queue) {
    if (!(await send(payload))) {
      hold([...held(), payload]);
      return;
    }
  }
}

/**
 * Catch what nobody caught.
 *
 * `error` covers a throw during render or in an event handler; `unhandledrejection` covers the
 * far more common case in this app, where nearly everything that can fail is a promise. Both
 * are passive listeners — nothing is prevented, and React's own error handling is untouched.
 *
 * Returns its own teardown, so a component effect can install and remove it.
 */
export function watchForErrors(): () => void {
  if (typeof window === "undefined") return () => {};

  const onError = (event: ErrorEvent) => void reportError(event.error ?? event.message);
  const onRejection = (event: PromiseRejectionEvent) => void reportError(event.reason);

  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);

  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
  };
}
