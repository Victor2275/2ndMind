"use client";

import { FingerprintIcon, LockIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import type { LocalCredential } from "@/lib/auth/cose";
import { forgetLocalUnlock, listCredentials, openAuthDb } from "@/lib/auth/local-credential";
import { unlockLocally } from "@/lib/auth/local-unlock";
import { AUTO_LOCK_MS, decideLock, readUnlockedAt, writeUnlockedAt } from "@/lib/auth/lock-state";

/**
 * The lock screen (V3 §1.5, D-154).
 *
 * Wraps everything under `/private`. While locked, the children are not rendered at all —
 * which is a display gate, not a data gate, and the difference is worth being honest about:
 * the server has already sent this page's data in its payload, and the offline mirror is
 * sitting unencrypted in IndexedDB. What the lock stops is someone picking up an unlocked
 * phone and reading the log. It does not stop someone with developer tools, and it is not
 * meant to — that is what the device's own lock screen is for. D-154 states the boundary.
 *
 * **Two behaviours here are deliberate and look like bugs.**
 *
 * *It opens while it is still deciding.* The first render cannot know whether a credential is
 * cached, because that is an IndexedDB read. Rendering the lock screen first and the app second
 * would flash a lock on every navigation. So the gate stays open for that one tick, and the
 * decision arrives a frame later.
 *
 * *It opens when nothing is cached.* An unarmed lock cannot be enforced — there is no key to
 * check a fingerprint against — and refusing to open would strand Victor outside his own app
 * with no network to fix it from. So it fails open and says so, and arms itself on the next
 * online sign-in. Someone who can clear IndexedDB could also read the mirror directly, so this
 * is not the weak point it looks like.
 */
export function LocalLock({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const [state, setState] = useState<"deciding" | "locked" | "unlocked" | "unarmed">("deciding");
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const credentials = useRef<LocalCredential[]>([]);

  /** Re-evaluate from the stored unlock time. Called on mount and whenever we come back. */
  const reconsider = useCallback(() => {
    setState((current) => {
      if (current === "unarmed") return current;
      const storage = typeof window === "undefined" ? undefined : window.sessionStorage;
      return decideLock(readUnlockedAt(storage), Date.now());
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      let cached: LocalCredential[] = [];
      try {
        const db = await openAuthDb();
        cached = await listCredentials(db);
        db.close();
      } catch {
        // A browser that refuses IndexedDB cannot hold a key, so it cannot arm the lock.
      }
      if (cancelled) return;

      credentials.current = cached;
      if (cached.length === 0) {
        setState("unarmed");
        return;
      }
      reconsider();
    })();

    return () => {
      cancelled = true;
    };
  }, [reconsider]);

  // Coming back to the app is the moment to re-check: the five minutes that lock it again are
  // spent in the background, where no timer of ours is running anyway.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") reconsider();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [reconsider]);

  // And a timer for the case where the app is left open and untouched on a desk.
  useEffect(() => {
    if (state !== "unlocked") return;
    const timer = window.setTimeout(reconsider, AUTO_LOCK_MS + 1_000);
    return () => window.clearTimeout(timer);
  }, [state, reconsider]);

  async function unlock() {
    setWorking(true);
    setMessage(null);

    const outcome = await unlockLocally(credentials.current, {
      origins: [window.location.origin],
    });

    setWorking(false);

    if (outcome.status === "unlocked") {
      writeUnlockedAt(window.sessionStorage, Date.now());
      setState("unlocked");
      return;
    }
    if (outcome.status === "unarmed") {
      setState("unarmed");
      return;
    }
    setMessage(
      outcome.status === "cancelled" ? "Cancelled — still locked." : `Refused: ${outcome.reason}.`,
    );
  }

  if (state === "deciding" || state === "unlocked" || state === "unarmed") {
    return <>{children}</>;
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-6 px-5 py-24 text-center">
      <div className="flex size-14 items-center justify-center rounded-full border border-border text-muted-foreground">
        <LockIcon className="size-6" aria-hidden />
      </div>

      <div className="space-y-1.5">
        <h1 className="text-lg text-foreground">Locked</h1>
        <p className="text-sm text-muted-foreground">
          This works with no signal — the check happens on the phone.
        </p>
      </div>

      <button
        type="button"
        onClick={unlock}
        disabled={working}
        className="flex w-full items-center justify-center gap-2 rounded-md border border-primary/50 px-4 py-2.5 text-sm text-primary transition-all duration-300 hover:border-primary hover:bg-primary/10 hover:shadow-[0_0_24px_-8px_var(--primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60"
      >
        <FingerprintIcon className="size-4" aria-hidden />
        {working ? "Waiting…" : "Unlock"}
      </button>

      {message && (
        <p
          role="alert"
          className="w-full rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-foreground"
        >
          {message}
        </p>
      )}

      {/* The escape hatch. It does not bypass the lock — it leaves, clearing the cached key on
          the way out, so being unable to unlock never means being stuck. */}
      <button
        type="button"
        onClick={async () => {
          await fetch("/api/auth/login", { method: "DELETE" }).catch(() => {});
          await forgetLocalUnlock();
          router.replace("/");
        }}
        className="font-mono text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
      >
        Sign out instead
      </button>
    </div>
  );
}
