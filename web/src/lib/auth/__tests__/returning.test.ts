import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { hasReturningCookie, RETURNING_COOKIE } from "../returning";

/**
 * The returning hint is the one value in this codebase that looks like auth and is not.
 *
 * These tests exist to keep it that way. The parsing cases are ordinary; the last one is the
 * important one, and it is a grep rather than a unit test on purpose.
 */

describe("hasReturningCookie", () => {
  it("finds it as the only cookie", () => {
    expect(hasReturningCookie(`${RETURNING_COOKIE}=1`)).toBe(true);
  });

  it("finds it among others, first, middle and last", () => {
    expect(hasReturningCookie(`${RETURNING_COOKIE}=1; a=2; b=3`)).toBe(true);
    expect(hasReturningCookie(`a=2; ${RETURNING_COOKIE}=1; b=3`)).toBe(true);
    expect(hasReturningCookie(`a=2; b=3; ${RETURNING_COOKIE}=1`)).toBe(true);
  });

  it("is false for an empty cookie string", () => {
    expect(hasReturningCookie("")).toBe(false);
  });

  it("does not match a cookie whose name merely ends with this one", () => {
    // `not_2m_returning=1` contains the full name as a substring. An unanchored test would
    // match it, and the link would appear for a visitor who had never signed in.
    expect(hasReturningCookie(`not_${RETURNING_COOKIE}=1`)).toBe(false);
  });

  it("does not match the name appearing inside another cookie's value", () => {
    expect(hasReturningCookie(`other=${RETURNING_COOKIE}=1`)).toBe(false);
  });

  it("is false once cleared to a different value", () => {
    // Sign-out deletes it, but a browser or proxy may leave an empty value behind.
    expect(hasReturningCookie(`${RETURNING_COOKIE}=`)).toBe(false);
    expect(hasReturningCookie(`${RETURNING_COOKIE}=0`)).toBe(false);
  });
});

describe("the hint never gates anything", () => {
  it("is read only by the module that defines it and the link that draws it", () => {
    // This is the whole safety property. If this cookie is ever consulted by `proxy.ts`, a
    // Server Action, a loader, or `dal.ts`, it stops being a hint and becomes an
    // authentication bypass made of a boolean — anyone can set it from the console.
    //
    // A grep rather than a unit test because the failure is a *new call site* somewhere else
    // in the tree, which no test of this module could ever notice.
    const allowed = new Set([
      path.join("src", "lib", "auth", "returning.ts"),
      path.join("src", "components", "site", "private-link.tsx"),
      path.join("src", "app", "api", "auth", "login", "route.ts"),
      path.join("src", "lib", "auth", "__tests__", "returning.test.ts"),
      path.join("src", "components", "site", "__tests__", "private-link.test.tsx"),
    ]);

    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (/\.tsx?$/.test(entry.name)) {
          const text = fs.readFileSync(full, "utf8");
          if (
            (text.includes("RETURNING_COOKIE") ||
              text.includes("hasReturningCookie") ||
              text.includes("2m_returning")) &&
            !allowed.has(path.relative(process.cwd(), full))
          ) {
            offenders.push(path.relative(process.cwd(), full));
          }
        }
      }
    };
    walk(path.join(process.cwd(), "src"));

    expect(offenders).toEqual([]);
  });
});
