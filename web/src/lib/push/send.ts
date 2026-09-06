import "server-only";

import webpush from "web-push";
import { eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { pushSubscriptions } from "@/lib/db/schema";
import { isPushConfigured, publicKey, VAPID_SUBJECT } from "@/lib/push/config";

/**
 * Sending a notification to every device that agreed to one (V3 §4.1, D-185).
 *
 * ## Dead subscriptions prune themselves
 *
 * A push service answers **404** or **410** for a subscription that has been revoked, an app
 * that was uninstalled, or a browser whose storage was cleared. Those are the only two statuses
 * that mean *this will never work again*; everything else — a 500, a timeout, a rate limit — is
 * the service having a bad minute and must not cost a device its subscription.
 *
 * So the sender deletes on exactly those two, and on nothing else. Getting this wrong in either
 * direction is quietly bad: too eager and a working phone stops being notified after one blip;
 * too shy and every reinstall leaves a row that fails forever, and the failures are the only
 * place anyone would notice.
 *
 * ## It never throws
 *
 * The callers are a cron route and a background job. A send that fails must not take down the
 * thing that asked for it, and there is no user waiting on the result — so failures are counted
 * and returned rather than raised.
 */

export type Notification = {
  title: string;
  body: string;
  /** Where tapping it should land. Relative, resolved against the origin by the worker. */
  url: string;
  /**
   * Collapses notifications that mean the same thing.
   *
   * Android replaces a notification carrying a tag it already shows, so two evening reminders
   * on two days do not stack into a pile nobody reads — the newer simply takes the older's
   * place.
   */
  tag: string;
};

export type SendResult = { sent: number; pruned: number; failed: number };

export async function notifyAllDevices(notification: Notification): Promise<SendResult> {
  if (!isPushConfigured()) return { sent: 0, pruned: 0, failed: 0 };

  webpush.setVapidDetails(VAPID_SUBJECT, publicKey(), process.env.VAPID_PRIVATE_KEY ?? "");

  const handle = db();
  const devices = await handle.select().from(pushSubscriptions);
  if (devices.length === 0) return { sent: 0, pruned: 0, failed: 0 };

  const payload = JSON.stringify(notification);
  const dead: string[] = [];
  let sent = 0;
  let failed = 0;

  await Promise.all(
    devices.map(async (device) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: device.endpoint,
            keys: { p256dh: device.p256dh, auth: device.auth },
          },
          payload,
        );
        sent += 1;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) dead.push(device.endpoint);
        else failed += 1;
      }
    }),
  );

  if (dead.length > 0) {
    await handle.delete(pushSubscriptions).where(inArray(pushSubscriptions.endpoint, dead));
  }
  if (sent > 0) {
    const alive = devices.map((d) => d.endpoint).filter((e) => !dead.includes(e));
    if (alive.length > 0) {
      await handle
        .update(pushSubscriptions)
        .set({ lastSentAt: new Date() })
        .where(inArray(pushSubscriptions.endpoint, alive));
    }
  }

  return { sent, pruned: dead.length, failed };
}

/** Removes one device, for the toggle turning itself off. */
export async function forgetDevice(endpoint: string): Promise<void> {
  await db().delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
}
