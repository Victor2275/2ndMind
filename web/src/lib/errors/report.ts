/**
 * What a crash report is, and what it is allowed to contain (V3 §2.4, D-165).
 *
 * Shared by the reporter in the browser, the service worker, and the endpoint that stores it —
 * one vocabulary, so a field added on one side cannot silently fail to arrive on the other.
 * This module is in the client bundle, so **nothing sensitive may live in it**: shapes and
 * rules only.
 *
 * ## This module must not import `zod`, and that is a size rule, not a style one (V4 §8.4, D-327)
 *
 * `app/layout.tsx` mounts `ErrorWatch` so that a stranger's crash on the public portfolio gets
 * reported at all, which is right and stays. But that makes this module's import graph part of
 * **every public page's bundle**, and `zod` is 64.1KB gzipped — 29% of the 220.7KB the
 * portfolio shipped before this split, on a site that validates nothing at runtime.
 *
 * The runtime schema lives in `./schema.ts` and is imported by the **endpoint only**. The type
 * below is hand-written rather than inferred for exactly that reason: `z.infer` is a type-level
 * import that `import type` would erase, but keeping the schema here at all invites the next
 * person to import a value from it. `schema.test.ts` pins the two definitions together, so they
 * cannot drift silently — which is the one real cost of not inferring.
 *
 * ## The rule that governs everything here
 *
 * A crash report is the one payload in this app that nobody wrote on purpose. Every other
 * write is a person deciding to record something; this one is assembled by machinery out of
 * whatever happened to be in scope when something went wrong — and what is in scope on a
 * private page is a GPA, per-course grades, bodyweight and a phone number.
 *
 * So it is **allowlisted, not blocklisted**. Only the fields below are read, each is capped,
 * and the two free-text ones are scrubbed for the shapes that carry identity. A blocklist
 * would be the natural design and would be wrong: it fails open, and it fails silently, on
 * the data the whole vault is careful about.
 *
 * Reports go to this app's own endpoint and Neon, never to a vendor (D-165), so the scrubbing
 * below is defence in depth rather than the only thing standing between the vault and a third
 * party. That is exactly why it is worth having: it is the layer that still holds if the
 * destination ever changes.
 */

/** Where it happened. Changes what can be done about it, so it is not free text. */
export const SOURCES = ["browser", "worker", "server"] as const;
export type Source = (typeof SOURCES)[number];

/** A stack is for orientation, not archaeology. */
export const MAX_STACK = 2_000;
export const MAX_MESSAGE = 500;

/** How long a route, build id or agent string may be. `schema.ts` enforces these. */
export const MAX_NAME = 120;
export const MAX_ROUTE = 500;
export const MAX_BUILD_ID = 64;
export const MAX_AGENT = 120;

/**
 * A report as it arrives, after parsing.
 *
 * Every field is required here because the schema gives each one a `""` default, so nothing is
 * optional by the time it reaches `clean`. Hand-written rather than `z.infer`ed — see the note
 * at the top of this file; `schema.test.ts` is what keeps the two in step.
 */
export type ErrorReportInput = {
  source: Source;
  name: string;
  message: string;
  stack: string;
  route: string;
  buildId: string;
  agent: string;
};

/**
 * Text that looks like it identifies a person, replaced.
 *
 * Not a general-purpose PII scrubber — there is no such thing — and it is not pretending to
 * be. It covers the shapes that actually appear in this vault and would actually appear in a
 * message: an email, a phone number, a long digit run that could be a student id, and a bare
 * `key=value` where the key names a credential.
 *
 * Ordered longest-pattern-first, because a phone number inside an email address should be
 * redacted as an email rather than chopped in half.
 */
const REDACTIONS: readonly [RegExp, string][] = [
  [/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]"],
  // +1 (310) 555-0143, 310-555-0143, 3105550143 — seven or more digits with the usual noise.
  [/(?:\+?\d[\d\s().-]{7,}\d)/g, "[phone]"],
  // Anything that names itself a secret. The value, not the key, so the shape stays readable.
  [/\b(token|secret|password|apikey|api_key|authorization|cookie|session)=\S+/gi, "$1=[redacted]"],
  // A bearer token or similar, which is long, opaque and unmistakable.
  [/\b[A-Za-z0-9_-]{40,}\b/g, "[token]"],
];

/**
 * Redact, **after truncating to `limit`**.
 *
 * The order is load-bearing and was got wrong first time. `[\w.+-]+@…` is quadratic in the
 * length of a run of word characters: on 50KB of them — which a deep recursion's stack trace
 * really is — it costs about a second of CPU. Scrubbing before truncating therefore handed an
 * open, unauthenticated endpoint a way to burn a core per request, and did the same on the
 * phone, inside the error handler, at the moment something was already going wrong.
 *
 * Truncating first bounds the work at a couple of milliseconds and loses nothing: the tail of
 * a 50KB stack is not read by anyone. Found by a test timing out under load rather than by
 * reading the code, which is the usual way with this class of bug.
 */
export function scrub(text: string, limit = MAX_STACK): string {
  let out = text.slice(0, limit);
  for (const [pattern, replacement] of REDACTIONS) out = out.replace(pattern, replacement);
  return out;
}

/**
 * A path with its query string and hash removed.
 *
 * The query is where the identifying things end up — `?from=`, a search term, an id — and it
 * is never worth enough to a crash report to justify keeping. An absolute URL is reduced to
 * its path for the same reason.
 */
export function safeRoute(input: string): string {
  const withoutHash = input.split("#")[0] ?? "";
  const withoutQuery = withoutHash.split("?")[0] ?? "";
  try {
    // Handles both "/private/log" and "https://victorgusev.com/private/log".
    return new URL(withoutQuery, "https://x.invalid").pathname;
  } catch {
    return withoutQuery.slice(0, 500);
  }
}

/**
 * The platform, coarsely — "Android", "iOS", "Windows", "Mac", or "other".
 *
 * The full user-agent string is a fingerprint and is worth nothing here: the only question a
 * crash report needs it to answer is *"is this the phone or the laptop"*, because those are
 * two very different problems with two different fixes.
 */
export function coarseAgent(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  if (ua.includes("android")) return "Android";
  if (ua.includes("iphone") || ua.includes("ipad")) return "iOS";
  if (ua.includes("windows")) return "Windows";
  if (ua.includes("mac os") || ua.includes("macintosh")) return "Mac";
  if (ua.includes("linux")) return "Linux";
  return "other";
}

/**
 * A stable identity for "the same problem".
 *
 * Built from the source, the error's name, and the message with its **variable parts removed**
 * — numbers, quoted strings, uuids. Without that, `Cannot read x of undefined at row 41` and
 * the same error at row 42 are two problems, and a loop produces a thousand of them. The whole
 * value of grouping is that ten thousand copies of one broken selector read as one line.
 *
 * The stack is deliberately *not* in it. Stack text differs between builds because the chunk
 * names are content-hashed, so including it would make every deploy look like a fresh crop of
 * new errors.
 */
export function fingerprintOf(input: {
  source: string;
  name: string;
  message: string;
  route?: string;
}): string {
  const skeleton = input.message
    .replace(/\d+/g, "#")
    .replace(/["'`][^"'`]*["'`]/g, "…")
    .trim()
    .slice(0, 200);

  return [input.source, input.name, safeRoute(input.route ?? ""), skeleton].join("|");
}

/** Everything the endpoint stores, already cleaned. */
export type CleanReport = ErrorReportInput & { fingerprint: string };

/**
 * Clean an incoming report.
 *
 * Run on the **server**, on whatever arrived, rather than trusting a client that has already
 * cleaned it. The endpoint is open to anything that can POST — a client-side scrub is a
 * convenience for the honest path and is not a boundary.
 */
export function clean(input: ErrorReportInput): CleanReport {
  const name = input.name.slice(0, 120);
  // Truncate, then scrub — see `scrub`. The other way round is quadratic on a long stack.
  const message = scrub(input.message, MAX_MESSAGE);
  const route = safeRoute(input.route);

  return {
    source: input.source,
    name,
    message,
    stack: scrub(input.stack, MAX_STACK),
    route,
    buildId: input.buildId.slice(0, 64),
    agent: coarseAgent(input.agent),
    fingerprint: fingerprintOf({ source: input.source, name, message, route }),
  };
}
