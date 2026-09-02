/**
 * When the app is locked, and what unlocks it (V3 §1.5, D-154).
 *
 * Pure so the policy can be tested. The rules that matter are the two easiest to get subtly
 * wrong: a cold start is always locked, and time spent in the background counts.
 */

/** How long the app may sit in the background before it locks itself again. */
export const AUTO_LOCK_MS = 5 * 60 * 1000;

/**
 * `sessionStorage`, not `localStorage`. An unlock should not outlive the app being closed,
 * and `sessionStorage` is cleared when the tab is — which is exactly the policy, for free.
 * On Android an installed PWA keeps one session per launch, so closing the app re-locks it.
 */
export const UNLOCKED_AT_KEY = "2m_unlocked_at";

export type LockDecision = "locked" | "unlocked";

/**
 * Whether a stored unlock is still good.
 *
 * `unlockedAt` of null is a cold start — no stored value, so the app was closed, or this is
 * the first visit. Locked, always: an app that opened unlocked because nothing said otherwise
 * would be unlocked in exactly the case that matters most.
 */
export function decideLock(
  unlockedAt: number | null,
  now: number,
  autoLockMs = AUTO_LOCK_MS,
): LockDecision {
  if (unlockedAt === null) return "locked";
  // A stored time in the future means the clock moved backwards under us. Treat it as suspect
  // rather than as a very long unlock.
  if (unlockedAt > now) return "locked";
  return now - unlockedAt > autoLockMs ? "locked" : "unlocked";
}

/** Reads the stored unlock time, tolerating storage that throws or holds nonsense. */
export function readUnlockedAt(storage: Storage | undefined): number | null {
  try {
    const raw = storage?.getItem(UNLOCKED_AT_KEY);
    if (!raw) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    // Private windows and blocked site data both throw here. Failing to read is a lock, not
    // a crash — the worst it costs is one extra fingerprint.
    return null;
  }
}

export function writeUnlockedAt(storage: Storage | undefined, at: number | null): void {
  try {
    if (at === null) storage?.removeItem(UNLOCKED_AT_KEY);
    else storage?.setItem(UNLOCKED_AT_KEY, String(at));
  } catch {
    // Same as above. An unlock that cannot be remembered still unlocks this view; the next
    // navigation just asks again.
  }
}
