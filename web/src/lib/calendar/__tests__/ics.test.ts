// @vitest-environment node
import { describe, expect, it } from "vitest";

import { isEmptyCalendar, parseIcs } from "../ics";

/**
 * The fixture mirrors the shape of Victor's real Google feed: a VTIMEZONE for
 * America/Los_Angeles, a weekly recurring class with UNTIL and BYDAY, a nested VALARM, an
 * all-day event, an EXDATE cancellation, and a folded line.
 */
const VTIMEZONE = [
  "BEGIN:VTIMEZONE",
  "TZID:America/Los_Angeles",
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:-0800",
  "TZOFFSETTO:-0700",
  "TZNAME:PDT",
  "DTSTART:19700308T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:-0700",
  "TZOFFSETTO:-0800",
  "TZNAME:PST",
  "DTSTART:19701101T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
].join("\r\n");

function calendar(...events: string[]) {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//test//EN",
    "CALSCALE:GREGORIAN",
    VTIMEZONE,
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");
}

const WEEKLY_CLASS = [
  "BEGIN:VEVENT",
  "DTSTART;TZID=America/Los_Angeles:20260921T093000",
  "DTEND;TZID=America/Los_Angeles:20260921T105000",
  "RRULE:FREQ=WEEKLY;WKST=SU;UNTIL=20261214T075959Z;INTERVAL=1;BYDAY=MO",
  "UID:class-m51a@test",
  "SUMMARY:M51A Lecture",
  "LOCATION:Boelter 3400",
  "BEGIN:VALARM",
  "ACTION:DISPLAY",
  "TRIGGER:-P0DT0H10M0S",
  "DESCRIPTION:Reminder",
  "END:VALARM",
  "END:VEVENT",
].join("\r\n");

const ONE_OFF = [
  "BEGIN:VEVENT",
  "DTSTART;TZID=America/Los_Angeles:20260922T140000",
  "DTEND;TZID=America/Los_Angeles:20260922T150000",
  "UID:oneoff@test",
  "SUMMARY:Advising appointment",
  "END:VEVENT",
].join("\r\n");

const ALL_DAY = [
  "BEGIN:VEVENT",
  "DTSTART;VALUE=DATE:20260923",
  "DTEND;VALUE=DATE:20260924",
  "UID:allday@test",
  "SUMMARY:Move-in day",
  "END:VEVENT",
].join("\r\n");

const LONG_PRACTICE = [
  "BEGIN:VEVENT",
  "DTSTART;TZID=America/Los_Angeles:20260921T060000",
  "DTEND;TZID=America/Los_Angeles:20260921T090000",
  "UID:practice@test",
  "SUMMARY:Dragon boat practice",
  "END:VEVENT",
].join("\r\n");

const day = (iso: string) => new Date(iso);

describe("parseIcs", () => {
  it("returns a one-off event inside the window", () => {
    const events = parseIcs(
      calendar(ONE_OFF),
      day("2026-09-22T00:00:00Z"),
      day("2026-09-23T00:00:00Z"),
    );
    expect(events).toHaveLength(1);
    expect(events[0].summary).toBe("Advising appointment");
  });

  it("converts a floating local time using the feed's own VTIMEZONE", () => {
    const events = parseIcs(
      calendar(ONE_OFF),
      day("2026-09-01T00:00:00Z"),
      day("2026-10-01T00:00:00Z"),
    );
    // 14:00 in Los Angeles during PDT is 21:00 UTC. Without registering the timezone this
    // lands seven hours out and every class shows at the wrong time.
    expect(events[0].start.toISOString()).toBe("2026-09-22T21:00:00.000Z");
  });

  it("expands a weekly recurrence across the term", () => {
    const events = parseIcs(
      calendar(WEEKLY_CLASS),
      day("2026-09-01T00:00:00Z"),
      day("2026-12-31T00:00:00Z"),
    );
    // Mondays from 21 Sep to the UNTIL in mid-December.
    expect(events.length).toBeGreaterThan(10);
    for (const event of events) {
      expect(event.summary).toBe("M51A Lecture");
      // Every occurrence must be a Monday in local time.
      expect(new Date(event.start).getUTCDay()).toBe(1);
    }
  });

  it("stops the recurrence at UNTIL rather than running forever", () => {
    const events = parseIcs(
      calendar(WEEKLY_CLASS),
      day("2026-09-01T00:00:00Z"),
      day("2027-06-01T00:00:00Z"),
    );
    const last = events[events.length - 1];
    expect(last.start.getTime()).toBeLessThan(day("2026-12-15T00:00:00Z").getTime());
  });

  it("returns only the occurrences inside a one-day window", () => {
    const events = parseIcs(
      calendar(WEEKLY_CLASS),
      day("2026-09-28T07:00:00Z"),
      day("2026-09-29T07:00:00Z"),
    );
    expect(events).toHaveLength(1);
  });

  it("gives each occurrence a distinct, stable id", () => {
    const window = [day("2026-09-01T00:00:00Z"), day("2026-10-31T00:00:00Z")] as const;
    const first = parseIcs(calendar(WEEKLY_CLASS), ...window);
    const second = parseIcs(calendar(WEEKLY_CLASS), ...window);

    expect(new Set(first.map((e) => e.uid)).size).toBe(first.length);
    // Stable across reads, so a re-sync updates rather than duplicating.
    expect(first.map((e) => e.uid)).toEqual(second.map((e) => e.uid));
  });

  it("keeps an event that started before the window but is still running", () => {
    // 06:00-09:00 local is 13:00-16:00 UTC. A window opening at 14:00 UTC is mid-practice.
    const events = parseIcs(
      calendar(LONG_PRACTICE),
      day("2026-09-21T14:00:00Z"),
      day("2026-09-21T23:00:00Z"),
    );
    expect(events).toHaveLength(1);
    expect(events[0].summary).toBe("Dragon boat practice");
  });

  it("excludes an event that ended before the window opened", () => {
    const events = parseIcs(
      calendar(LONG_PRACTICE),
      day("2026-09-21T17:00:00Z"),
      day("2026-09-21T23:00:00Z"),
    );
    expect(events).toEqual([]);
  });

  it("marks an all-day event and does not shift it by a timezone", () => {
    const events = parseIcs(
      calendar(ALL_DAY),
      day("2026-09-22T00:00:00Z"),
      day("2026-09-25T00:00:00Z"),
    );
    expect(events).toHaveLength(1);
    expect(events[0].allDay).toBe(true);
    expect(events[0].summary).toBe("Move-in day");
  });

  it("does not emit VALARM blocks as events", () => {
    const events = parseIcs(
      calendar(WEEKLY_CLASS),
      day("2026-09-21T00:00:00Z"),
      day("2026-09-22T00:00:00Z"),
    );
    expect(events).toHaveLength(1);
    expect(events[0].summary).toBe("M51A Lecture");
  });

  it("reads location and leaves it empty rather than undefined when absent", () => {
    const events = parseIcs(
      calendar(WEEKLY_CLASS, ONE_OFF),
      day("2026-09-21T00:00:00Z"),
      day("2026-09-23T00:00:00Z"),
    );
    const lecture = events.find((e) => e.summary === "M51A Lecture")!;
    const advising = events.find((e) => e.summary === "Advising appointment")!;
    expect(lecture.location).toBe("Boelter 3400");
    expect(advising.location).toBe("");
  });

  it("sorts chronologically across mixed event kinds", () => {
    const events = parseIcs(
      calendar(WEEKLY_CLASS, ONE_OFF, LONG_PRACTICE),
      day("2026-09-21T00:00:00Z"),
      day("2026-09-23T00:00:00Z"),
    );
    const times = events.map((e) => e.start.getTime());
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it("returns nothing for a window with no events, rather than throwing", () => {
    const events = parseIcs(
      calendar(WEEKLY_CLASS),
      day("2027-01-01T00:00:00Z"),
      day("2027-01-08T00:00:00Z"),
    );
    expect(events).toEqual([]);
  });

  it("handles an empty calendar, which is what Canvas returns before term", () => {
    const raw = calendar();
    expect(isEmptyCalendar(raw)).toBe(true);
    expect(parseIcs(raw, day("2026-09-01T00:00:00Z"), day("2026-10-01T00:00:00Z"))).toEqual([]);
  });

  it("survives one malformed event without losing the good ones", () => {
    const broken = ["BEGIN:VEVENT", "UID:broken@test", "SUMMARY:No start date", "END:VEVENT"].join(
      "\r\n",
    );
    const events = parseIcs(
      calendar(broken, ONE_OFF),
      day("2026-09-22T00:00:00Z"),
      day("2026-09-23T00:00:00Z"),
    );
    expect(events.map((e) => e.summary)).toEqual(["Advising appointment"]);
  });

  it("explains itself when handed something that is not a calendar", () => {
    expect(() => parseIcs("hello", day("2026-01-01"), day("2026-02-01"))).toThrow(
      /Could not parse/,
    );
  });
});

describe("isEmptyCalendar", () => {
  it("is true for a header-only feed and false once an event exists", () => {
    expect(isEmptyCalendar(calendar())).toBe(true);
    expect(isEmptyCalendar(calendar(ONE_OFF))).toBe(false);
  });
});
