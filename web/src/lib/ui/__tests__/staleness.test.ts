import { describe, expect, it } from "vitest";

import * as outbox from "@/lib/sync/outbox-view";
import { AGING_MS, STALE_MS, approximateAge, exactMoment, gradeAge } from "@/lib/ui/staleness";

/**
 * The one age vocabulary (V4 §5.1).
 *
 * The behaviour of `approximateAge` is pinned in `lib/sync/__tests__/outbox-view.test.ts`,
 * where it was written and where it is still exercised through the re-export. What is tested
 * here is what §5.1 actually claims: that there is **one** of it, that the grades have the
 * shape the badge relies on, and that the stale line the badge draws is the same line the
 * outbox draws. Two constants spelling one threshold is how a badge and the screen it links to
 * come to disagree, and it is invisible until they do.
 */

describe("one definition, not two", () => {
  it("is the same function the outbox uses", () => {
    expect(outbox.approximateAge).toBe(approximateAge);
  });

  it("draws stale at the same line the outbox does", () => {
    expect(outbox.STALE_MS).toBe(STALE_MS);
  });
});

describe("gradeAge", () => {
  it("has three grades, and the boundaries are inclusive at the top", () => {
    expect(gradeAge(0)).toBe("fresh");
    expect(gradeAge(AGING_MS - 1)).toBe("fresh");
    expect(gradeAge(AGING_MS)).toBe("aging");
    expect(gradeAge(STALE_MS - 1)).toBe("aging");
    expect(gradeAge(STALE_MS)).toBe("stale");
  });

  it("takes per-subject thresholds", () => {
    // The offline mirror is `aging` at six hours and `stale` at two days (`lib/offline/panels`),
    // which is a different judgement from an outbox op's and deliberately so.
    const SIX_HOURS = 6 * 60 * 60 * 1000;
    const TWO_DAYS = 48 * 60 * 60 * 1000;
    expect(gradeAge(SIX_HOURS, { aging: SIX_HOURS, stale: TWO_DAYS })).toBe("aging");
    expect(gradeAge(TWO_DAYS, { aging: SIX_HOURS, stale: TWO_DAYS })).toBe("stale");
  });

  it("never reports a negative age as stale", () => {
    // A device whose clock is ahead of the server's produces one. Reading it as "stale" would
    // put an amber badge on the freshest possible data.
    expect(gradeAge(-5_000)).toBe("fresh");
  });
});

describe("exactMoment", () => {
  it("formats in Los Angeles whatever the runtime's zone is", () => {
    // 20:00 UTC on 2026-09-19 is 1:00 PM in Los Angeles. A server in us-east-1 formatting in
    // its own zone is how a 9pm entry renders as tomorrow.
    expect(exactMoment(Date.UTC(2026, 8, 19, 20, 0, 0))).toBe("Sep 19, 1:00 PM");
  });

  it("takes a Date or a number", () => {
    const at = Date.UTC(2026, 8, 19, 20, 0, 0);
    expect(exactMoment(new Date(at))).toBe(exactMoment(at));
  });
});
