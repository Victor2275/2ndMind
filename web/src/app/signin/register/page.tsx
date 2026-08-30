import { notFound } from "next/navigation";

import { RegisterForm } from "@/components/site/register-form";
import { registrationSecret } from "@/lib/auth/config";

export const metadata = {
  title: "Enrol a passkey",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function RegisterPage() {
  // The page disappears entirely when the gate is shut, so there is nothing to probe. The
  // API route enforces the same rule independently — this is convenience, not the control.
  if (!registrationSecret()) notFound();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-6 py-24">
      <div className="w-full max-w-md rounded-lg border border-border bg-card/70 p-7">
        <p className="font-mono text-[0.62rem] tracking-[0.16em] text-highlight uppercase">
          One-time setup
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Enrol a passkey</h1>
        <p className="mt-2 mb-6 text-sm text-muted-foreground">
          A passkey is bound to the origin it was created on, so this runs once on localhost and
          once on the live site. Enrolling replaces any existing credential.
        </p>
        <RegisterForm />
      </div>
    </main>
  );
}
