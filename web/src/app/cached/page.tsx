import { CachedApp } from "@/components/site/cached-app";
import { SyncRunner } from "@/components/site/sync-runner";

/**
 * The app as it exists on the phone, with no network (V3 §2.1).
 *
 * **Static, and outside `/private` on purpose.** Everything under `/private` is
 * `force-dynamic` and calls `requireSession()`, so rendering any of it needs a server — which
 * is precisely what is missing when this page is wanted. A static route can be precached by
 * the service worker at install and served from Cache Storage forever after, and that is the
 * whole mechanism by which the app opens at all in airplane mode.
 *
 * **It contains no data.** The HTML is chrome: headings, labels, an empty shell. Every value
 * on screen is read from IndexedDB in the browser, which exists only on a device that has
 * signed in and synced. That is why serving it without a session check is not a leak — it is
 * the same reasoning as `docs/SYNC_DESIGN.md` §8 and D-128, and the same reason a Client
 * Component may render private data it must not contain.
 *
 * `robots` is belt and braces. The route is linked from nothing public and holds nothing, but
 * a crawler indexing a page called "Offline copy" would be a confusing search result at best.
 */
export const metadata = {
  title: "Offline copy",
  robots: { index: false, follow: false },
};

/**
 * Static. If this ever becomes dynamic the whole feature silently stops working — the service
 * worker would cache a redirect to the sign-in page and serve that in airplane mode instead.
 */
export const dynamic = "force-static";

export default function CachedPage() {
  return (
    <>
      {/* `/cached` is the private app (D-174) but sits outside its layout, so it carries its
          own skip link — §4.7, Q444: one per layout, and this route is one. */}
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-5 pt-8 pb-24 sm:px-6">
        <header className="border-b border-border pb-6">
          <p className="eyebrow text-primary">No signal</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">
            What is on this phone
          </h1>
          <p className="mt-3 max-w-[62ch] text-sm leading-relaxed text-muted-foreground">
            The live app needs the network. This is the copy the phone keeps — read-only, as of the
            last time it synced.
          </p>
        </header>

        <CachedApp />

        {/* Sends what was written with the radio off, the moment signal returns, without waiting
          for the live app to be opened (D-175). `offline` gates it on there being something
          queued: this route is static and reachable without a session, and an unguarded flush
          posts even when the outbox is empty. */}
        <SyncRunner offline />
      </main>
    </>
  );
}
