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
import { neon } from "@neondatabase/serverless";

import { checker, openSignedIn, startServer, waitFor, workerState } from "./lib/e2e.mjs";

const PORT = Number(process.env.E2E_PORT ?? 3210);
const BASE = `http://127.0.0.1:${PORT}`;

/** A public project that exists and is in the sitemap, so §2.2 will have precached it. */
const PROJECT = "/projects/solenoid-bit-reader";

/** Marks this run's rows, so a human reading the log knows where they came from. */
const STAMP = `e2e ${new Date().toISOString()}`;

const { check, failures } = checker();

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
                // Carried since V4 Phase 2++ Stage 8, for the one check that needs to see
                // *what* was queued rather than only that something was.
                payload: op.payload,
              })),
            );
            db.close();
          };
        };
      }),
  );
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
  const server = startServer(PORT);
  let browser;
  let created = [];
  let createdExercises = [];

  try {
    await waitFor("the server to answer", async () => (await fetch(BASE)).ok, { timeout: 60_000 });
    console.log(`\nserver up on ${BASE}\n`);

    ({ browser } = await openSignedIn(BASE, secret));
    const context = browser.contexts()[0];
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
                const tx = db.transaction(["log_entries", "exercises", "meta"], "readonly");
                const rows = tx.objectStore("log_entries").count();
                // The catalogue has to be on the phone before the radio goes off, or the
                // session screen offline is a search box over nothing (V4 Phase 2).
                const catalogue = tx.objectStore("exercises").count();
                const synced = tx.objectStore("meta").get("lastSyncAt");
                tx.oncomplete = () => {
                  resolve({
                    rows: rows.result,
                    catalogue: catalogue.result,
                    syncedAt: synced.result ?? null,
                  });
                  db.close();
                };
                tx.onerror = () => reject(tx.error);
              };
            }),
        );
        return seen.syncedAt && seen.catalogue > 0 ? seen : false;
      },
      { timeout: 60_000 },
    );
    check(
      mirrored.catalogue > 0,
      "the phone has a local copy to work from",
      `${mirrored.rows} log rows, ${mirrored.catalogue} exercises`,
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
        "/private/athletics/log",
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

    /* -- 3. log a training session with two sets, with no network ------------------- */
    //
    // **Milestone B** (V4 Phase 2): *you log a gym session on the phone, offline, and it syncs.*
    //
    // This step used to drive the quick log's Training tab, which Phase 2.7 retired — training
    // is a session now, written through the aggregate op (`SYNC_DESIGN.md` §4a). The change is
    // not cosmetic: what leaves the phone is **one op carrying the session and all its sets**,
    // and what arrives is a `workouts` row whose `workout_sets` point at a foreign key the phone
    // never saw.
    console.log("\nwriting with no network");
    await page.goto(`${BASE}/private/athletics/log`);

    // Watch for the connectivity events, rather than assuming the harness fires them. Installed
    // after the last navigation, since a document load throws the listener away.
    await page.evaluate(() => {
      window.__connectivity = [];
      addEventListener("online", () => window.__connectivity.push("online"));
      addEventListener("offline", () => window.__connectivity.push("offline"));
    });

    // `#session-title` rather than the label: `RecentSessions` below the form grew a
    // "Delete session <title>" button, so "Session" now matches two things.
    await page.locator("#session-title").fill(`Push A (${STAMP})`);

    // Searched on the phone, over the mirrored catalogue — the whole reason it is a synced table
    // rather than an API call. `bnch` rather than `bench`, so the fuzzy matcher is exercised
    // here too and not only in its unit tests.
    //
    // The picker is a sheet with multi-select since V4 Phase 2++ Stage 5: tapping a row
    // *selects* it, and a second control adds everything selected — "add three exercises" in one
    // pass rather than three trips. Driving it the old way is what broke this step, and the
    // check below is what would say so out loud next time.
    await page.getByRole("button", { name: /add exercise/i }).click();
    await page.getByLabel("Search exercises").fill("bnch");
    await page
      .getByRole("button", { name: /^Bench Press/ })
      .first()
      .click();
    await page.getByRole("button", { name: /^Add 1 exercise$/ }).click();
    check(
      await page
        .getByRole("button", { name: /^Remove Bench Press/ })
        .first()
        .isVisible(),
      "the picker added the selected exercise",
    );

    await page.locator('[id$="-0-weightLbs"]').first().fill("185");
    await page.locator('[id$="-0-reps"]').first().fill("5");
    await page.getByRole("button", { name: /same again/i }).click();
    await page.locator('[id$="-1-weightLbs"]').first().fill("175");
    await page.locator('[id$="-1-reps"]').first().fill("8");

    await page.getByRole("button", { name: /save session/i }).click();

    check(
      await page
        .getByText(/session saved/i)
        .waitFor({ timeout: 10_000 })
        .then(() => true)
        .catch(() => false),
      "the session saves with the radio off",
    );

    const queued = await readOutbox(page);
    const sessionOps = queued.filter((op) => op.entity === "workout" && op.op === "create");
    // **One** op, not one per set. That is the aggregate, and it is what lets the server apply
    // the session in a single transaction and assign the foreign key itself.
    check(sessionOps.length === 1, "the whole session is one queued op", `queued ${queued.length}`);
    check(
      queued.every((op) => op.entity !== "workout_set"),
      "no set is queued separately",
    );
    created = sessionOps.map((op) => op.clientId);

    /* -- 3b. create and edit an exercise, still with no network --------------------- */
    //
    // V4 Phase 2++ Stage 4 made the catalogue editable and Stage 2 made `exercises` writable
    // through the same outbox as everything else. The property worth an end-to-end check is that
    // both halves work **with the radio off**: the catalogue is a synced table precisely so the
    // gym-basement screen does not depend on a network, and an edit that quietly needed one
    // would only ever be discovered standing in a gym.
    const invented = `E2E Movement ${STAMP}`;
    console.log("\ncreating an exercise with no network");

    await page.getByRole("button", { name: /add exercise/i }).click();
    // Waited for rather than assumed: the sheet is a portal that animates in, and the create
    // button is disabled until the name field has something in it. Clicking through either of
    // those is a no-op that looks exactly like a feature that does not work.
    const nameField = page.getByLabel("Add a movement by name");
    await nameField.waitFor({ state: "visible", timeout: 10_000 });
    await nameField.fill(invented);
    const addByName = page.getByRole("button", { name: "Add", exact: true });
    await addByName.waitFor({ state: "visible", timeout: 10_000 });
    await page
      .waitForFunction(
        () =>
          !document.querySelector(
            '[data-slot="sheet-content"] button:disabled[class*="border-dashed"]',
          ),
        { timeout: 5_000 },
      )
      .catch(() => {});
    await addByName.click();
    // The write is one IndexedDB transaction; give it a beat before reading the outbox back.
    await page.waitForTimeout(750);

    const afterCreate = await readOutbox(page);
    if (afterCreate.filter((op) => op.entity === "exercise").length === 0) {
      // The sheet says why when it refuses — surface it rather than reporting only a count.
      const said = await page
        .locator('[data-slot="sheet-content"] [role="status"]')
        .first()
        .textContent()
        .catch(() => null);
      console.log(`  why   the sheet said: ${said ?? "(nothing)"}`);
    }
    const exerciseOps = afterCreate.filter((op) => op.entity === "exercise");
    check(exerciseOps.length === 1, "the new exercise is one queued op", `${exerciseOps.length}`);
    createdExercises = exerciseOps.map((op) => op.clientId);

    // And edit it, from the browser's detail page — reached offline, off the precached shell.
    await page.goto(`${BASE}/private/athletics/exercises/${encodeURIComponent(invented)}`);
    // Waited for, not sampled: offline this page is the precached shell, which hydrates and
    // *then* reads IndexedDB for the row. Checking the instant the navigation resolves measures
    // the shell's own "not found on this device yet" placeholder, which is a true statement
    // about a moment rather than about the feature.
    const detailShown = await page
      .getByRole("heading", { name: invented })
      .waitFor({ state: "visible", timeout: 15_000 })
      .then(() => true)
      .catch(() => false);
    check(detailShown, "the new exercise has a detail page offline");

    await page.getByRole("button", { name: "Edit" }).click();
    await page.getByLabel("How to").fill("Written with the radio off.");
    // `.last()`: the shell's own capture box is above every view and has a Save of its own, so
    // "Save" alone is ambiguous here in a way it is not on the live route.
    await page
      .getByRole("button", { name: /^Save$/ })
      .last()
      .click();
    await page.waitForTimeout(750);

    const afterEdit = await readOutbox(page);
    const edits = afterEdit.filter((op) => op.entity === "exercise" && op.op === "update");
    check(edits.length === 1, "the edit queues its own op", `${edits.length}`);
    check(
      edits[0]?.payload?.userEditedFields?.includes("howTo") === true,
      "the edit records which field a person changed",
      JSON.stringify(edits[0]?.payload?.userEditedFields),
    );

    // Back to the logger, so step 4 flushes from the screen it started on.
    await page.goto(`${BASE}/private/athletics/log`);

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
    //
    // What arrives is the half the phone could not do for itself: a `workouts` row, and
    // `workout_sets` pointing at a `serial` this device has never seen. The foreign key is the
    // thing being checked — it is the whole reason §4a made a session one atomic op rather than
    // a parent write followed by child writes.
    console.log("\nin the database");
    const rows = await sql`
      select id, client_id, title, source, external_id, deleted_at
      from workouts where client_id = ANY(${created})`;
    check(
      rows.length === created.length,
      "every session arrived",
      `${rows.length}/${created.length}`,
    );
    check(
      new Set(rows.map((r) => r.client_id)).size === rows.length,
      "no session arrived twice",
      `${rows.length} rows, ${new Set(rows.map((r) => r.client_id)).size} distinct`,
    );
    check(
      rows.every((r) => r.deleted_at === null),
      "the sessions are live, not tombstoned",
    );
    // Null on purpose: the unique index on `external_id` treats each null as distinct, which is
    // what stops a hand-logged session colliding with a Hevy import (D-026).
    check(
      rows.every((r) => r.external_id === null && r.source === "phone"),
      "it is recorded as a phone session, not an import",
      rows.map((r) => r.source).join(", "),
    );

    const setRows = await sql`
      select s.exercise, s.set_index, s.weight_lbs, s.reps, s.workout_id
      from workout_sets s
      join workouts w on w.id = s.workout_id
      where w.client_id = ANY(${created})
      order by s.set_index`;
    check(setRows.length === 2, "both sets survived the trip", `${setRows.length} sets`);
    check(
      setRows.every((r) => r.workout_id === rows[0]?.id),
      "the server resolved the foreign key the phone never had",
    );
    check(
      setRows.map((r) => Number(r.weight_lbs)).join(",") === "185,175",
      "the numbers are the ones that were typed",
      setRows.map((r) => `${r.weight_lbs}x${r.reps}`).join(" "),
    );

    const exerciseRows = await sql`
      select client_id, name, how_to, user_edited_fields, source, deleted_at
      from exercises where client_id = ANY(${createdExercises})`;
    check(
      exerciseRows.length === createdExercises.length,
      "the exercise invented offline arrived",
      `${exerciseRows.length}/${createdExercises.length}`,
    );
    check(
      exerciseRows.every((r) => r.how_to === "Written with the radio off."),
      "the offline edit arrived with it, not just the create",
      exerciseRows.map((r) => r.how_to).join(" | "),
    );
    check(
      exerciseRows.every((r) => (r.user_edited_fields ?? []).includes("howTo")),
      "user_edited_fields survived the trip, so a reseed will not overwrite the edit",
      exerciseRows.map((r) => JSON.stringify(r.user_edited_fields)).join(" | "),
    );
  } finally {
    /* -- teardown ----------------------------------------------------------------- */
    if (browser) await browser.close();
    server.kill();

    if (created.length > 0) {
      // Deleting by SQL, which the app itself cannot do since §1.2 made every delete a
      // tombstone. Guarded twice: the list must be non-empty and every id must look like the
      // uuid this run generated, so a bug here can only ever remove rows this script created.
      //
      // The sets go with the parent through `ON DELETE CASCADE`, which exists for exactly this —
      // genuine hard deletes, of which there are none in normal operation (§4a).
      const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (created.every((id) => uuid.test(id))) {
        const gone = await sql`delete from workouts where client_id = ANY(${created}) returning id`;
        console.log(`\ncleaned up ${gone.length} session(s) this run created.`);
      } else {
        console.error(`\nREFUSED to clean up: ids do not look generated — ${created.join(", ")}`);
        failures.push("teardown refused to delete unrecognised ids");
      }
    }

    if (createdExercises.length > 0) {
      // Same two guards as the sessions above, and a hard delete for the same reason: as far as
      // the catalogue is concerned this row was never meant to exist.
      const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (createdExercises.every((id) => uuid.test(id))) {
        const gone =
          await sql`delete from exercises where client_id = ANY(${createdExercises}) returning id`;
        console.log(`cleaned up ${gone.length} exercise(s) this run created.`);
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
