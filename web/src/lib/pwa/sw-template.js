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
 *   - It never writes a response to a private route into the cache. Everything under
 *     /private is behind the session cookie and is real personal data; putting it in Cache
 *     Storage is a deliberate decision with its own threat model, not a side effect of the
 *     shell landing. §2.1 made that call explicitly and the answer was no: the offline app
 *     reads IndexedDB instead, which is per-device and cleared with the store.
 *   - It only ever touches GET. Server Actions are POSTs, and a cached or replayed mutation
 *     is far worse than a failed one.
 */

const BUILD_ID = "__BUILD_ID__";

/** Bumping the cache name is what evicts everything the previous build cached. */
const CACHE = `2ndmind-shell-${BUILD_ID}`;

/**
 * The page shown when a *public* navigation fails with no network. Static, so caching it
 * carries nothing sensitive.
 */
const OFFLINE_URL = "/offline";

/**
 * The app as it exists on the phone (§2.1). Also static and also empty — every value it shows
 * is read from IndexedDB in the browser, so what is cached here is chrome, not data.
 *
 * This is what makes the app openable with no signal at all. Without it, every navigation
 * under /private failed straight to the offline page, which is a dead end: the local store had
 * a day of tasks and a week of training in it and no screen could reach them.
 */
const SHELL_URL = "/cached";

/**
 * The public site, precached so the portfolio opens with no signal (§2.2).
 *
 * The list is not written here. It is read from `/sitemap.xml`, which the app already
 * generates from the vault — home, `/now`, the projects index, every public project and all
 * three resume variants. A hand-maintained array would be a second list to keep in step, and
 * the way it fails is silent: a project ships, nobody adds it, and it is missing from the one
 * device that needed it. Adding a project now precaches it with no code change at all.
 *
 * Public pages only, by construction: the sitemap is a crawler's list, so nothing private can
 * appear on it without being a much larger bug than this.
 */
const SITEMAP_URL = "/sitemap.xml";

/**
 * Tell the app when this worker breaks (§2.4, D-165).
 *
 * The reason error aggregation was scheduled at all: **a failing service worker on a phone
 * produces no log anyone will ever read.** Nothing renders, nobody is watching a console, and
 * the symptom — the app is stale, or offline stopped working — arrives days later with no way
 * to trace it back.
 *
 * Fire-and-forget, and it swallows everything. This is the error path; a throw here would
 * replace a degraded worker with a dead one. `reporting` guards against the one genuinely bad
 * outcome: a failing report triggering a report of its own, forever.
 */
let reporting = false;

async function report(error, where) {
  if (reporting) return;
  reporting = true;
  try {
    await fetch("/api/errors", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        source: "worker",
        name: error?.name ? String(error.name).slice(0, 120) : "Error",
        message: `${where}: ${String(error?.message ?? error)}`.slice(0, 500),
        stack: String(error?.stack ?? "").slice(0, 2000),
        route: "",
        buildId: BUILD_ID,
        agent: self.navigator?.userAgent ?? "",
      }),
    });
  } catch {
    // No network, or the endpoint is the thing that is broken. Nothing left to try.
  } finally {
    reporting = false;
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // `reload` bypasses the HTTP cache, so a fresh install cannot pick up a stale copy of
      // either page from the browser's own cache.
      //
      // Added one at a time rather than with `addAll`, which is atomic: if the shell 404s on
      // an older deploy, `addAll` would fail the whole install and leave the worker without
      // even the offline page. A degraded install beats no install.
      await cache.add(new Request(OFFLINE_URL, { cache: "reload" }));
      try {
        await cache.add(new Request(SHELL_URL, { cache: "reload" }));
        await warmShell(cache);
      } catch (error) {
        // Falls back to the offline page for private navigations too — which is a silent
        // downgrade of the whole offline feature, so it is worth a report.
        await report(error, "install");
      }
    })(),
  );
  // Deliberately no skipWaiting() here. A new worker waits until the user accepts the reload
  // prompt, so the app cannot swap its code out from under a half-written log entry.
});

/**
 * Cache the scripts and styles the shell needs to run.
 *
 * Without this the feature half-works in the worst possible way: the HTML is cached and
 * serves, so the page appears, but React never hydrates because its chunks were never fetched
 * — and the shell reads everything from IndexedDB in the browser, so what he gets in airplane
 * mode is a heading and the word "Reading…" forever.
 *
 * Every fetch is individually tolerant. One asset 404ing after a deploy must degrade the
 * shell, not fail the install and leave the phone with no worker at all.
 */
async function warmShell(cache) {
  const html = await (await cache.match(SHELL_URL))?.text();
  if (html) await warmAssets(cache, html);
}

/**
 * Cache the scripts, styles and fonts one page's HTML refers to.
 *
 * The URLs are scraped from the document rather than read from a build manifest. A manifest is
 * tidier and needs a build step; this needs none and cannot go stale, because it is reading the
 * very page it is caching. It over-caches slightly — a few shared chunks — which costs
 * kilobytes.
 *
 * The backslash in the character class matters: these URLs also appear inside escaped JSON in
 * the page's inline scripts, as `\"/_next/static/….js\"`, and without it every one of them is
 * scraped a second time with a trailing backslash — a guaranteed 404 per asset.
 */
async function warmAssets(cache, html) {
  const urls = new Set(html.match(/\/_next\/static\/[^"'\s>\\]+/g) ?? []);
  await Promise.all(
    [...urls].map(async (url) => {
      try {
        // Skip anything already held: on a public precache of a dozen pages, the shared chunks
        // would otherwise be fetched a dozen times each.
        if (await cache.match(url)) return;
        const response = await fetch(url, { cache: "reload" });
        if (response.ok) await cache.put(url, response);
      } catch {
        // One missing chunk is not worth failing over.
      }
    }),
  );
}

/**
 * Precache the public site, and the assets each page needs.
 *
 * Runs in `activate` rather than `install`, deliberately: this is a dozen documents and their
 * scripts, and doing it during install would hold the new worker in `installing` for seconds
 * on a phone — delaying the update prompt for pages that are a nicety, while the two that
 * actually matter (the offline page and the app shell) are already in.
 *
 * Every fetch is individually tolerant for the same reason as `warmShell`: one 404 after a
 * deploy must degrade the cache, not fail activation and leave the phone with no worker.
 */
async function precachePublic(cache) {
  let paths = [];
  try {
    const response = await fetch(SITEMAP_URL, { cache: "reload" });
    if (!response.ok) return;
    const xml = await response.text();
    paths = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
      .map((match) => match[1].trim())
      .map((url) => {
        try {
          const parsed = new URL(url, self.location.origin);
          // The sitemap carries absolute production URLs, which on a preview deployment are a
          // different origin. Only the path is used, so both work.
          return parsed.pathname;
        } catch {
          return null;
        }
      })
      // Belt and braces on top of "the sitemap is public by construction": a private path
      // reaching this list would be cached to disk, where it would survive sign-out.
      .filter((path) => typeof path === "string" && !path.startsWith("/private"));
  } catch {
    return;
  }

  for (const path of paths) {
    try {
      const response = await fetch(path, { cache: "reload" });
      if (!response.ok) continue;
      const html = await response.clone().text();
      await cache.put(path, response);
      await warmAssets(cache, html);
    } catch {
      // One page missing is not worth failing activation over.
    }
  }
}

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

      // Last, and after `claim`, so nothing the user is waiting for is behind it.
      try {
        await precachePublic(await caches.open(CACHE));
      } catch (error) {
        // The app works without it; only the offline portfolio does not.
        await report(error, "precache");
      }
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
          // One retry before giving up — but only when the device thinks it has a network.
          //
          // The retry exists because a navigation that fails on a phone is very often a single
          // dropped request: a radio handing between cells, wifi associated but not yet
          // authenticated. Landing on a dead-end page for one of those was reported on
          // 2026-09-03.
          //
          // Retrying with the radio off is the opposite mistake, and was reported the day
          // after: it buys nothing and doubles how long the screen sits blank before the
          // offline page appears. `onLine` is weak evidence in general — it cannot tell you
          // anything answers — but `false` is conclusive, and conclusive is all this needs.
          if (self.navigator.onLine !== false) {
            try {
              return await fetch(request);
            } catch {
              // Fall through to the offline page.
            }
          }

          {
            // Still nothing. Two destinations, and which one matters more than it looks.
            //
            // A private navigation goes to the cached shell, which renders today's tasks, the
            // log and recent training out of IndexedDB (§2.1). The offline page can only
            // apologise; the shell is the app, minus the network.
            //
            // A public navigation goes to the offline page. The portfolio is not mirrored
            // anywhere — that is §2.2 — so there would be nothing for the shell to show.
            const cache = await caches.open(CACHE);

            // A public page precached by §2.2 — the portfolio, a project, a resume. Served as
            // itself, with no rewriting: it is the real page, only from disk.
            const precached = await cache.match(url.pathname);
            if (precached) return precached;

            // `/cached` itself is included: its own view links are plain navigations, so
            // without this, moving from the offline Today to the offline Training screen would
            // land on the offline page — the app working until you touched it.
            const isShell = url.pathname === SHELL_URL;
            const wantsApp =
              isShell || url.pathname === "/private" || url.pathname.startsWith("/private/");
            const shell = wantsApp ? await cache.match(SHELL_URL) : null;
            const offline = shell ?? (await cache.match(OFFLINE_URL));
            if (!offline) {
              return new Response("Offline", { status: 503, statusText: "Offline" });
            }
            const destination = shell ? SHELL_URL : OFFLINE_URL;

            // Rebuilt rather than returned as-is: a cached Response's `url` is the cache key,
            // and the page needs the failed path. A redirect would lose the SPA history and a
            // header would not survive into the document, so it goes in the body's own URL via
            // a fresh Response — the page reads it from `location.search`.
            const path = new URL(request.url).pathname + new URL(request.url).search;
            // A request already aimed at the shell keeps its own query — rewriting it would
            // turn `?from=/private/athletics` into `?from=/cached?from=...` and every offline
            // screen would render Today.
            const target = isShell ? path : `${destination}?from=${encodeURIComponent(path)}`;
            const html = await offline.text();
            return new Response(
              html.replace(
                "</head>",
                `<script>history.replaceState(null,"","${target}")</script></head>`,
              ),
              {
                status: 200,
                headers: { "content-type": "text/html; charset=utf-8" },
              },
            );
          }
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
