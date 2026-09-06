/**
 * Prints a fresh VAPID key pair for Web Push (V3 §4.1).
 *
 *   npm run push:keys
 *
 * Run once. Paste the two lines into `.env.local`, and the same two values into Vercel's
 * environment variables for the production deployment.
 *
 * Generated here rather than at runtime on purpose: a pair that changed on deploy would
 * invalidate every subscription already stored, and the symptom would be notifications simply
 * stopping with nothing in any log to say why.
 *
 * Nothing is written to disk by this script. It prints, and the paste is yours — a secret that
 * a tool writes into a file is a secret nobody remembers exists.
 */
import webpush from "web-push";

const { publicKey, privateKey } = webpush.generateVAPIDKeys();

console.log("\nPaste into web/.env.local, and into Vercel's environment variables:\n");
console.log(`VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
console.log("\nThe private key signs every notification. Do not commit it.\n");
