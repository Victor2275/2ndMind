import { openDB, type IDBPDatabase } from "idb";

import type { LocalCredential } from "@/lib/auth/cose";
import { writeUnlockedAt } from "@/lib/auth/lock-state";

/**
 * The cached public key that makes offline unlock possible (V3 §1.5, D-154).
 *
 * A separate IndexedDB database from the sync store on purpose. They have different lifetimes
 * — signing out clears this and must not touch the offline log — and sharing one database
 * would mean a schema version bump on the sync store, whose migration path exists to protect
 * unsent writes. Two small databases beat one migration that can lose an entry.
 *
 * Nothing in here is secret. A credential id and a public key are both public by definition;
 * the private key never leaves the phone's secure element, which is the entire reason this
 * can sit in IndexedDB at all.
 */

const DB_NAME = "2ndmind-auth";
const DB_VERSION = 1;
const STORE = "meta";
const KEY = "credentials";

type AuthDb = IDBPDatabase<unknown>;

export async function openAuthDb(name = DB_NAME): Promise<AuthDb> {
  return openDB(name, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    },
  });
}

/**
 * Remember the passkey that just signed in, so the next unlock needs no network.
 *
 * Stored as a list rather than a single value because two devices may be enrolled and the
 * one in your hand is whichever answered — the laptop's credential is useless to the phone,
 * and keeping only the newest would make a shared machine overwrite the phone's own key.
 */
export async function rememberCredential(db: AuthDb, credential: LocalCredential): Promise<void> {
  const existing = await listCredentials(db);
  const next = [credential, ...existing.filter((c) => c.id !== credential.id)];
  await db.put(STORE, next, KEY);
}

export async function listCredentials(db: AuthDb): Promise<LocalCredential[]> {
  return ((await db.get(STORE, KEY)) as LocalCredential[] | undefined) ?? [];
}

/**
 * Forget every cached key. Called on sign-out, because leaving the credential behind would
 * leave a lock screen on a device with no session to unlock into.
 */
export async function forgetCredentials(db: AuthDb): Promise<void> {
  await db.delete(STORE, KEY);
}

/**
 * Everything sign-out has to undo, in one call: the cached key and the current unlock.
 *
 * Both, not either. Leaving the key would put a lock screen in front of a device with no
 * session behind it; leaving the unlock time would let the next sign-in walk straight in
 * without a fingerprint. Swallows its own failures — a sign-out that cannot clear local
 * state must still sign out.
 */
export async function forgetLocalUnlock(): Promise<void> {
  try {
    const db = await openAuthDb();
    await forgetCredentials(db);
    db.close();
  } catch {
    // Nothing cached, or no IndexedDB at all. Either way there is nothing to forget.
  }
  if (typeof window !== "undefined") writeUnlockedAt(window.sessionStorage, null);
}
