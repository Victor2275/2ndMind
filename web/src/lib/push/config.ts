import "server-only";

/**
 * Web Push configuration (V3 §4.1, D-185).
 *
 * Push needs a VAPID key pair: the public half identifies this application to the browser's push
 * service when a device subscribes, and the private half signs every send. They are generated
 * once — `npm run push:keys` prints a fresh pair — and pasted into `.env.local` and Vercel.
 * Nothing generates them at runtime: a key pair that changed on deploy would invalidate every
 * subscription already stored, silently, and the symptom would be notifications simply stopping.
 *
 * Guarded the same way `isDatabaseConfigured()` is, and for the same reason: **the page that
 * explains a missing key must not be the page that crashes on it.** Without keys the app runs
 * exactly as it does today and the notification control says it is not set up.
 */

export function isPushConfigured(): boolean {
  return (
    typeof process.env.VAPID_PUBLIC_KEY === "string" &&
    process.env.VAPID_PUBLIC_KEY.length > 0 &&
    typeof process.env.VAPID_PRIVATE_KEY === "string" &&
    process.env.VAPID_PRIVATE_KEY.length > 0
  );
}

/**
 * The contact address the push service is given.
 *
 * Required by the VAPID spec so an operator has somewhere to complain if this application
 * misbehaves. It is sent to Google's and Mozilla's push endpoints, not to any page.
 */
export const VAPID_SUBJECT = "mailto:gusev0219@gmail.com";

/**
 * The public key, for the browser.
 *
 * Safe to serve — it is public by construction, and a subscription cannot be created without
 * it. The private half is never read outside a server module.
 */
export function publicKey(): string {
  return process.env.VAPID_PUBLIC_KEY ?? "";
}
