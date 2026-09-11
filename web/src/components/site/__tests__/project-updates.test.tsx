import { describe, expect, it } from "vitest";

import { formatUpdateDate, relativeUpdateDate } from "@/components/site/project-updates";

/**
 * Update dates (V4 item 6.6, Q338).
 *
 * The absolute date is what the page shows; the relative form rides along in `title`. Both are
 * pure functions, and both have a timezone trap behind them worth pinning.
 */
describe("formatUpdateDate", () => {
  it("does not slip a day west of Greenwich", () => {
    // The reason `T12:00:00Z` exists. A bare `new Date("2026-08-25")` is midnight UTC, which is
    // the 24th in Los Angeles — where this site is built and read.
    expect(formatUpdateDate("2026-08-25")).toBe("25 Aug 2026");
    expect(formatUpdateDate("2026-01-01")).toBe("1 Jan 2026");
  });
});

describe("relativeUpdateDate", () => {
  const now = new Date("2026-09-10T12:00:00Z");

  it("names the recent past in the units a reader thinks in", () => {
    expect(relativeUpdateDate("2026-09-10", now)).toBe("today");
    expect(relativeUpdateDate("2026-09-09", now)).toBe("yesterday");
    expect(relativeUpdateDate("2026-09-07", now)).toBe("3 days ago");
    expect(relativeUpdateDate("2026-09-03", now)).toBe("1 week ago");
    expect(relativeUpdateDate("2026-08-20", now)).toBe("3 weeks ago");
  });

  it("moves up to months and years", () => {
    expect(relativeUpdateDate("2026-07-10", now)).toBe("2 months ago");
    expect(relativeUpdateDate("2025-09-10", now)).toBe("1 year ago");
    expect(relativeUpdateDate("2023-09-10", now)).toBe("3 years ago");
  });

  it("says so rather than counting backwards for a future date", () => {
    // A dated update ahead of today is a typo in the vault, and "-4 days ago" is a worse way to
    // find out than a word that reads as deliberate.
    expect(relativeUpdateDate("2026-09-14", now)).toBe("scheduled");
  });

  it("never renders a bare plural for one", () => {
    expect(relativeUpdateDate("2026-09-03", now)).not.toContain("1 weeks");
    expect(relativeUpdateDate("2026-08-11", now)).not.toContain("1 months");
  });
});
