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
  /** Which device this is, for the human reading the environment. Never used in the ceremony. */
  label: string;
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

/**
 * Every registered passkey. Empty when none has been configured yet.
 *
 * Two devices means two credentials, and the shape of the environment decides how badly that
 * can go wrong. Two parallel lists — ids in one variable, keys in another — would pair by
 * position, so deleting one retired device from one list and forgetting the other silently
 * binds the wrong key to the wrong id. So a credential is one indivisible string:
 *
 *     PASSKEYS=laptop:<id>:<publicKey>,phone:<id>:<publicKey>
 *
 * Entries are separated by commas or newlines, fields by colons — safe as a separator because
 * base64url is `A-Za-z0-9-_` and contains no colon. The id and key are the last two fields, so
 * a label may contain colons without ambiguity. The label is for whoever is reading the
 * variable months later deciding which line is the old phone; it never enters the ceremony.
 *
 * `PASSKEY_CREDENTIAL_ID` / `PASSKEY_PUBLIC_KEY` are still honoured as a single unlabelled
 * credential. That pair is what is currently deployed and working, and this change must not be
 * the thing that logs Victor out of his own site.
 */
export function storedCredentials(): StoredCredential[] {
  const found: StoredCredential[] = [];

  const legacyId = process.env.PASSKEY_CREDENTIAL_ID;
  const legacyKey = process.env.PASSKEY_PUBLIC_KEY;
  if (legacyId && legacyKey) {
    found.push({ id: legacyId, publicKey: base64urlToBytes(legacyKey), label: "device 1" });
  }

  for (const entry of (process.env.PASSKEYS ?? "").split(/[,\n]/)) {
    const trimmed = entry.trim();
    if (!trimmed) continue;

    const parts = trimmed.split(":");
    const publicKey = parts.pop();
    const id = parts.pop();
    if (!id || !publicKey) {
      // Skipped rather than thrown: one typo should cost one device, not the whole site's
      // ability to sign in. The remaining credentials still work, and if none survive the
      // login route already answers "no passkey enrolled".
      console.warn(`PASSKEYS: ignoring malformed entry "${trimmed.slice(0, 12)}…"`);
      continue;
    }

    const label = parts.join(":").trim() || `device ${found.length + 1}`;
    // First wins, so a legacy entry and a PASSKEYS entry for the same authenticator do not
    // become two.
    if (found.some((c) => c.id === id)) continue;
    found.push({ id, publicKey: base64urlToBytes(publicKey), label });
  }

  return found;
}

/** Serialises credentials back into a `PASSKEYS` value, for the enrolment page to hand over. */
export function serialiseCredentials(
  credentials: { id: string; publicKey: string; label: string }[],
): string {
  return credentials.map((c) => `${c.label}:${c.id}:${c.publicKey}`).join(",");
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
  const configured = process.env.NEXT_PUBLIC_SITE_URL ?? "https://victorgusev.com";
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
 * Explains a relying-party misconfiguration, or null when there is nothing wrong.
 *
 * This exists because the browser's own error is actively misleading. When
 * `NEXT_PUBLIC_SITE_URL` was unset in production, `relyingParty()` fell back to
 * `http://localhost:3000` and the browser reported:
 *
 *     The RP ID "localhost" is invalid for this domain
 *
 * which names a value nobody configured, does not mention the variable that produced it, and
 * reads like a bug in the site rather than a missing environment variable. It cost a real
 * debugging session on 2026-08-25.
 *
 * Called before the ceremony starts, so the failure arrives as a sentence instead of a
 * DOMException. Everything in the message is already public: `NEXT_PUBLIC_*` is inlined into
 * client bundles by definition, and the request's own origin is known to whoever sent it.
 */
export function relyingPartyProblem(requestOrigin: string | null): string | null {
  if (!requestOrigin) return null; // Same-origin GETs may omit it; nothing to check against.

  const { origins } = relyingParty();
  if (origins.includes(requestOrigin)) return null;

  const configured = process.env.NEXT_PUBLIC_SITE_URL ?? "(unset)";
  return (
    `Passkeys cannot work here: this request came from ${requestOrigin}, but ` +
    `NEXT_PUBLIC_SITE_URL is ${configured}, so the app expects ${origins.join(" or ")}. ` +
    `Set NEXT_PUBLIC_SITE_URL to the origin the site is actually served from and redeploy.`
  );
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
