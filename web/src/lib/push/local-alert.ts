import type { OutboxSummary } from "@/lib/sync/outbox-view";

/**
 * Telling you something will not send (V3 §4.1, D-185).
 *
 * **Not a push.** The server cannot know this: the outbox is on the phone, and a server that
 * could see it would not need one. This is the app raising a notification about itself through
 * the service worker it already has — which needs no VAPID key, no subscription and no network,
 * and works on a device that has none of those.
 *
 * ## Only for what will not fix itself
 *
 * Victor's call, and the reasoning matters more than the rule. An op that is merely *pending*
 * is the system working: it sends the moment there is signal, and notifying about it would fire
 * on every tunnel and every lift. What deserves an interruption is `failed` — the server
 * rejected it, or it has run out of retries — because that is a state that will still be there
 * tomorrow without a person.
 *
 * A notification about something already on screen is one channel too many, so this exists for
 * the case where the app is *not* on screen. The badge (§1.7) covers the case where it is.
 *
 * ## Once per problem, not once per check
 *
 * The runner flushes on reconnect, on foreground, and whenever anything asks. Notifying on each
 * of those would produce a burst for one unchanged problem — so it fires only when the failed
 * count *rises*, and the count is remembered across reloads in `localStorage`. Restoring the
 * counter is deliberately failure-tolerant: a device that will not give us storage should still
 * be told once rather than not at all.
 */

const SEEN_KEY = "2ndmind:failed-notified";
const TAG = "outbox-stuck";

function lastNotified(): number {
  try {
    return Number(localStorage.getItem(SEEN_KEY) ?? "0") || 0;
  } catch {
    return 0;
  }
}

function remember(count: number): void {
  try {
    localStorage.setItem(SEEN_KEY, String(count));
  } catch {
    // Private browsing, or storage refused. The cost is a repeat notification, which is a much
    // smaller failure than staying silent about an entry that will never send.
  }
}

/**
 * @returns whether a notification was raised, which is what makes this testable without a
 *          service worker.
 */
export async function alertIfStuck(summary: OutboxSummary): Promise<boolean> {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return false;
  if (!("serviceWorker" in navigator)) return false;

  const failed = summary.failed;
  const seen = lastNotified();

  // Cleared, or reduced: forget, so the next failure is announced again.
  if (failed < seen) remember(failed);
  if (failed === 0 || failed <= seen) return false;

  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification(
      failed === 1 ? "An entry did not send" : `${failed} entries did not send`,
      {
        body: "They are still on this phone. Open Not sent to see why.",
        tag: TAG,
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        data: { url: "/private/sync" },
      },
    );
    remember(failed);
    return true;
  } catch {
    // No worker yet, or the browser refused. Not worth reporting: this is the notification
    // path, and a failure to notify must not become a thing that needs notifying about.
    return false;
  }
}
