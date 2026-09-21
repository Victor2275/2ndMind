import { describe, expect, it } from "vitest";

import { markTerms, terms } from "@/lib/log/highlight";

/** The marked text, joined — what a reader would see as emphasised. */
const hits = (text: string, query: string) =>
  markTerms(text, query)
    .filter((segment) => segment.hit)
    .map((segment) => segment.text);

/** Everything, joined — must always equal the input, or the line has been rewritten. */
const whole = (text: string, query: string) =>
  markTerms(text, query)
    .map((segment) => segment.text)
    .join("");

describe("marking what matched (Q404)", () => {
  it("marks the searched word wherever it appears", () => {
    expect(hits("Bench press, 3 sets", "bench")).toEqual(["Bench"]);
  });

  it("ignores case in both directions", () => {
    expect(hits("bench press", "BENCH")).toEqual(["bench"]);
  });

  it("marks the whole word when the query is its stem", () => {
    // `plainto_tsquery` matched this row on a stem, so a search for `run` that marked nothing
    // in "running" would look like the wrong row came back.
    expect(hits("Easy running, 5k", "run")).toEqual(["running"]);
  });

  it("marks each term of a multi-word query", () => {
    expect(hits("Bench press and squat", "bench squat")).toEqual(["Bench", "squat"]);
  });

  it("prefers the longer term where two overlap", () => {
    expect(hits("benchmark", "bench benchmark")).toEqual(["benchmark"]);
  });

  it("never marks mid-word", () => {
    // Without the word-boundary guard, "erg" marks the middle of "energy", which reads as a
    // match the database did not make.
    expect(hits("energy was low", "erg")).toEqual([]);
  });

  it("drops one-character terms", () => {
    expect(terms("a bench")).toEqual(["bench"]);
    expect(hits("a bench", "a")).toEqual([]);
  });

  it("treats a regex as text", () => {
    // A search box is a text field. `c++` compiling as a pattern would throw on the server and
    // take the page with it.
    expect(() => markTerms("wrote some c++ today", "c++")).not.toThrow();
    expect(hits("wrote some c++ today", "c++")).toEqual(["c++"]);
  });

  it("keeps the line intact, always", () => {
    const text = "Row (Erg) — 2000m at 1:58.4, felt strong";
    expect(whole(text, "erg 2000")).toBe(text);
    expect(whole(text, "")).toBe(text);
    expect(whole("", "erg")).toBe("");
  });

  it("returns one unmarked segment when nothing matches", () => {
    expect(markTerms("Bench press", "squat")).toEqual([{ text: "Bench press", hit: false }]);
  });
});
