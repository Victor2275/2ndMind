import path from "node:path";
import { fileURLToPath } from "node:url";

import type { NextConfig } from "next";

const here = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  /**
   * The vault lives at <repo>/context, one level above this app. Public pages read it at
   * build time and are static, so they need nothing — but /private is force-dynamic and
   * reads it per request, and by default the file tracer stops at the `web/` boundary and
   * ships none of it. Measured, not assumed: with no config, zero markdown files are traced
   * into /private, so the freshness widget would throw ENOENT in production while working
   * perfectly on a local machine.
   *
   * Widening the root is the whole fix. Next's static analysis of the `readdirSync` in
   * `lib/vault/load.ts` then pulls the tree in on its own — an `outputFileTracingIncludes`
   * entry alongside this turned out to be redundant, and worse, an explicit include *beats*
   * an exclude, so adding one made the archive impossible to leave behind.
   */
  outputFileTracingRoot: path.join(here, ".."),

  /**
   * `99_archive/` is superseded resumes, transcripts, and full lab reports. Nothing reads it
   * at runtime — the freshness walk skips it by name, as CLAUDE.md requires — so tracing it
   * would ship ten files of exactly the documents least worth carrying into a function.
   * Drops the traced set from 44 files to 34.
   */
  outputFileTracingExcludes: {
    "*": ["../context/99_archive/**"],
  },

  /**
   * Every `/private/*` page is `force-dynamic` (per-request auth + data), which by default
   * means the client-side prefetch Next already performs — `loading.tsx` makes every private
   * route eligible, per the framework's own rule that a `loading.js` boundary is what
   * qualifies a dynamic route for prefetching at all — is discarded after 0 seconds
   * (`staleTimes.dynamic` default). Read a page for more than an instant, tap a nav link, and
   * there is nothing to reuse: the skeleton itself waits on a server round trip before it can
   * appear, which is what reads as the app freezing rather than navigating (D-045 got the
   * skeleton built; this is what keeps it usable).
   *
   * 30s only changes how long the already-fetched shell — the layout and the `loading.tsx`
   * placeholder, not any page content — stays reusable. Content past each Suspense boundary
   * still streams fresh from the server on every navigation; nothing here risks serving stale
   * private data.
   */
  experimental: {
    staleTimes: { dynamic: 30 },
  },

  /**
   * The service worker must never be served from a cache (V3 §1.1, D-146).
   *
   * `public/` is served with a long-lived `Cache-Control` by default, which is right for
   * fonts and icons and actively harmful here: a cached `/sw.js` pins the *previous* worker
   * for as long as the entry lives, so a deploy lands and the installed app keeps running the
   * old code with no way to find out. `updateViaCache: "none"` on the registration covers the
   * browser's own service-worker cache; this covers the HTTP cache in front of it. Both are
   * needed — they are different caches.
   *
   * `Service-Worker-Allowed` lets the worker claim the whole origin, which is what the
   * manifest's `scope: "/"` promises.
   */
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
