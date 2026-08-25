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
 * The WebAuthn relying party: which domain a passkey belongs to, and which origins may use it.
 *
 * A mismatch here is the single most common reason a passkey ceremony fails, and the error it
 * produces says nothing useful. Two rules, and they are not the same rule:
 *
 * - **`rpID` is a bare hostname** and the credential is bound to it forever. It may be any
 *   registrable-domain suffix of the origin, so a credential scoped to `victorgusev.com` works
 *   on `www.victorgusev.com` — but not the reverse. So the apex is always the right choice:
 *   `www` is a strictly narrower binding that buys nothing.
 * - **`origins` must contain the browser's exact origin**, scheme and port included. This is a
 *   list rather than a string because the site answers on both the apex and `www`, and which
 *   one is primary is a Vercel setting that can be flipped in one click. When it was a single
 *   value derived from `NEXT_PUBLIC_SITE_URL`, pointing the domain at `www` silently broke
 *   sign-in: the app expected one origin and the browser sent another.
 *
 * Together these mean the passkey survives the apex and `www` being swapped, and only a change
 * of actual domain requires re-enrolment.
 */
export function relyingParty(): { rpID: string; origins: string[]; rpName: string } {
  const configured = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.victorgusev.com";
  const url = new URL(configured);
  const host = url.hostname;

  // localhost and bare IPs have no registrable domain and no `www` sibling, so they are used
  // exactly as configured — port and all, which `url.origin` preserves and a rebuilt string
  // would drop.
  const literal = host === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(host);
  if (literal) {
    return { rpID: host, origins: [url.origin], rpName: "2ndMind" };
  }

  const apex = host.startsWith("www.") ? host.slice(4) : host;
  const origins = [
    ...new Set([url.origin, `${url.protocol}//${apex}`, `${url.protocol}//www.${apex}`]),
  ];

  return { rpID: apex, origins, rpName: "2ndMind" };
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
