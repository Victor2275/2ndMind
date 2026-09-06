import { describe, expect, it } from "vitest";

import { matches, queryFrom, searchLocalEntries, words } from "@/lib/offline/search";

/**
 * §2.3. The property worth pinning is not that search works — it is **where it differs from the
 * server and by how much**, because the same box answers both and a silent difference in
 * results is the kind of thing that gets acted on.
 *
 * Postgres stems. This does not. What it does instead is match word beginnings with every term
 * required, and every one of those three words is asserted below.
 */

const entry = (searchText: string, occurredAt: string, extra: Record<string, unknown> = {}) => ({
  row: {
    clientId: `${occurredAt}-${searchText.slice(0, 6)}`,
    category: "athletics",
    occurredAt,
    note: "",
    data: {},
    searchText,
    ...extra,
  },
});

describe("what counts as a word", () => {
  it("splits on punctuation, so nothing has to be typed exactly", () => {
    expect(words("Bench Press: 185x5, RPE 8")).toEqual(["bench", "press", "185x5", "rpe", "8"]);
  });

  it("keeps digits, because half this log is numbers", () => {
    // A split, a weight, a course code. Dropping these would make the log unsearchable by the
    // things most worth searching it for.
    expect(words("2:17 split")).toEqual(["2", "17", "split"]);
    expect(words("M51A midterm")).toEqual(["m51a", "midterm"]);
  });

  it("handles accents rather than splitting on them", () => {
    expect(words("café run")).toEqual(["café", "run"]);
  });
});

describe("matching", () => {
  it("finds a word by its beginning", () => {
    // The common case: typing less than the whole word. This is what stands in for stemming.
    expect(matches("went running this morning", "run")).toBe(true);
  });

  it("does not find a word by its middle or its stem", () => {
    // Stated as a test rather than a comment, because it is the honest limit of the feature.
    // Postgres would find both of these; this will not.
    expect(matches("went running this morning", "unn")).toBe(false);
    expect(matches("went running this morning", "ran")).toBe(false);
  });

  it("requires every term, in any order and not adjacent", () => {
    expect(matches("erg 2000m in six pieces", "erg piec")).toBe(true);
    expect(matches("erg 2000m in six pieces", "piec erg")).toBe(true);
    expect(matches("erg 2000m in six pieces", "erg squat")).toBe(false);
  });

  it("ignores case on both sides", () => {
    expect(matches("Bench Press", "bench")).toBe(true);
    expect(matches("bench press", "BENCH")).toBe(true);
  });

  it("matches nothing on an empty query, rather than everything", () => {
    // The failure this prevents: clearing the box and being shown the entire log as though it
    // were a result. The server answers the same way.
    expect(matches("anything at all", "")).toBe(false);
    expect(matches("anything at all", "   ")).toBe(false);
    expect(matches("anything at all", "!!!")).toBe(false);
  });
});

describe("the result list", () => {
  const records = [
    entry("morning erg 2000m", "2026-09-01T08:00:00.000Z"),
    entry("bench press 185", "2026-09-03T08:00:00.000Z"),
    entry("evening erg pieces", "2026-09-02T08:00:00.000Z"),
  ];

  it("returns the newest first, like the server's query", () => {
    const found = searchLocalEntries(records, "erg");
    expect(found.map((e) => e.occurredAt.slice(0, 10))).toEqual(["2026-09-02", "2026-09-01"]);
  });

  it("summarises each entry the way the rest of the app does", () => {
    // The same `summarise` the live log and the cached timeline use, so one entry does not read
    // two different ways depending on which list it appears in.
    const [found] = searchLocalEntries(
      [
        entry("bench", "2026-09-03T08:00:00.000Z", {
          data: { exercise: "Bench Press" },
        }),
      ],
      "bench",
    );
    expect(found.line).toContain("Bench Press");
  });

  it("caps the list the way the server does", () => {
    const many = Array.from({ length: 80 }, (_, i) =>
      entry("erg", `2026-09-${String((i % 28) + 1).padStart(2, "0")}T08:00:00.000Z`),
    );
    expect(searchLocalEntries(many, "erg").length).toBe(50);
  });

  it("returns nothing for an empty query", () => {
    expect(searchLocalEntries(records, "")).toEqual([]);
  });
});

describe("unpacking the term the worker handed over", () => {
  /**
   * The worker answers a failed `/private/log?q=erg` with the shell and passes the whole path
   * it could not reach as `?from=…`. The search term therefore arrives one level down.
   */
  it("reads q out of the path the navigation was aimed at", () => {
    expect(queryFrom("/private/log?q=erg")).toBe("erg");
  });

  it("survives a term containing the characters a URL cares about", () => {
    // A log about "R&D" or "what?" is an ordinary thing to search for, and hand-splitting on
    // "&" or "?" would truncate both.
    expect(queryFrom("/private/log?q=R%26D%20notes")).toBe("R&D notes");
    expect(queryFrom("/private/log?q=what%3F")).toBe("what?");
  });

  it("answers empty when there is no query at all", () => {
    expect(queryFrom("/private/log")).toBe("");
    expect(queryFrom("")).toBe("");
    expect(queryFrom("/private")).toBe("");
  });

  it("trims, so a stray space is not a search", () => {
    expect(queryFrom("/private/log?q=%20%20")).toBe("");
  });
});
