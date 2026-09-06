import { describe, expect, it } from "vitest";

import { cronRequestIsAuthentic, localDayBounds, ZONE } from "@/lib/push/cron";

/**
 * §4.1's two scheduled jobs, and the two things about them that are easy to get wrong in ways
 * nothing would report.
 *
 * A cron route is a public URL: anything that reaches it makes a phone buzz. And a day boundary
 * computed in the wrong zone makes "nothing was logged today" a claim about a different day —
 * which is worse than no reminder, because it is a reminder that is wrong.
 */

const withSecret = (header: string | null) =>
  new Request("https://example.com/api/cron/evening", {
    headers: header === null ? {} : { authorization: header },
  });

describe("who may ring the bell", () => {
  const original = process.env.CRON_SECRET;
  const set = (value: string | undefined) => {
    if (value === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = value;
  };

  it("accepts the secret Vercel sends", () => {
    set("s3cret");
    expect(cronRequestIsAuthentic(withSecret("Bearer s3cret"))).toBe(true);
    set(original);
  });

  it("refuses a wrong one, a missing one, and a bare one", () => {
    set("s3cret");
    expect(cronRequestIsAuthentic(withSecret("Bearer wrong"))).toBe(false);
    expect(cronRequestIsAuthentic(withSecret(null))).toBe(false);
    expect(cronRequestIsAuthentic(withSecret("s3cret"))).toBe(false);
    set(original);
  });

  it("refuses everything when no secret is configured, rather than falling open", () => {
    // A missing secret is a deployment mistake, and the safe reading of a deployment mistake is
    // "nobody may ring this bell" — not "everybody may".
    set(undefined);
    expect(cronRequestIsAuthentic(withSecret("Bearer anything"))).toBe(false);
    expect(cronRequestIsAuthentic(withSecret(null))).toBe(false);
    set(original);
  });
});

describe("whose day it is", () => {
  const dayIn = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);

  it("labels the day the way Victor's calendar does, not the server's", () => {
    // 04:00 UTC is 21:00 the previous day in Pacific — which is exactly when the evening job
    // runs. Computed in UTC it would ask about tomorrow and stay quiet on an empty today.
    const at9pmPacific = new Date("2026-09-07T04:00:00.000Z");
    expect(localDayBounds(at9pmPacific).label).toBe("2026-09-06");
  });

  it("brackets a whole local day", () => {
    const { start, end, label } = localDayBounds(new Date("2026-09-07T04:00:00.000Z"));
    expect(dayIn(start)).toBe(label);
    expect(dayIn(end)).toBe(label);
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000 - 1);
  });

  it("gets it right on both sides of a daylight-saving change", () => {
    // The bug this prevents is a one-hour window, once, in the dark — which is the kind that
    // gets found months later by a reminder that fired on the wrong day.
    const summer = localDayBounds(new Date("2026-07-15T12:00:00.000Z"));
    const winter = localDayBounds(new Date("2026-12-15T12:00:00.000Z"));
    expect(dayIn(summer.start)).toBe(summer.label);
    expect(dayIn(winter.start)).toBe(winter.label);
    expect(summer.label).toBe("2026-07-15");
    expect(winter.label).toBe("2026-12-15");
  });
});
