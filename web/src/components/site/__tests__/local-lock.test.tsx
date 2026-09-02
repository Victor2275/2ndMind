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
const { listCredentials, openAuthDb, rememberCredential } =
  await import("@/lib/auth/local-credential");

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

const fetchMock = vi.fn<() => Promise<Response>>();

beforeEach(() => {
  unlockLocally.mockReset();
  window.sessionStorage.clear();
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  // Reset, not just re-stub: `mockResolvedValue` leaves the call history behind, and half of
  // what these assert is how many times the server was asked.
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ credentials: [] }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(async () => {
  vi.unstubAllGlobals();
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

  it("arms itself from the server rather than waiting for the next sign-in", async () => {
    // The bug reported from the phone on 2026-09-03 — "there is no biometric login" (D-157).
    // The key was cached only by the sign-in response, and a session lasts seven days, so a
    // device signed in before the feature shipped never ran that code. The lock sat unarmed,
    // and an unarmed lock opens silently, so there was nothing at all to see.
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ credentials: [CREDENTIAL] }), { status: 200 }),
    );

    render(app());

    await screen.findByRole("heading", { name: "Locked" });
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/local-credentials", expect.anything());
    expect(showsApp()).toBe(false);
  });

  it("keeps what it fetched, so the next launch works with no signal", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ credentials: [CREDENTIAL] }), { status: 200 }),
    );
    render(app());
    await screen.findByRole("heading", { name: "Locked" });

    const db = await openAuthDb();
    const stored = await listCredentials(db);
    db.close();
    expect(stored).toEqual([CREDENTIAL]);
  });

  it("does not ask when there is no signal, and opens rather than hanging", async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    render(app());

    await waitFor(() => expect(showsApp()).toBe(true));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("opens when the session has expired, instead of locking him out of a page he can see", async () => {
    // A 401 here means the server will redirect him to sign in anyway. Refusing to render
    // would replace that redirect with a lock screen no fingerprint can open.
    fetchMock.mockResolvedValue(new Response("{}", { status: 401 }));
    render(app());

    await waitFor(() => expect(showsApp()).toBe(true));
  });

  it("opens when the request itself fails", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    render(app());

    await waitFor(() => expect(showsApp()).toBe(true));
  });
});

describe("with a passkey already cached", () => {
  it("does not ask the server again", async () => {
    // One network request per launch is one too many when the answer is already on the device,
    // and it would also make the lock depend on signal it is supposed to work without.
    await arm();
    render(app());

    await screen.findByRole("heading", { name: "Locked" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
