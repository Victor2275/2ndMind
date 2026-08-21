import { describe, expect, it } from "vitest";

import {
  newSessionPayload,
  signSession,
  verifySession,
  type SessionPayload,
} from "../session";

/**
 * These are the tests that matter most in the codebase. A bug here does not throw or render
 * wrong — it silently lets someone else into the private site, or silently locks Victor out.
 */

const SECRET = "0".repeat(64);
const OTHER = "1".repeat(64);

function payload(overrides: Partial<SessionPayload> = {}): SessionPayload {
  const iat = 1_000_000;
  return { sub: "victor", iat, exp: iat + 3600, ...overrides };
}

describe("round trip", () => {
  it("verifies a token it just signed", async () => {
    const token = await signSession(payload(), SECRET);
    expect(await verifySession(token, SECRET, 1_000_100)).toMatchObject({ sub: "victor" });
  });

  it("issues a session that is valid now and expires later", async () => {
    const fresh = newSessionPayload();
    const now = Math.floor(Date.now() / 1000);
    expect(fresh.exp).toBeGreaterThan(now);
    const token = await signSession(fresh, SECRET);
    expect(await verifySession(token, SECRET)).not.toBeNull();
  });
});

describe("forgery is rejected", () => {
  it("rejects a token signed with a different secret", async () => {
    const token = await signSession(payload(), OTHER);
    expect(await verifySession(token, SECRET, 1_000_100)).toBeNull();
  });

  it("rejects a tampered payload", async () => {
    const token = await signSession(payload(), SECRET);
    const [, signature] = token.split(".");
    // Re-encode a payload claiming a far-future expiry, keeping the original signature.
    const forged = Buffer.from(JSON.stringify(payload({ exp: 9_999_999_999 })))
      .toString("base64url");
    expect(await verifySession(`${forged}.${signature}`, SECRET, 1_000_100)).toBeNull();
  });

  it("rejects an unsigned token", async () => {
    const body = Buffer.from(JSON.stringify(payload())).toString("base64url");
    expect(await verifySession(body, SECRET, 1_000_100)).toBeNull();
    expect(await verifySession(`${body}.`, SECRET, 1_000_100)).toBeNull();
  });

  it("rejects junk without throwing", async () => {
    for (const junk of ["", "...", "a.b.c", "not-base64!.nope", "null.null"]) {
      expect(await verifySession(junk, SECRET, 1_000_100)).toBeNull();
    }
  });

  it("rejects a missing cookie", async () => {
    expect(await verifySession(undefined, SECRET)).toBeNull();
  });
});

describe("expiry is enforced", () => {
  it("rejects a token past its expiry", async () => {
    const token = await signSession(payload(), SECRET);
    expect(await verifySession(token, SECRET, 1_003_601)).toBeNull();
  });

  it("rejects exactly at the expiry second", async () => {
    const token = await signSession(payload(), SECRET);
    expect(await verifySession(token, SECRET, 1_003_600)).toBeNull();
  });

  it("accepts one second before expiry", async () => {
    const token = await signSession(payload(), SECRET);
    expect(await verifySession(token, SECRET, 1_003_599)).not.toBeNull();
  });

  it("rejects a payload with no expiry at all", async () => {
    const token = await signSession({ sub: "victor", iat: 1 } as SessionPayload, SECRET);
    expect(await verifySession(token, SECRET, 2)).toBeNull();
  });
});
