/**
 * The offline round trip, driven by a real browser (V3 §3.7).
 *
 *   npm run e2e
 *
 * This is the check nothing else in the project can make. `npm test` runs the sync engine
 * against fakes and the components against jsdom, both of which are honest about what they
 * cover and neither of which has a service worker, a Cache Storage, or an IndexedDB that
 * survives a navigation. `npm run shots` drives a real browser but never goes offline.
 *
 * What broke on 2026-09-05 is the argument for it existing: the offline app rendered with the
 * portfolio's header and no tab bar, and **every assertion about that screen passed** — each
 * was about what the component renders, none about what happens when a browser with no network
 * asks the worker for a page. That class of bug is only visible from out here.
 *
 * ## What it does
 *
 * Builds, starts a production server, and drives Chromium through the sequence Victor performed
 * by hand:
 *
 *   1. **Online.** Load `/private`, wait for the worker to install, activate and precache.
 *   2. **Offline.** Airplane mode, at the browser context. Then:
 *      - `/private/athletics` is answered by the worker with the shell, on the Training view.
 *      - the portfolio still opens — `/` and a project page, from §2.2's precache.
 *      - a **Training entry with two sets** is written and saved, with no network.
 *   3. **Back online**, without navigating anywhere. The shell flushes for itself (D-175), so
 *      the outbox must empty on its own — that is the behaviour built the same day and this is
 *      what proves it.
 *   4. **In the database.** Each entry written offline is present **exactly once**, with its
 *      sets intact.
 *   5. **Cleaned up.** The rows this run created are deleted, by client id, before it exits.
 *
 * ## Why it writes to the real database
 *
 * Because the claim is about the real database. The plan deferred this for a while precisely
 * because §1.2 removed hard deletes, so a test row written through the app could never be taken
 * out again through the app. The resolution is that **teardown deletes by SQL**, scoped to the
 * client ids this run generated and refusing to run at all if that list is empty or malformed.
 * A test that leaves rows in a real log is a test that gets switched off after a fortnight.
 *
 * Local only. Nothing here runs in CI, and it needs `.env.local`.
 */
import { spawn } from "node:child_process";
import path from "node:path";

import { chromium } from "playwright";
import { neon } from "@neondatabase/serverless";

import { mintSession, SESSION_COOKIE } from "./lib/session.mjs";

const PORT = Number(process.env.E2E_PORT ?? 3210);
const BASE = `http://127.0.0.1:${PORT}`;

/** A public project that exists and is in the sitemap, so §2.2 will have precached it. */
const PROJECT = "/projects/solenoid-bit-reader";

/** Marks this run's rows, so a human reading the log knows where they came from. */
const STAMP = `e2e ${new Date().toISOString()}`;

const failures = [];
function check(ok, label, detail = "") {
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${label}${detail ? `  — ${detail}` : ""}`);
  if (!ok) failures.push(`${label}${detail ? `: ${detail}` : ""}`);
  return ok;
}

async function waitFor(label, predicate, { timeout = 30_000, every = 250 } = {}) {
  const deadline = Date.now() + timeout;
  for (;;) {
    let result;
    try {
      result = await predicate();
    } catch {
      result = false;
    }
    if (result) return result;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${label}`);
    await new Promise((r) => setTimeout(r, every));
  }
}

/* ---------------------------------------------------------------------- the server */

/**
 * A production build, not `next dev`.
 *
 * The worker precaches by scraping `/_next/static/...` out of the pages it caches, and dev
 * serves different URLs than a build does. Running this against a dev server would be
 * exercising a caching behaviour that no phone ever sees, which is the one thing §3.7 is for.
 */
function startServer() {
  const bin = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
  const child = spawn(process.execPath, [bin, "start", "-p", String(PORT)], {
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
  });
  child.stdout.on("data", () => {});
  child.stderr.on("data", (d) => process.stderr.write(d));
  return child;
}

/* ---------------------------------------------------------------------- the browser */

/** Everything in the outbox, read straight out of IndexedDB in the page. */
function readOutbox(page) {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open("2ndmind");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const all = db.transaction("outbox", "readonly").objectStore("outbox").getAll();
          all.onerror = () => reject(all.error);
          all.onsuccess = () => {
            resolve(
              all.result.map((op) => ({
                opId: op.opId,
                entity: op.entity,
                op: op.op,
                clientId: op.clientId,
                state: op.state,
              })),
            );
            db.close();
          };
        };
      }),
  );
}

/** Whether the worker is active, controlling this page, and has the shell in its cache. */
function workerState(page) {
  return page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) return { ready: false, controlled: false, cached: [] };
    const registration = await navigator.serviceWorker.ready;
    const names = await caches.keys();
    const shell = names.find((n) => n.startsWith("2ndmind-shell-"));
    if (!shell) {
      return {
        ready: !!registration.active,
        controlled: !!navigator.serviceWorker.controller,
        cached: [],
      };
    }
    const cache = await caches.open(shell);
    const keys = await cache.keys();
    return {
      ready: !!registration.active,
      controlled: !!navigator.serviceWorker.controller,
      cached: keys.map((request) => new URL(request.url).pathname),
    };
  });
}

/* ---------------------------------------------------------------------- the run */

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const secret = process.env.SESSION_SECRET;
  if (!databaseUrl || !secret) {
    // Refused rather than skipped. A suite that quietly downgrades to "checked nothing" when a
    // variable is missing is how a green run stops meaning anything.
    console.error("e2e: DATABASE_URL and SESSION_SECRET are required (they live in .env.local).");
    process.exit(2);
  }

  const sql = neon(databaseUrl);
  const server = startServer();
  let browser;
  let created = [];

  try {
    await waitFor("the server to answer", async () => (await fetch(BASE)).ok, { timeout: 60_000 });
    console.log(`\nserver up on ${BASE}\n`);

    browser = await chromium.launch();
    const context = await browser.newContext({
      serviceWorkers: "allow",
      // A phone, because this app's offline navigation is phone-only by construction: the tab
      // bar is `.nav-mobile`, which is `display: none` above the breakpoint. The first run of
      // this suite reported the bar missing from a 1280px-wide browser, which was true and
      // meant nothing.
      viewport: { width: 390, height: 844 },
    });
    await context.addCookies([
      {
        name: SESSION_COOKIE,
        value: await mintSession(secret),
        url: BASE,
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
    const page = await context.newPage();

    // Kept for the failure path. When the round trip breaks, the useful evidence is what the
    // page said and which request it could not make — reconstructing that from a bare
    // "the outbox did not empty" is the slow way round.
    const consoleLines = [];
    const failedRequests = [];
    page.on("console", (m) => {
      if (m.type() === "error" || m.type() === "warning")
        consoleLines.push(`${m.type()}: ${m.text()}`);
    });
    page.on("requestfailed", (r) =>
      failedRequests.push(`${r.method()} ${r.url()} — ${r.failure()?.errorText}`),
    );
    page.on("response", (r) => {
      if (r.url().includes("/api/") && !r.ok()) failedRequests.push(`${r.status()} ${r.url()}`);
    });

    /* -- 1. online, and let the worker install ------------------------------------ */
    console.log("online");
    // `/private/sync`, not `/private`. Any page in the private layout mounts the worker and
    // the sync runner, which is all this step needs — and the dashboard additionally asks
    // Gemini for a summary while rendering. A 503 from that model timed this navigation out on
    // a build that was otherwise fine, which is a suite failing for a reason it does not test.
    //
    // "load" rather than "networkidle" for the same class of reason: this page registers a
    // worker and starts a sync, so the network is never idle for long, and an earlier attempt
    // timed out on a page that had already rendered. What is actually waited for is the worker,
    // below — the real precondition, checked rather than approximated.
    await page.goto(`${BASE}/private/sync`, { timeout: 60_000 });
    check(
      !new URL(page.url()).pathname.startsWith("/signin"),
      "the session is accepted",
      page.url(),
    );

    const state = await waitFor(
      "the worker to precache the shell and the portfolio",
      async () => {
        const s = await workerState(page);
        // The project page is part of the condition, not just an assertion after it: §2.2
        // precaches during `activate`, so checking for it the instant the shell lands is a
        // race that passes or fails with the weather.
        return s.ready &&
          s.controlled &&
          s.cached.includes("/cached") &&
          s.cached.includes("/") &&
          s.cached.includes(PROJECT)
          ? s
          : false;
      },
      { timeout: 60_000 },
    );
    check(state.controlled, "the worker controls the page");
    check(state.cached.includes("/cached"), "the app shell is precached");
    check(state.cached.includes("/"), "the portfolio home is precached");
    check(state.cached.includes(PROJECT), "a project page is precached", PROJECT);

    // The mirror has to arrive before the radio goes off. Without it the shell would correctly
    // report that this device has never synced, there would be no form to fill, and the failure
    // would look like a broken form rather than a race with the first pull.
    const mirrored = await waitFor(
      "the local mirror to fill",
      async () => {
        const seen = await page.evaluate(
          () =>
            new Promise((resolve, reject) => {
              const open = indexedDB.open("2ndmind");
              open.onerror = () => reject(open.error);
              open.onsuccess = () => {
                const db = open.result;
                const tx = db.transaction(["log_entries", "meta"], "readonly");
                const rows = tx.objectStore("log_entries").count();
                const synced = tx.objectStore("meta").get("lastSyncAt");
                tx.oncomplete = () => {
                  resolve({ rows: rows.result, syncedAt: synced.result ?? null });
                  db.close();
                };
                tx.onerror = () => reject(tx.error);
              };
            }),
        );
        return seen.syncedAt && seen.rows > 0 ? seen : false;
      },
      { timeout: 60_000 },
    );
    check(
      mirrored.rows > 0,
      "the phone has a local copy to work from",
      `${mirrored.rows} log rows`,
    );

    /* -- 2. offline ---------------------------------------------------------------- */
    console.log("\noffline");
    await context.setOffline(true);
    check(await page.evaluate(() => navigator.onLine === false), "the browser reports offline");

    await page.goto(`${BASE}/private/athletics`);
    check(
      await page.getByText("What is on this phone").isVisible(),
      "a private navigation is answered by the shell",
    );
    check(
      (await page.locator('[aria-current="page"]').first().getAttribute("href")) ===
        "/private/athletics",
      "the shell knows which screen was asked for",
    );
    check(
      await page.getByRole("navigation", { name: /private sections/i }).isVisible(),
      "the shell carries the app's tab bar",
    );

    await page.goto(`${BASE}/`);
    check(await page.getByRole("heading", { level: 1 }).isVisible(), "the portfolio opens offline");
    await page.goto(`${BASE}${PROJECT}`);
    check(
      await page.getByRole("heading", { level: 1 }).isVisible(),
      "a project page opens offline",
      PROJECT,
    );

    // Opening is not the same as being readable. Until 2026-09-05 §2.2 cached the pages and
    // their scripts but not the optimised images, so a project page offline was text and empty
    // boxes — which is not something you show anyone (D-177).
    const images = await waitFor(
      "the project page's images to settle",
      async () => {
        const seen = await page.evaluate(() => {
          const imgs = [...document.querySelectorAll("img")];
          return {
            total: imgs.length,
            loaded: imgs.filter((i) => i.complete && i.naturalWidth > 0).length,
          };
        });
        return seen.total > 0 && seen.loaded > 0 ? seen : false;
      },
      { timeout: 15_000 },
    ).catch(() => ({ total: 0, loaded: 0 }));
    check(
      images.loaded > 0,
      "its images render offline",
      `${images.loaded}/${images.total} loaded`,
    );

    // Search, offline, at the same URL the online box posts to (§2.3). The term is deliberately
    // one nothing can match: the assertion is that the *search ran on the phone* and said so,
    // which is true regardless of what this device happens to have synced. Asserting on a real
    // hit would make the check depend on the contents of a real log.
    await page.goto(`${BASE}/private/log?q=zzzznotathing`);
    check(
      await page
        .getByText(/nothing on this phone matches/i)
        .waitFor({ timeout: 10_000 })
        .then(() => true)
        .catch(() => false),
      "the log is searchable with no network",
    );

    /* -- 3. write a training entry with two sets, with no network ------------------- */
    console.log("\nwriting with no network");
    await page.goto(`${BASE}/private/log`);
    await page.waitForSelector("#f-exercise");

    // Watch for the connectivity events, rather than assuming the harness fires them. Installed
    // after the last navigation, since a document load throws the listener away.
    await page.evaluate(() => {
      window.__connectivity = [];
      addEventListener("online", () => window.__connectivity.push("online"));
      addEventListener("offline", () => window.__connectivity.push("offline"));
    });

    await page.fill("#f-exercise", `Bench Press (${STAMP})`);
    await page.fill('[id="f-sets.0.weightLbs"]', "185");
    await page.fill('[id="f-sets.0.reps"]', "5");
    await page.getByRole("button", { name: /add set/i }).click();
    await page.waitForSelector('[id="f-sets.1.weightLbs"]');
    await page.fill('[id="f-sets.1.weightLbs"]', "175");
    await page.fill('[id="f-sets.1.reps"]', "8");
    await page.getByRole("button", { name: /log training/i }).click();

    check(
      await page
        .getByText(/saved to training on this phone/i)
        .waitFor({ timeout: 10_000 })
        .then(() => true)
        .catch(() => false),
      "the entry saves with the radio off",
    );

    const queued = await readOutbox(page);
    const logOps = queued.filter((op) => op.entity === "log_entry" && op.op === "create");
    check(logOps.length === 1, "exactly one entry is queued", `queued ${queued.length}`);
    created = logOps.map((op) => op.clientId);

    /* -- 4. back online, and do nothing ------------------------------------------- */
    console.log("\nback online, without going anywhere");
    await context.setOffline(false);

    // `navigator.onLine` flips the instant the harness is asked, but the network stack behind
    // it is not ready — and specifically, the *first* POST after a restore fails even once a
    // GET has succeeded. Announcing the restore before that produced a real failed flush, and
    // one failed attempt puts the op into backoff, which is then what the rest of the run would
    // be measuring rather than the feature.
    //
    // So the readiness gate is a request of the same shape as the one under test: an empty-ops
    // POST to the app's own endpoint, which reads and writes nothing. It doubles as proof that
    // the endpoint is reachable and the session is accepted, and it does **not** stand in for
    // the flush — no op is sent by it, and the entry still has to leave by the app's own
    // trigger and its own runner.
    //
    // On a real phone this is what `online` already means: the radio is back. Here it has to
    // be established rather than assumed.
    const reachable = await waitFor("the sync endpoint to answer again", () =>
      page.evaluate(() =>
        fetch("/api/sync", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ops: [], since: 0 }),
        })
          .then((r) => (r.ok ? r.status : false))
          .catch(() => false),
      ),
    );
    check(
      reachable === 200,
      "the sync endpoint answers once the network is back",
      `status ${reachable}`,
    );
    check(await page.evaluate(() => navigator.onLine === true), "the browser reports online");

    // Playwright flips `navigator.onLine` through CDP without dispatching the DOM event a real
    // OS dispatches, so the app would sit there having never been told. Measured rather than
    // assumed — and where the harness does not fire it, this stands in for the OS explicitly
    // rather than quietly calling `requestSync`, which would bypass the trigger under test.
    const firedNatively = await page.evaluate(() =>
      (window.__connectivity ?? []).includes("online"),
    );
    if (!firedNatively) await page.evaluate(() => dispatchEvent(new Event("online")));
    console.log(
      `  note  the online event ${firedNatively ? "fired natively" : "was dispatched for the harness"}`,
    );

    // The point of this step. Before D-175 the outbox sat here until /private was opened, so
    // this would have hung — the page is still the shell and nothing has been navigated to.
    const drained = await waitFor(
      "the outbox to empty on its own",
      async () => (await readOutbox(page)).length === 0,
      { timeout: 45_000 },
    ).then(
      () => true,
      () => false,
    );
    check(drained, "the shell sends what it wrote, unprompted");

    if (!drained) {
      // Why it did not go, in the terms the outbox itself uses.
      const stuck = await page.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const open = indexedDB.open("2ndmind");
            open.onerror = () => reject(open.error);
            open.onsuccess = () => {
              const db = open.result;
              const all = db.transaction("outbox", "readonly").objectStore("outbox").getAll();
              all.onsuccess = () => {
                resolve(
                  all.result.map((o) => ({
                    entity: o.entity,
                    state: o.state,
                    attempts: o.attempts,
                    lastError: o.lastError,
                  })),
                );
                db.close();
              };
              all.onerror = () => reject(all.error);
            };
          }),
      );
      console.log(`  why   outbox: ${JSON.stringify(stuck)}`);
      if (failedRequests.length) console.log(`  why   requests: ${failedRequests.join(" | ")}`);
      if (consoleLines.length)
        console.log(`  why   console: ${consoleLines.slice(0, 6).join(" | ")}`);
    }

    /* -- 5. and it is in the database, once ---------------------------------------- */
    console.log("\nin the database");
    const rows = await sql`
      select client_id, category, data, deleted_at
      from log_entries where client_id = ANY(${created})`;
    check(
      rows.length === created.length,
      "every entry arrived",
      `${rows.length}/${created.length}`,
    );
    check(
      new Set(rows.map((r) => r.client_id)).size === rows.length,
      "no entry arrived twice",
      `${rows.length} rows, ${new Set(rows.map((r) => r.client_id)).size} distinct`,
    );
    check(
      rows.every((r) => r.deleted_at === null),
      "the entries are live, not tombstoned",
    );
    const sets = rows[0]?.data?.sets;
    check(
      Array.isArray(sets) && sets.length === 2,
      "both sets survived the trip",
      JSON.stringify(sets),
    );
  } finally {
    /* -- teardown ----------------------------------------------------------------- */
    if (browser) await browser.close();
    server.kill();

    if (created.length > 0) {
      // Deleting by SQL, which the app itself cannot do since §1.2 made every delete a
      // tombstone. Guarded twice: the list must be non-empty and every id must look like the
      // uuid this run generated, so a bug here can only ever remove rows this script created.
      const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (created.every((id) => uuid.test(id))) {
        const gone =
          await sql`delete from log_entries where client_id = ANY(${created}) returning id`;
        console.log(`\ncleaned up ${gone.length} row(s) this run created.`);
      } else {
        console.error(`\nREFUSED to clean up: ids do not look generated — ${created.join(", ")}`);
        failures.push("teardown refused to delete unrecognised ids");
      }
    }
  }

  console.log("");
  if (failures.length > 0) {
    console.error(`${failures.length} check(s) failed:`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log("the offline round trip holds.");
}

await main();
