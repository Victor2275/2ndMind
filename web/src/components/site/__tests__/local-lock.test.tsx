// @vitest-environment jsdom
import "fake-indexeddb/auto";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { UNLOCKED_AT_KEY } from "@/lib/auth/lock-state";
import type { UnlockOutcome } from "@/lib/auth/local-unlock";

/**
 * The gate itself: whether the app is showing.
 *
 * `verifyAssertion` is tested against real signatures elsewhere. What is left — and what no
 * amount of crypto testing covers — is the wiring: does a locked app actually withhold the
 * page, does a cancelled prompt leave it withheld, and does an unarmed device still open.
 * Each of those is a one-line mistake away from a lock that renders and protects nothing.
 *
 * `unlockLocally` is mocked here because the prompt cannot be raised in jsdom. The ceremony
 * behind it has its own tests with a real key pair.
 */

const unlockLocally = vi.fn<() => Promise<UnlockOutcome>>();

vi.mock("@/lib/auth/local-unlock", () => ({ unlockLocally: () => unlockLocally() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));

const { LocalLock } = await import("../local-lock");
const { openAuthDb, rememberCredential } = await import("@/lib/auth/local-credential");

const CREDENTIAL = {
  id: "Y3JlZGVudGlhbC1pZA",
  jwk: { kty: "EC", crv: "P-256", x: "eA", y: "eQ" },
  alg: -7,
  rpId: "victorgusev.com",
};

async function arm() {
  const db = await openAuthDb();
  await rememberCredential(db, CREDENTIAL);
  db.close();
}

const app = () => (
  <LocalLock>
    <p>Bodyweight 178.4</p>
  </LocalLock>
);

const showsApp = () => screen.queryByText("Bodyweight 178.4") !== null;

beforeEach(() => {
  unlockLocally.mockReset();
  window.sessionStorage.clear();
});

afterEach(async () => {
  const db = await openAuthDb();
  await db.clear("meta");
  db.close();
});

describe("with a passkey cached on this device", () => {
  beforeEach(arm);

  it("withholds the page until a biometric, rather than merely covering it", async () => {
    render(app());

    await screen.findByRole("heading", { name: "Locked" });
    // Not hidden, not blurred — absent. A lock that renders the data and paints over it is
    // one long-press on "select all" away from not being a lock.
    expect(showsApp()).toBe(false);
  });

  it("opens once the assertion checks out", async () => {
    unlockLocally.mockResolvedValue({ status: "unlocked" });
    render(app());

    await userEvent.click(await screen.findByRole("button", { name: /unlock/i }));

    await waitFor(() => expect(showsApp()).toBe(true));
    expect(window.sessionStorage.getItem(UNLOCKED_AT_KEY)).not.toBeNull();
  });

  it("stays shut after a cancelled prompt — the other half of the done-when", async () => {
    unlockLocally.mockResolvedValue({ status: "cancelled" });
    render(app());

    await userEvent.click(await screen.findByRole("button", { name: /unlock/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Cancelled");
    expect(showsApp()).toBe(false);
    expect(window.sessionStorage.getItem(UNLOCKED_AT_KEY)).toBeNull();
  });

  it("stays shut, and says why, when something answers wrongly", async () => {
    unlockLocally.mockResolvedValue({
      status: "refused",
      reason: "the signature did not check out",
    });
    render(app());

    await userEvent.click(await screen.findByRole("button", { name: /unlock/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("signature did not check out");
    expect(showsApp()).toBe(false);
  });

  it("honours an unlock from earlier in this session without asking again", async () => {
    window.sessionStorage.setItem(UNLOCKED_AT_KEY, String(Date.now()));
    render(app());

    await waitFor(() => expect(showsApp()).toBe(true));
    expect(unlockLocally).not.toHaveBeenCalled();
  });

  it("locks again once the unlock has aged out", async () => {
    window.sessionStorage.setItem(UNLOCKED_AT_KEY, String(Date.now() - 10 * 60 * 1000));
    render(app());

    await screen.findByRole("heading", { name: "Locked" });
    expect(showsApp()).toBe(false);
  });
});

describe("with nothing cached", () => {
  it("opens, because an unarmed lock cannot be enforced and must not strand him", async () => {
    // The deliberate fail-open (D-154). Refusing here would mean a device that has never
    // signed in offline can never be used offline — and anyone able to clear IndexedDB to
    // reach this state could read the mirror directly anyway.
    render(app());

    await waitFor(() => expect(showsApp()).toBe(true));
    expect(screen.queryByRole("heading", { name: "Locked" })).toBeNull();
  });
});
