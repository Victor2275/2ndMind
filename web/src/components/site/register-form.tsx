"use client";

import { startRegistration } from "@simplewebauthn/browser";
import { useState } from "react";

type Result = { label: string };

export function RegisterForm() {
  const [secret, setSecret] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);

  async function enrol(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);

    try {
      const optionsRes = await fetch(`/api/auth/register?secret=${encodeURIComponent(secret)}`);
      const optionsJSON = await optionsRes.json();
      if (!optionsRes.ok) throw new Error(optionsJSON.error ?? "could not start");

      const attestation = await startRegistration({ optionsJSON });

      const verifyRes = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ secret, label, response: attestation }),
      });
      const verified = await verifyRes.json();
      if (!verifyRes.ok) throw new Error(verified.error ?? "verification failed");

      setResult({ label: verified.label as string });
    } catch (e) {
      setError(
        e instanceof Error && e.name === "NotAllowedError"
          ? "Cancelled, or the origin does not match NEXT_PUBLIC_SITE_URL."
          : e instanceof Error
            ? e.message
            : "Something went wrong.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <div className="space-y-4">
        <p className="rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-foreground">
          Passkey enrolled as “{result.label}”. This device can sign in now — nothing else to do.
        </p>
        <a
          href="/signin"
          className="inline-block rounded-md border border-primary/50 px-4 py-2 text-sm text-primary transition-colors hover:border-primary hover:bg-primary/10"
        >
          Sign in
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={enrol} className="space-y-4">
      <div>
        <label htmlFor="secret" className="eyebrow text-muted-foreground">
          Registration secret
        </label>
        <input
          id="secret"
          type="password"
          required
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          className="mt-1.5 w-full rounded-md border border-border bg-card/70 px-3 py-2 font-mono text-sm text-foreground focus:border-primary/60 focus:outline-none"
          placeholder="PASSKEY_REGISTRATION_SECRET"
        />
      </div>

      <div>
        <label htmlFor="label" className="eyebrow text-muted-foreground">
          Device name
        </label>
        <input
          id="label"
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="mt-1.5 w-full rounded-md border border-border bg-card/70 px-3 py-2 font-mono text-sm text-foreground focus:border-primary/60 focus:outline-none"
          placeholder="laptop"
        />
        <p className="mt-1 text-[0.7rem] text-muted-foreground">
          Only so you can tell the entries apart later, when retiring a device.
        </p>
      </div>

      <button
        type="submit"
        disabled={busy || secret.length === 0}
        className="w-full rounded-md border border-primary/50 px-4 py-2.5 text-sm text-primary transition-all duration-300 hover:border-primary hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? "Waiting for authenticator…" : "Enrol this device"}
      </button>

      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-foreground"
        >
          {error}
        </p>
      )}
    </form>
  );
}
