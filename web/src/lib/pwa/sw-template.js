/**
 * Service worker source. `scripts/build-sw.mjs` copies this to `public/sw.js`, replacing
 * `__BUILD_ID__` with the commit it was built from. Do not edit `public/sw.js` — it is
 * generated and gitignored.
 *
 * Why the stamp exists at all: a browser only notices a new service worker when the script's
 * *bytes* change. Hand-versioning means every deploy that touches app code but not this file
 * ships silently, and an installed PWA can run weeks-old JavaScript against a current API
 * without anyone noticing. Stamping the commit in makes every deploy a byte change, which is
 * what turns `registration.update()` into a real update signal (D-146).
 *
 * What this worker does NOT do, on purpose:
 *
 *   - It does not precache the app's own JavaScript. That needs a build-time manifest of
 *     hashed asset URLs and belongs with the rest of the offline work in Phase 2.
 *   - It never writes a response to a private route into the cache. Everything under
 *     /private is behind the session cookie and is real personal data; putting it in Cache
 *     Storage is a deliberate decision with its own threat model, not a side effect of the
 *     shell landing. Phase 2 §2.1 makes that call explicitly.
 *   - It only ever touches GET. Server Actions are POSTs, and a cached or replayed mutation
 *     is far worse than a failed one.
 */

const BUILD_ID = "__BUILD_ID__";

/** Bumping the cache name is what evicts everything the previous build cached. */
const CACHE = `2ndmind-shell-${BUILD_ID}`;

/**
 * The only thing precached at install: the page shown when a navigation fails with no
 * network. It is public and static, so caching it carries nothing sensitive.
 */
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // `reload` bypasses the HTTP cache, so a fresh install cannot pick up a stale copy of
      // the offline page from the browser's own cache.
      await cache.add(new Request(OFFLINE_URL, { cache: "reload" }));
    })(),
  );
  // Deliberately no skipWaiting() here. A new worker waits until the user accepts the reload
  // prompt, so the app cannot swap its code out from under a half-written log entry.
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith("2ndmind-shell-") && name !== CACHE)
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

/**
 * The page sends this when the user accepts the reload prompt. Until then the new worker
 * sits in `waiting` and the old one keeps serving.
 */
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigations: always try the network first, because a stale HTML document is how a PWA
  // ends up showing yesterday's dashboard. Fall back to the offline page, and only for a
  // genuine network failure — a 401 or a 500 is the server talking and should be shown.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch {
          const cache = await caches.open(CACHE);
          const offline = await cache.match(OFFLINE_URL);
          return offline ?? new Response("Offline", { status: 503, statusText: "Offline" });
        }
      })(),
    );
    return;
  }

  // Build assets are content-hashed, so a cached copy can never be the wrong version of
  // itself. Cache-first, and populate on the way past.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const hit = await cache.match(request);
        if (hit) return hit;

        const response = await fetch(request);
        // Opaque and error responses are not worth keeping; caching a 404 for a hashed asset
        // would pin the failure for the life of the build.
        if (response.ok) cache.put(request, response.clone());
        return response;
      })(),
    );
  }
});
