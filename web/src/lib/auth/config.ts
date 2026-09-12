import "server-only";

import { passkeyCredentials } from "@/lib/db/schema";
import type { Db } from "@/lib/tasks/queries";

/**
 * Auth configuration.
 *
 * There is no user table. There is exactly one user, which is what makes storing credentials
 * this simply viable at all: a credential ID and a public key, neither secret — the private
 * key never leaves the authenticator.
 *
 * **Credentials live in Postgres (`passkey_credentials`), not the environment.** They used to
 * live entirely in a `PASSKEYS` env var, which made enrolling a device a Vercel round-trip: set
 * a secret, register, copy the returned value, paste it back, redeploy. That was fine for a
 * device that changes roughly never, but it is not self-serve. A row insert needs neither an
 * env edit nor a redeploy, so enrolment finishes the moment the ceremony does.
 *
 * `PASSKEYS` / `PASSKEY_CREDENTIAL_ID` / `PASSKEY_PUBLIC_KEY` are still honoured, folded in
 * alongside whatever is in the table, so the currently-enrolled device is never lost mid-
 * migration and auth still has a path if the database is briefly unreachable.
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
 * Every credential configured via the legacy environment variables. Empty when neither is set.
 *
 * Two devices meant two credentials, and the shape of the environment decided how badly that
 * could go wrong. Two parallel lists — ids in one variable, keys in another — would pair by
 * position, so deleting one retired device from one list and forgetting the other silently
 * bound the wrong key to the wrong id. So a credential was one indivisible string:
 *
 *     PASSKEYS=laptop:<id>:<publicKey>,phone:<id>:<publicKey>
 *
 * Entries are separated by commas or newlines, fields by colons — safe as a separator because
 * base64url is `A-Za-z0-9-_` and contains no colon. The id and key are the last two fields, so
 * a label may contain colons without ambiguity.
 *
 * `PASSKEY_CREDENTIAL_ID` / `PASSKEY_PUBLIC_KEY` are still honoured as a single unlabelled
 * credential, folded in by `storedCredentials()` below. Kept only so the device enrolled under
 * the old scheme is never lost; new devices enrol straight into the database.
 */
export function legacyEnvCredentials(): StoredCredential[] {
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

/**
 * Every registered passkey: the database table plus whatever the legacy env vars still name.
 *
 * The table is the source of truth for anything enrolled through `/signin/register` from here
 * on. The env vars are folded in on every call rather than migrated once, so a device enrolled
 * under the old scheme keeps working with no migration step, and auth degrades to "the one
 * device that was already working" rather than failing outright if the database is briefly
 * unreachable or unconfigured — callers simply omit `db` in that case.
 *
 * Takes the handle as its first argument, like every other query module in this codebase
 * (`lib/ai/summaries.ts` et al.), so the suite can run it against real Postgres in PGlite
 * rather than a mock. `db` is omitted when the database is not configured at all — callers
 * check `isDatabaseConfigured()` themselves, the same way every other database-optional
 * feature in this app does, rather than this function re-deriving that from the environment.
 */
export async function storedCredentials(db?: Db): Promise<StoredCredential[]> {
  const found = legacyEnvCredentials();

  if (db) {
    const rows = await db.select().from(passkeyCredentials);
    for (const row of rows) {
      // First wins: an id already known from the environment keeps its env-sourced label
      // rather than being listed twice.
      if (found.some((c) => c.id === row.id)) continue;
      found.push({ id: row.id, publicKey: base64urlToBytes(row.publicKey), label: row.label });
    }
  }

  return found;
}

/** Persists a newly-enrolled credential. The registration endpoint's only write. */
export async function saveCredential(
  db: Db,
  credential: { id: string; publicKey: string; label: string },
): Promise<void> {
  await db.insert(passkeyCredentials).values(credential);
}

/**
 * Registration is disabled unless `PASSKEY_REGISTRATION_SECRET` is set *and* the caller
 * supplies it. Closed by default is the only safe posture here: an open registration
 * endpoint on a deployment with no credential configured would hand the private site to
 * whoever found it first.
 *
 * Unlike the old one-shot flow, this secret is meant to stay set permanently — it is what
 * makes enrolment self-serve. Victor keeps it somewhere durable (a password manager) and
 * types it on each new device; nothing about enrolling one needs an env edit or a redeploy.
 * It is not a per-user password: knowing it only opens the *registration* ceremony, and a
 * WebAuthn assertion is still required to actually produce a credential.
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
