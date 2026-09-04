// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  clean,
  coarseAgent,
  errorReportSchema,
  fingerprintOf,
  MAX_MESSAGE,
  MAX_STACK,
  safeRoute,
  scrub,
} from "@/lib/errors/report";

/**
 * What a crash report may contain (V3 §2.4, D-165).
 *
 * A crash report is the one payload in this app nobody wrote on purpose. Every other write is a
 * person deciding to record something; this one is assembled by machinery out of whatever
 * happened to be in scope when something broke — and what is in scope on a private page is a
 * GPA, per-course grades, bodyweight and a phone number.
 *
 * So the tests below are mostly about **what does not get through**, and they are deliberately
 * blunt. The failure they guard against is silent by construction: nobody reads a crash report
 * expecting to find a phone number in it, which is exactly why one would sit there.
 */

describe("scrubbing", () => {
  it("redacts an email address", () => {
    expect(scrub("failed for gusev0219@gmail.com")).toBe("failed for [email]");
  });

  it("redacts a phone number in the shapes it actually appears in", () => {
    for (const number of ["+1 (310) 555-0143", "310-555-0143", "3105550143"]) {
      expect(scrub(`called ${number} and failed`), number).not.toContain("555");
    }
  });

  it("redacts the value of anything that names itself a secret", () => {
    const text = scrub("GET /x?token=abc123def456 failed");
    expect(text).toContain("token=[redacted]");
    expect(text).not.toContain("abc123def456");
  });

  it("redacts a long opaque string, which is what a bearer token looks like", () => {
    const token = "a".repeat(60);
    expect(scrub(`Authorization ${token}`)).not.toContain(token);
  });

  it("leaves an ordinary error message alone", () => {
    // Over-scrubbing has a cost too: a message with the useful part removed is a report that
    // wastes the reader's time and gets ignored.
    const message = "Cannot read properties of undefined (reading 'exercise')";
    expect(scrub(message)).toBe(message);
  });

  it("does not mangle a short number, which is usually the useful part", () => {
    expect(scrub("expected 3 rows, got 0")).toBe("expected 3 rows, got 0");
  });
});

describe("routes", () => {
  it("drops the query string, which is where identifying things end up", () => {
    // `?from=`, a search term, an id. Never worth enough to a crash report to keep.
    expect(safeRoute("/private/log?q=bench+press")).toBe("/private/log");
    expect(safeRoute("/cached?from=%2Fprivate%2Fathletics")).toBe("/cached");
  });

  it("drops the hash too", () => {
    expect(safeRoute("/projects/proof#results")).toBe("/projects/proof");
  });

  it("reduces an absolute URL to its path", () => {
    expect(safeRoute("https://victorgusev.com/private/athletics")).toBe("/private/athletics");
  });

  it("does not throw on junk", () => {
    expect(() => safeRoute("::::")).not.toThrow();
  });
});

describe("the user agent", () => {
  it("keeps only the platform, because the full string is a fingerprint", () => {
    // The only question a crash report needs it to answer is "is this the phone or the
    // laptop" — two very different problems with two different fixes.
    expect(coarseAgent("Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36")).toBe(
      "Android",
    );
    expect(coarseAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("Windows");
    expect(coarseAgent("something else entirely")).toBe("other");
  });

  it("never returns the string it was given", () => {
    const ua = "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36";
    expect(coarseAgent(ua)).not.toContain("SM-S918B");
  });
});

describe("grouping", () => {
  it("gives two occurrences of the same problem one identity", () => {
    const a = fingerprintOf({ source: "browser", name: "TypeError", message: "x is undefined" });
    const b = fingerprintOf({ source: "browser", name: "TypeError", message: "x is undefined" });
    expect(a).toBe(b);
  });

  it("ignores the numbers inside a message, so a loop is one problem and not a thousand", () => {
    // `...at row 41` and `...at row 42` are the same broken thing. The entire value of
    // grouping is that ten thousand copies of one bug read as one line.
    const a = fingerprintOf({ source: "browser", name: "TypeError", message: "failed at row 41" });
    const b = fingerprintOf({ source: "browser", name: "TypeError", message: "failed at row 42" });
    expect(a).toBe(b);
  });

  it("ignores quoted values for the same reason", () => {
    const a = fingerprintOf({ source: "browser", name: "Error", message: `no such id "abc"` });
    const b = fingerprintOf({ source: "browser", name: "Error", message: `no such id "def"` });
    expect(a).toBe(b);
  });

  it("keeps genuinely different problems apart", () => {
    const base = { name: "TypeError", message: "x is undefined" };
    expect(fingerprintOf({ ...base, source: "browser" })).not.toBe(
      fingerprintOf({ ...base, source: "worker" }),
    );
    expect(fingerprintOf({ ...base, source: "browser", route: "/private/log" })).not.toBe(
      fingerprintOf({ ...base, source: "browser", route: "/private/athletics" }),
    );
  });

  it("leaves the stack out, so a deploy does not look like a crop of new errors", () => {
    // Chunk names are content-hashed, so stack text changes on every build even when nothing
    // did. Including it would make the panel useless the day after every deploy.
    const message = "x is undefined";
    const one = clean({
      source: "browser",
      name: "TypeError",
      message,
      stack: "at chunk-aaaa.js:1:1",
      route: "/private",
      buildId: "aaa",
      agent: "",
    });
    const two = clean({
      source: "browser",
      name: "TypeError",
      message,
      stack: "at chunk-bbbb.js:9:9",
      route: "/private",
      buildId: "bbb",
      agent: "",
    });

    expect(one.fingerprint).toBe(two.fingerprint);
  });
});

describe("cleaning, end to end", () => {
  const raw = {
    source: "browser" as const,
    name: "TypeError",
    message: "failed to reach gusev0219@gmail.com from 310-555-0143",
    stack: `at load (/private/academics?gpa=3.8)\nsecret=hunter2`,
    route: "https://victorgusev.com/private/academics?gpa=3.8",
    buildId: "abcdef123456",
    agent: "Mozilla/5.0 (Linux; Android 14; SM-S918B)",
  };

  it("scrubs the message and the stack, not just the message", () => {
    const report = clean(raw);
    expect(report.message).not.toContain("gmail.com");
    expect(report.message).not.toContain("555");
    expect(report.stack).toContain("secret=[redacted]");
    expect(report.stack).not.toContain("hunter2");
  });

  it("strips the query from the route, so a GPA in a URL never lands in the table", () => {
    expect(clean(raw).route).toBe("/private/academics");
    expect(clean(raw).route).not.toContain("3.8");
  });

  it("coarsens the agent", () => {
    expect(clean(raw).agent).toBe("Android");
  });

  it("stays fast on a huge stack, because the endpoint is open to the network", () => {
    // Found by this test timing out under load, not by reading the code. `[\w.+-]+@…` is
    // quadratic in the length of a word-character run: on 50KB of them — which a deep
    // recursion's stack really is — it cost about a second of CPU. Scrubbing before truncating
    // therefore handed an unauthenticated endpoint a way to burn a core per request, and did
    // the same on the phone, inside the error handler.
    const huge = {
      ...raw,
      message: "x".repeat(200_000),
      stack: "y".repeat(200_000),
    };

    const started = performance.now();
    const report = clean(huge);
    const elapsed = performance.now() - started;

    expect(report.stack.length).toBeLessThanOrEqual(MAX_STACK);
    // Generous, because CI machines vary. The bug was ~1000ms on 50KB and this input is four
    // times that; anything near the old behaviour fails by orders of magnitude.
    expect(elapsed).toBeLessThan(250);
  });

  it("caps the long fields", () => {
    const report = clean({
      ...raw,
      message: "x".repeat(5_000),
      stack: "y".repeat(50_000),
    });

    expect(report.message.length).toBeLessThanOrEqual(MAX_MESSAGE);
    expect(report.stack.length).toBeLessThanOrEqual(MAX_STACK);
  });
});

describe("the schema is an allowlist", () => {
  it("drops fields it does not know about", () => {
    // A blocklist would be the natural design and would be wrong: it fails open, silently, on
    // exactly the data the vault is careful about.
    const parsed = errorReportSchema.parse({
      source: "browser",
      name: "TypeError",
      message: "x",
      gpa: 3.8,
      phone: "310-555-0143",
    });

    expect(parsed).not.toHaveProperty("gpa");
    expect(parsed).not.toHaveProperty("phone");
  });

  it("refuses a source it does not recognise", () => {
    expect(errorReportSchema.safeParse({ source: "somewhere-else" }).success).toBe(false);
  });

  it("refuses an over-long field rather than truncating it silently", () => {
    // Truncation at the boundary would accept a 50KB POST and do work on it. The endpoint
    // rejects instead, and `clean` does the truncating on the honest path.
    expect(
      errorReportSchema.safeParse({ source: "browser", message: "x".repeat(5_000) }).success,
    ).toBe(false);
  });
});
