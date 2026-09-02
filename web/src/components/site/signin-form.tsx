"use client";

import { startAuthentication } from "@simplewebauthn/browser";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { LocalCredential } from "@/lib/auth/cose";
import { openAuthDb, rememberCredential } from "@/lib/auth/local-credential";

type State = { status: "idle" | "working" | "error"; message?: string };

export function SignInForm({ next }: { next: string }) {
  const router = useRouter();
  const [state, setState] = useState<State>({ status: "idle" });

  async function signIn() {
    setState({ status: "working" });
    try {
      const optionsRes = await fetch("/api/auth/login");
      if (!optionsRes.ok) {
        const { error } = (await optionsRes.json()) as { error?: string };
        throw new Error(error ?? "could not start sign-in");
      }

      const assertion = await startAuthentication({
        optionsJSON: await optionsRes.json(),
      });

      const verifyRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ response: assertion }),
      });
      if (!verifyRes.ok) {
        const { error } = (await verifyRes.json()) as { error?: string };
        throw new Error(error ?? "sign-in failed");
      }

      // Arm offline unlock (§1.5, D-154). This is the only moment the public half of the
      // passkey is available to the device, and it is deliberately not fatal: a failure here
      // costs the lock screen, not the sign-in, and the next sign-in tries again.
      const { local } = (await verifyRes.json()) as { local?: LocalCredential | null };
      if (local) {
        try {
          const db = await openAuthDb();
          await rememberCredential(db, local);
          db.close();
        } catch {
          // A browser refusing IndexedDB cannot hold a key. Sign-in still succeeded.
        }
      }

      router.replace(next);
      router.refresh();
    } catch (error) {
      // A cancelled prompt throws too. Say something true rather than alarming.
      const message =
        error instanceof Error && error.name === "NotAllowedError"
          ? "Cancelled — no passkey was used."
          : error instanceof Error
            ? error.message
            : "Something went wrong.";
      setState({ status: "error", message });
    }
  }

  return (
    <div className="w-full max-w-sm">
      <button
        type="button"
        onClick={signIn}
        disabled={state.status === "working"}
        className="w-full rounded-md border border-primary/50 px-4 py-2.5 text-sm text-primary transition-all duration-300 hover:border-primary hover:bg-primary/10 hover:shadow-[0_0_24px_-8px_var(--primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60"
      >
        {state.status === "working" ? "Waiting for passkey…" : "Sign in with passkey"}
      </button>

      {state.status === "error" && (
        <p
          role="alert"
          className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-foreground"
        >
          {state.message}
        </p>
      )}
    </div>
  );
}
