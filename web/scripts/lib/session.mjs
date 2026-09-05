/**
 * Mints a session cookie the way `lib/auth/session.ts` does, for scripts that drive a browser.
 *
 * The session is an HMAC over a JSON payload, so a valid cookie can be produced from
 * `SESSION_SECRET` alone — no passkey ceremony, no WebAuthn in a headless browser. That is the
 * only reason `npm run shots` can measure a signed-in page at all.
 *
 * Shared rather than copied. It lived in `shots.mjs` until `e2e-offline.mjs` needed the same
 * thing, and two copies of a signing routine is the kind of duplication that goes wrong
 * silently: change the payload shape in the app, fix one caller, and the other keeps minting
 * cookies the server quietly rejects — which shows up as a redirect to `/signin` and looks
 * like a broken test rather than a stale helper.
 */

function b64url(bytes) {
  return Buffer.from(bytes).toString("base64url");
}

/**
 * @param secret      `SESSION_SECRET` from the environment.
 * @param ttlSeconds  How long the token is good for. Short on purpose: these tokens exist for
 *                    the length of one run, not the app's seven days.
 */
export async function mintSession(secret, ttlSeconds = 900) {
  const now = Math.floor(Date.now() / 1000);
  const payload = { sub: "victor", iat: now, exp: now + ttlSeconds };
  const body = b64url(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return `${body}.${b64url(new Uint8Array(signature))}`;
}

/** The cookie name the app reads. */
export const SESSION_COOKIE = "2m_session";
