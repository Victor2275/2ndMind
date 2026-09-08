import { redirect } from "next/navigation";

import { SignInForm } from "@/components/site/signin-form";
import { getSession, isAuthConfigured } from "@/lib/auth/dal";

export const metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** Only ever internal paths — an open redirect here would be handed straight to a phisher. */
function safeNext(value: string | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/private";
  return value;
}

export default async function SignInPage({ searchParams }: PageProps<"/signin">) {
  const params = await searchParams;
  const next = safeNext(typeof params.next === "string" ? params.next : undefined);
  // Trust the environment over the query string: proxy.ts sets ?error=unconfigured, but a
  // direct visit to /signin on a broken deploy has no such marker and must still explain.
  const unconfigured = params.error === "unconfigured" || !isAuthConfigured();

  if (await getSession()) redirect(next);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-6 py-24">
      {/* No `rise` — this is the whole page, on the path every /private visit funnels through
          when the session has expired, and it already carries the highest TTFB on the site.
          A 600ms fade on top of that read as the app hanging, not loading (2026-09-04). */}
      <div className="w-full max-w-sm rounded-lg border border-border bg-card/70 p-7">
        <p className="font-mono text-[0.62rem] tracking-[0.16em] text-primary uppercase">Private</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Second brain</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          One passkey, one person. There is no password to phish and no account to create.
        </p>

        <div className="mt-6">
          {unconfigured ? (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-foreground">
              <span className="font-medium">Not configured.</span> `SESSION_SECRET` is missing from
              the environment, so sign-in is disabled. See `web/.env.example`.
            </p>
          ) : (
            <SignInForm next={next} />
          )}
        </div>
      </div>
    </main>
  );
}
