import { describe, expect, it } from "vitest";

import { normaliseSheetUrl } from "../load";

/**
 * The URL Victor will actually paste is the one in his address bar, which is an `/edit` link
 * that serves HTML behind a login. These assert it is converted rather than rejected — and,
 * just as importantly, that a URL which already works is left alone.
 */
describe("normaliseSheetUrl", () => {
  const ID = "1AbC-dEfGhIjKlMnOpQrStUvWxYz0123456789_x";

  it("converts an ordinary edit link, keeping the tab", () => {
    expect(normaliseSheetUrl(`https://docs.google.com/spreadsheets/d/${ID}/edit#gid=847`)).toBe(
      `https://docs.google.com/spreadsheets/d/${ID}/export?format=csv&gid=847`,
    );
  });

  it("converts an edit link with query junk Google appends", () => {
    expect(
      normaliseSheetUrl(
        `https://docs.google.com/spreadsheets/d/${ID}/edit?usp=sharing&gid=0#gid=0`,
      ),
    ).toBe(`https://docs.google.com/spreadsheets/d/${ID}/export?format=csv&gid=0`);
  });

  it("converts a link with no tab id, letting Google pick the first sheet", () => {
    expect(normaliseSheetUrl(`https://docs.google.com/spreadsheets/d/${ID}/edit`)).toBe(
      `https://docs.google.com/spreadsheets/d/${ID}/export?format=csv`,
    );
  });

  it("leaves a published CSV link alone", () => {
    // The documented path. It must survive untouched, or the instructions in
    // docs/UPLOADS_NEEDED.md stop being true.
    const pub = "https://docs.google.com/spreadsheets/d/e/2PACX-1vABC/pub?gid=0&single=true&output=csv";
    expect(normaliseSheetUrl(pub)).toBe(pub);
  });

  it("adds output=csv to a published link that omitted it", () => {
    expect(
      normaliseSheetUrl("https://docs.google.com/spreadsheets/d/e/2PACX-1vABC/pub?gid=5"),
    ).toBe("https://docs.google.com/spreadsheets/d/e/2PACX-1vABC/pub?output=csv&gid=5");
  });

  it("leaves an export link alone", () => {
    const url = `https://docs.google.com/spreadsheets/d/${ID}/export?format=csv&gid=2`;
    expect(normaliseSheetUrl(url)).toBe(url);
  });

  it("leaves a gviz CSV link alone", () => {
    const url = `https://docs.google.com/spreadsheets/d/${ID}/gviz/tq?tqx=out:csv`;
    expect(normaliseSheetUrl(url)).toBe(url);
  });

  it("passes a non-Google URL through untouched", () => {
    // Someone may host the CSV anywhere. Nothing here should assume Google.
    const url = "https://example.com/applications.csv";
    expect(normaliseSheetUrl(url)).toBe(url);
  });

  it("trims surrounding whitespace, which a paste usually carries", () => {
    expect(normaliseSheetUrl(`  https://example.com/a.csv \n`)).toBe("https://example.com/a.csv");
  });
});
