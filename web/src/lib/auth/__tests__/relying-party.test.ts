import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { relyingParty, relyingPartyProblem } from "../config";

/**
 * The relying party is the piece that locks Victor out of his own site when it is wrong, and
 * it fails with an error message that says nothing useful. It broke once for real: the domain
 * moved to `www.victorgusev.com` while `NEXT_PUBLIC_SITE_URL` still said
 * `victorgusev.vercel.app`, so the app expected one origin and the browser sent another.
 *
 * These are the cases that matter, in the order they bite.
 */

beforeEach(() => {
  vi.unstubAllEnvs();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("relyingParty", () => {
  it("scopes the credential to the apex, not to www", () => {
    // rpID may be any registrable-domain suffix of the origin, so an apex credential works on
    // www — but a www credential does not work on the apex. The apex is strictly better.
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.victorgusev.com");
    expect(relyingParty().rpID).toBe("victorgusev.com");

    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://victorgusev.com");
    expect(relyingParty().rpID).toBe("victorgusev.com");
  });

  it("accepts both the apex and www as origins, whichever is configured", () => {
    // Which of the two is primary is a Vercel setting that can be flipped in one click. A
    // single expected origin made that click a lockout.
    for (const configured of ["https://victorgusev.com", "https://www.victorgusev.com"]) {
      vi.stubEnv("NEXT_PUBLIC_SITE_URL", configured);
      const { origins } = relyingParty();
      expect(origins).toContain("https://victorgusev.com");
      expect(origins).toContain("https://www.victorgusev.com");
    }
  });

  it("does not repeat an origin", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://victorgusev.com");
    const { origins } = relyingParty();
    expect(new Set(origins).size).toBe(origins.length);
  });

  it("keeps the port on localhost", () => {
    // `url.origin` preserves it; rebuilding the string from the hostname would silently drop
    // it, and a passkey ceremony against http://localhost would then fail in development only.
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
    const { rpID, origins } = relyingParty();
    expect(rpID).toBe("localhost");
    expect(origins).toEqual(["http://localhost:3000"]);
  });

  it("invents no www sibling for a bare IP", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://192.168.1.10:3000");
    const { rpID, origins } = relyingParty();
    expect(rpID).toBe("192.168.1.10");
    expect(origins).toEqual(["http://192.168.1.10:3000"]);
  });

  it("never returns an rpID carrying a scheme or port", () => {
    // rpID is a bare hostname. Anything else is rejected by the browser with a DOMException
    // that does not say which field was wrong.
    for (const configured of [
      "https://www.victorgusev.com",
      "https://victorgusev.com",
      "http://localhost:3000",
    ]) {
      vi.stubEnv("NEXT_PUBLIC_SITE_URL", configured);
      const { rpID } = relyingParty();
      expect(rpID).not.toContain(":");
      expect(rpID).not.toContain("/");
    }
  });
});

describe("relyingPartyProblem", () => {
  it("catches the exact failure that happened in production", () => {
    // NEXT_PUBLIC_SITE_URL unset in Vercel, so the old fallback made rpID "localhost" and the
    // browser said: The RP ID "localhost" is invalid for this domain. That message names a
    // value nobody configured and never mentions the variable that produced it.
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
    const problem = relyingPartyProblem("https://victorgusev.com");
    expect(problem).toContain("NEXT_PUBLIC_SITE_URL");
    expect(problem).toContain("https://victorgusev.com");
    expect(problem).toContain("localhost");
  });

  it("says the variable is unset when it is", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", undefined);
    expect(relyingPartyProblem("https://example.com")).toContain("(unset)");
  });

  it("is silent when the origin matches, apex or www", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://victorgusev.com");
    expect(relyingPartyProblem("https://victorgusev.com")).toBeNull();
    expect(relyingPartyProblem("https://www.victorgusev.com")).toBeNull();
  });

  it("is silent when there is no Origin header to check", () => {
    // A same-origin GET may omit it. Refusing to serve on a missing header would break the
    // ceremony in the name of protecting it.
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://victorgusev.com");
    expect(relyingPartyProblem(null)).toBeNull();
  });

  it("catches a scheme mismatch, not just a hostname one", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://victorgusev.com");
    expect(relyingPartyProblem("http://victorgusev.com")).not.toBeNull();
  });
});
