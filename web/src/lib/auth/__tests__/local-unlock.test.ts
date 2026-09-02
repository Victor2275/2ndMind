// @vitest-environment node
import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  forgetCredentials,
  listCredentials,
  openAuthDb,
  rememberCredential,
} from "@/lib/auth/local-credential";
import { unlockLocally, type Authenticator } from "@/lib/auth/local-unlock";
import { fakeAuthenticator, type FakeAuthenticator } from "@/test/webauthn";

/**
 * The unlock ceremony end to end, with a real key pair on the other side of the prompt.
 *
 * `authenticate` is injected for the same reason `post` is in the sync engine: the branches
 * that matter here are a cancelled prompt, a wrong key and a replayed assertion, and none of
 * them can be staged by holding a phone. What is *not* faked is the signature — the fake
 * authenticator signs for real, so a verifier that accepted anything would fail here.
 */

const RP_ID = "victorgusev.com";
const ORIGIN = "https://victorgusev.com";

let device: FakeAuthenticator;

/** A prompt answered by the fake device, optionally with one thing wrong. */
function answering(
  from: FakeAuthenticator,
  overrides: Parameters<FakeAuthenticator["assert"]>[0] = {},
): Authenticator {
  return async (optionsJSON) => {
    // The ceremony generates the challenge; the authenticator signs whatever it is handed.
    const signed = await from.assert({ ...overrides, challenge: optionsJSON.challenge });
    return {
      id: signed.id,
      rawId: signed.id,
      type: "public-key",
      clientExtensionResults: {},
      response: {
        clientDataJSON: signed.clientDataJSON,
        authenticatorData: signed.authenticatorData,
        signature: signed.signature,
      },
    };
  };
}

const unlock = (authenticate: Authenticator, credentials = [device.credential]) =>
  unlockLocally(credentials, { origins: [ORIGIN], authenticate });

beforeEach(async () => {
  device = await fakeAuthenticator({ rpId: RP_ID, origin: ORIGIN });
});

describe("unlocking", () => {
  it("opens on a genuine biometric, with nothing on the network", async () => {
    expect(await unlock(answering(device))).toEqual({ status: "unlocked" });
  });

  it("asks the authenticator to verify the user, not merely to be present", async () => {
    const authenticate = vi.fn(answering(device));
    await unlock(authenticate);

    // "preferred" would let a bare tap through, and the verifier would then refuse it — a
    // prompt that cannot succeed. Asking for what is actually required keeps the two in step.
    expect(authenticate.mock.calls[0][0]).toMatchObject({
      userVerification: "required",
      rpId: RP_ID,
    });
  });

  it("issues a fresh challenge every time", async () => {
    const seen: string[] = [];
    const authenticate: Authenticator = async (options) => {
      seen.push(options.challenge);
      return answering(device)(options);
    };

    await unlock(authenticate);
    await unlock(authenticate);

    expect(seen).toHaveLength(2);
    expect(seen[0]).not.toBe(seen[1]);
  });
});

describe("staying locked", () => {
  it("treats a dismissed prompt as a cancellation, not a failure", async () => {
    // The done-when's second half: refuses to open after a cancelled biometric. A dismissed
    // prompt, a timeout and "no key here" all arrive as this one error.
    const cancelled: Authenticator = async () => {
      const error = new Error("The operation either timed out or was not allowed.");
      error.name = "NotAllowedError";
      throw error;
    };

    expect(await unlock(cancelled)).toEqual({ status: "cancelled" });
  });

  it("refuses a replayed assertion, because the challenge is new each time", async () => {
    const captured = await device.assert();
    const replaying: Authenticator = async () => ({
      id: captured.id,
      rawId: captured.id,
      type: "public-key",
      clientExtensionResults: {},
      response: {
        clientDataJSON: captured.clientDataJSON,
        authenticatorData: captured.authenticatorData,
        signature: captured.signature,
      },
    });

    expect(await unlock(replaying)).toMatchObject({
      status: "refused",
      reason: "the response answered a different challenge",
    });
  });

  it("refuses another device's passkey answering with this one's id", async () => {
    // A stubbed `navigator.credentials` that returns a plausible-looking response signed by a
    // key it controls. The id matches; the signature does not.
    const impostor = await fakeAuthenticator({
      rpId: RP_ID,
      origin: ORIGIN,
      id: device.credential.id,
    });

    expect(await unlock(answering(impostor))).toMatchObject({
      status: "refused",
      reason: "the signature did not check out",
    });
  });

  it("refuses an unknown credential id", async () => {
    const stranger = await fakeAuthenticator({ rpId: RP_ID, origin: ORIGIN, id: "c3RyYW5nZXI" });

    expect(await unlock(answering(stranger))).toMatchObject({
      status: "refused",
      reason: "a passkey this device does not know about answered",
    });
  });

  it("refuses a tap that never checked who was holding the phone", async () => {
    expect(await unlock(answering(device, { userVerified: false }))).toMatchObject({
      status: "refused",
      reason: "the passkey did not verify who you are",
    });
  });

  it("reports an unexpected failure rather than swallowing it", async () => {
    const broken: Authenticator = async () => {
      throw new Error("this browser has no authenticator");
    };

    expect(await unlock(broken)).toMatchObject({ status: "refused" });
  });

  it("is unarmed with nothing cached, and says so instead of opening quietly", async () => {
    const outcome = await unlockLocally([], { origins: [ORIGIN], authenticate: answering(device) });
    expect(outcome).toMatchObject({ status: "unarmed" });
  });
});

describe("the cached credential", () => {
  it("survives closing and reopening the app, which is what makes it work offline", async () => {
    const name = `auth-${Math.random().toString(36).slice(2)}`;
    let db = await openAuthDb(name);
    await rememberCredential(db, device.credential);
    db.close();

    db = await openAuthDb(name);
    expect(await listCredentials(db)).toEqual([device.credential]);
    db.close();
  });

  it("keeps both devices' keys, because which one answers depends on which phone this is", async () => {
    const laptop = await fakeAuthenticator({ rpId: RP_ID, origin: ORIGIN, id: "bGFwdG9w" });
    const db = await openAuthDb(`auth-${Math.random().toString(36).slice(2)}`);

    await rememberCredential(db, device.credential);
    await rememberCredential(db, laptop.credential);

    expect((await listCredentials(db)).map((c) => c.id)).toEqual([
      laptop.credential.id,
      device.credential.id,
    ]);
    db.close();
  });

  it("re-signing in with the same passkey updates it rather than storing it twice", async () => {
    const db = await openAuthDb(`auth-${Math.random().toString(36).slice(2)}`);

    await rememberCredential(db, device.credential);
    await rememberCredential(db, { ...device.credential, rpId: "moved.example" });

    const stored = await listCredentials(db);
    expect(stored).toHaveLength(1);
    expect(stored[0].rpId).toBe("moved.example");
    db.close();
  });

  it("forgets everything on sign-out, so no lock screen outlives its session", async () => {
    const db = await openAuthDb(`auth-${Math.random().toString(36).slice(2)}`);
    await rememberCredential(db, device.credential);

    await forgetCredentials(db);

    expect(await listCredentials(db)).toEqual([]);
    db.close();
  });
});
