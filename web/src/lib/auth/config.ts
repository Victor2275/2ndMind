import "server-only";

/**
 * Auth configuration, read from the environment.
 *
 * There is no user table. The registered passkey lives in environment variables, which is
 * viable precisely because there is exactly one user and the stored values are not secret:
 * a credential ID and a public key. The private key never leaves the authenticator.
 *
 * The consequence worth stating: rotating or adding a device means re-running registration
 * and pasting new values into Vercel. For a personal tool that happens roughly never, and it
 * buys the removal of an entire database from the auth path.
 */

export type StoredCredential = {
  id: string;
  publicKey: Uint8Array<ArrayBuffer>;
};

export function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET is missing or shorter than 32 characters. Generate one with: " +
        `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`,
    );
  }
  return secret;
}

/** The registered passkey, or null when none has been configured yet. */
export function storedCredential(): StoredCredential | null {
  const id = process.env.PASSKEY_CREDENTIAL_ID;
  const publicKey = process.env.PASSKEY_PUBLIC_KEY;
  if (!id || !publicKey) return null;
  return { id, publicKey: base64urlToBytes(publicKey) };
}

/**
 * Registration is disabled unless `PASSKEY_REGISTRATION_SECRET` is set *and* the caller
 * supplies it. Closed by default is the only safe posture here: an open registration
 * endpoint on a deployment with no credential configured would hand the private site to
 * whoever found it first. To enrol a device, set the variable, register, then unset it.
 */
export function registrationSecret(): string | null {
  const secret = process.env.PASSKEY_REGISTRATION_SECRET;
  return secret && secret.length >= 16 ? secret : null;
}

/**
 * The WebAuthn relying-party ID must be the site's registered domain — a bare hostname, no
 * scheme or port. A mismatch between this and the browser's origin is the single most common
 * reason a passkey ceremony fails, and the error it produces says nothing useful.
 */
export function relyingParty(): { rpID: string; origin: string; rpName: string } {
  const configured = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const url = new URL(configured);
  return { rpID: url.hostname, origin: url.origin, rpName: "2ndMind" };
}

/**
 * Returns `Uint8Array<ArrayBuffer>` rather than plain `Uint8Array`. TypeScript now tracks the
 * backing buffer in the type, `Uint8Array.from` widens it to `ArrayBufferLike`, and
 * @simplewebauthn requires the narrow form — so the buffer is allocated explicitly.
 */
export function base64urlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function bytesToBase64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
