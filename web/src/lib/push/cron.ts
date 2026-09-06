import "server-only";

/**
 * What the two scheduled jobs have in common (V3 §4.1, D-185).
 *
 * ## Why they are authenticated at all
 *
 * A cron route is a public URL. Anything that can reach it can make Victor's phone buzz, and
 * "send a notification" is exactly the kind of endpoint that gets found and poked. Vercel signs
 * its own scheduled invocations with `CRON_SECRET` in an `Authorization` header; this checks it
 * and refuses everything else.
 *
 * **Refused with 401 and no detail**, and if the secret is not configured the route refuses
 * *everything* rather than falling open. A missing secret is a deployment mistake, and the safe
 * reading of a deployment mistake is "nobody may ring this bell", not "everybody may".
 */

export function cronRequestIsAuthentic(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (typeof secret !== "string" || secret.length === 0) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * The day boundaries Victor lives in, not the server's.
 *
 * Vercel runs cron in UTC and the functions run in `iad1`; neither is where the day being
 * described starts and ends. `America/Los_Angeles` is the app's canonical zone already —
 * `athletics/trends.ts` uses it, and the calendar feeds are published in it — so a
 * "nothing logged today" claim has to be computed there or it is a claim about the wrong day.
 *
 * Derived from the formatted parts rather than by arithmetic on an offset, because the offset
 * changes twice a year and the bug that produces is a one-hour window, once, in the dark.
 */
export const ZONE = "America/Los_Angeles";

export function localDayBounds(now = new Date()): { start: Date; end: Date; label: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  // `en-CA` formats as YYYY-MM-DD, which is the one locale that gives an ISO date for free.
  const start = zonedMidnight(parts);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
  return { start, end, label: parts };
}

/**
 * Midnight in `ZONE` for a `YYYY-MM-DD`, as a real instant.
 *
 * Found by asking what that zone calls a candidate instant and correcting once. Two passes are
 * enough for every offset in use, including the half-hour ones, and it needs no timezone table.
 */
function zonedMidnight(day: string): Date {
  let guess = new Date(`${day}T00:00:00Z`);
  for (let pass = 0; pass < 2; pass += 1) {
    const seen = new Intl.DateTimeFormat("en-CA", {
      timeZone: ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(guess);
    const get = (type: string) => Number(seen.find((p) => p.type === type)?.value ?? 0);
    const driftMinutes = get("hour") * 60 + get("minute");
    const dayDrift = get("day") - Number(day.slice(8, 10));
    guess = new Date(guess.getTime() - (driftMinutes + dayDrift * 24 * 60) * 60_000);
  }
  return guess;
}
