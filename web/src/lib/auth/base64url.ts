/**
 * base64url, in a module both halves of the app can import.
 *
 * `config.ts` is `server-only` and `session.ts` deliberately keeps zero imports so it can be
 * bundled for the edge runtime, so neither could be the shared home for these. Local unlock
 * needs them in the browser — a WebAuthn assertion arrives as three base64url strings and is
 * verified against a cached key — which is what makes a third copy worth avoiding.
 *
 * `session.ts` still carries its own pair. That is on purpose: it is the one module that must
 * bundle for an edge runtime with nothing behind it, and a shared import is a dependency it
 * has been deliberately kept free of. The duplication is two functions, and the alternative
 * is coupling the auth token to a module that may grow.
 */

export function toBase64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Returns `Uint8Array<ArrayBuffer>` rather than plain `Uint8Array`. TypeScript now tracks the
 * backing buffer in the type and `Uint8Array.from` widens it to `ArrayBufferLike`, which
 * `crypto.subtle` and @simplewebauthn both reject — so the buffer is allocated explicitly.
 */
export function fromBase64url(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** True when two byte arrays are equal. Not constant-time; used only on public values. */
export function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
