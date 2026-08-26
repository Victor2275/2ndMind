/**
 * Signed session tokens.
 *
 * Deliberately built on Web Crypto rather than a JWT library: this module is imported by
 * `proxy.ts`, which Next may deploy to a CDN edge runtime where Node's `crypto` is absent.
 * Web Crypto exists in both runtimes, and an HMAC over a JSON payload is the entirety of
 * what a single-user session needs. No dependency, and nothing to keep patched.
 *
 * The token is signed, not encrypted — its contents are readable by anyone holding it. That
 * is fine because it carries no secret, only a subject and an expiry. What it must resist is
 * forgery, which the HMAC provides.
 */

export const SESSION_COOKIE = "2m_session";
export const CHALLENGE_COOKIE = "2m_challenge";

/** Seven days. Long enough not to be annoying on a personal tool, short enough to matter. */
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

// The returning-visitor hint lives in `returning.ts` — it is not a session and carries no
// authority. Kept out of this module so public client bundles need not import the HMAC code.

export type SessionPayload = {
  /** Subject. Always "victor" — there is exactly one user, by design. */
  sub: string;
  /** Issued at, epoch seconds. */
  iat: number;
  /** Expires at, epoch seconds. */
  exp: number;
};

function b64urlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function key(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

/**
 * Constant-time comparison. `===` on the signature would leak, through timing, how many
 * leading bytes of a forged token were correct — which is enough to forge one byte at a time.
 */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function signSession(
  payload: SessionPayload,
  secret: string,
): Promise<string> {
  const body = b64urlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign(
    "HMAC",
    await key(secret),
    new TextEncoder().encode(body),
  );
  return `${body}.${b64urlEncode(new Uint8Array(signature))}`;
}

/** Returns the payload, or null for anything malformed, forged, or expired. */
export async function verifySession(
  token: string | undefined,
  secret: string,
  now: number = Math.floor(Date.now() / 1000),
): Promise<SessionPayload | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, signature] = parts;

  let expected: ArrayBuffer;
  try {
    expected = await crypto.subtle.sign(
      "HMAC",
      await key(secret),
      new TextEncoder().encode(body),
    );
  } catch {
    return null;
  }

  let provided: Uint8Array;
  try {
    provided = b64urlDecode(signature);
  } catch {
    return null;
  }

  if (!timingSafeEqual(new Uint8Array(expected), provided)) return null;

  try {
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(body))) as SessionPayload;
    if (typeof payload.exp !== "number" || payload.exp <= now) return null;
    if (typeof payload.sub !== "string" || payload.sub.length === 0) return null;
    return payload;
  } catch {
    return null;
  }
}

export function newSessionPayload(sub = "victor"): SessionPayload {
  const iat = Math.floor(Date.now() / 1000);
  return { sub, iat, exp: iat + SESSION_MAX_AGE };
}
