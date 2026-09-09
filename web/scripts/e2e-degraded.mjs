/**
 * The app on a connection that is bad but not gone (V4 Phase N8).
 *
 *   npm run e2e:degraded
 *
 * ## Why this is a separate suite from `e2e-offline.mjs`
 *
 * That one stages a connection that is **off**: `fetch` rejects, a `catch` runs, a fallback
 * appears. Every check in it passed on the build that froze on plane wifi, because the
 * condition it stages is not the condition that broke.
 *
 * The condition here is a connection that accepts a request and then **never answers**.
 * `fetch()` has no default timeout, so before Phase N nothing rejected, no `catch` ran, and the
 * screen sat on a skeleton indefinitely. There is no way to see that from a unit test: it needs
 * a real service worker, a real App Router, and a real network stack being held open — which is
 * what `Network.emulateNetworkConditions` over CDP gives.
 *
 * ## The check this exists for
 *
 * **The tab-tap freeze.** Tapping a tab in the installed app is not a navigation — the router
 * intercepts it and fetches an RSC payload instead. N3 gives that fetch a deadline and then
 * deliberately lets it reject, on the understanding that the App Router responds by abandoning
 * the client transition and performing a hard navigation, which the worker answers from the
 * cache.
 *
 * **That last step is framework behaviour, not a documented API.** `DEGRADED_NETWORK.md` says
 * to verify it on a real build rather than trust it, and this is where that happens. If the
 * "a stalled tab tap still reaches a usable screen" check below ever fails, the fallback has to
 * become explicit — a `location.href` from a router error boundary — rather than inherited.
 *
 * ## What it does not do
 *
 * It writes nothing to the database, so unlike the offline suite it needs no teardown and
 * cannot leave anything behind. It still needs a session, because every screen worth measuring
 * is behind one.
 *
 * Local only. Needs `.env.local` for `SESSION_SECRET`.
 */
import { checker, openSignedIn, startServer, waitFor, workerState } from "./lib/e2e.mjs";

const PORT = Number(process.env.E2E_PORT ?? 3211);
const BASE = `http://127.0.0.1:${PORT}`;

/** A public project that exists and is in the sitemap, so §2.2 will have precached it. */
const PROJECT = "/projects/solenoid-bit-reader";

/**
 * The connection being emulated: connected, and answering nothing.
 *
 * Held-open requests rather than CDP's `Network.emulateNetworkConditions`, and the reason is
 * the whole point of this suite. Network emulation is applied to a *target*, and a service
 * worker is its own target — so throttling the page throttles the page's own fetches and leaves
 * every request the worker makes running at full speed. The first version of this file did
 * exactly that and reported the app working beautifully, because the worker was quietly on a
 * perfect connection while the page next to it was on a terrible one.
 *
 * Route interception covers both: with `serviceWorkers: "allow"`, requests the worker issues
 * are routed too. A handler that never resolves is precisely the condition Phase N exists for —
 * the socket is open, the request is out, and nothing comes back. `navigator.onLine` stays
 * `true` throughout, which is the lie the whole phase is built around.
 */
async function stallNetwork(context) {
  let stalling = false;

  await context.route("**/*", async (route) => {
    if (!stalling) return route.continue().catch(() => {});
    // Deliberately never resolved. This is what a stalled connection is.
  });

  return {
    start: () => {
      stalling = true;
    },
    stop: () => {
      stalling = false;
    },
  };
}

/**
 * How long a screen may take to become usable on a stalled connection before it counts as
 * frozen.
 *
 * Twenty seconds is deliberately loose — it is not measuring how fast the fallback is, it is
 * measuring that one exists. The value before Phase N was infinity, and the gap between
 * "infinity" and "bounded at all" is the entire phase. A tight bound here would make this suite
 * fail on a busy laptop and teach everyone to ignore it, which is worse than a loose one.
 *
 * For reference, the budgets say the worst honest case is a stalled tab tap: three seconds for
 * the RSC payload to give up, then three more for the hard navigation it falls back to. Six.
 * Anything approaching twenty means something is not falling back at all.
 */
const USABLE_MS = 20_000;

const { check, failures } = checker();

/** Runs `action` and reports how long it took to reach a usable screen. */
async function timed(label, action, page) {
  const started = Date.now();
  const ok = await action().then(
    () => true,
    () => false,
  );
  const took = Date.now() - started;
  check(ok && took < USABLE_MS, label, `${took}ms`);

  // What the screen actually was, in the words on it. Reconstructing that from a bare
  // "timed out" is the slow way round, and this is a suite that costs a build to re-run.
  if (!ok && page) {
    const seen = await page
      .evaluate(() => ({
        url: location.pathname + location.search,
        text: document.body?.innerText?.slice(0, 200) ?? "",
      }))
      .catch(() => ({ url: "?", text: "(the page could not be read)" }));
    console.log(`  why   at ${seen.url}: ${JSON.stringify(seen.text)}`);
  }
  return took;
}

async function main() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    // Refused rather than skipped. A suite that quietly downgrades to "checked nothing" when a
    // variable is missing is how a green run stops meaning anything.
    console.error("e2e: SESSION_SECRET is required (it lives in .env.local).");
    process.exit(2);
  }

  const server = startServer(PORT);
  let browser;

  try {
    await waitFor("the server to answer", async () => (await fetch(BASE)).ok, { timeout: 60_000 });
    console.log(`\nserver up on ${BASE}\n`);

    ({ browser } = await openSignedIn(BASE, secret));
    const context = browser.contexts()[0];
    const page = await context.newPage();

    const consoleLines = [];
    page.on("console", (m) => {
      if (m.type() === "error") consoleLines.push(m.text());
    });

    /* -- 1. online, and let the worker install ------------------------------------ */
    console.log("online, warming the worker");
    await page.goto(`${BASE}/private/sync`, { timeout: 60_000 });
    check(
      !new URL(page.url()).pathname.startsWith("/signin"),
      "the session is accepted",
      page.url(),
    );

    await waitFor(
      "the worker to precache the shell and the portfolio",
      async () => {
        const s = await workerState(page);
        // The project page is part of the condition rather than an assertion after it: §2.2
        // precaches during `activate`, so checking the instant the shell lands is a race that
        // passes or fails with the weather — and when it loses, the portfolio check below
        // measures the deadline path instead of the cache path it is supposed to measure.
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
    check(true, "the worker is controlling and has precached");

    /* -- 2. the connection goes bad, without going away --------------------------- */
    console.log("\nstalled: connected, answering nothing");
    const network = await stallNetwork(context);
    network.start();

    // The premise of the whole phase, asserted rather than assumed. If this ever reports false
    // the emulation has become plain offline, and every check below would be re-testing the
    // case that already worked.
    check(
      await page.evaluate(() => navigator.onLine === true),
      "the browser still believes it is online — which is the entire problem",
    );

    /* -- 3. the tab-tap freeze (N3) ------------------------------------------------ */
    //
    // The check this suite exists for. This is a client-side transition, not a navigation: the
    // router fetches an RSC payload, which before Phase N had no deadline and never settled.
    console.log("\ntapping a tab, the way the freeze was reported");
    await timed(
      "a stalled tab tap still reaches a usable screen",
      async () => {
        await page.getByRole("link", { name: /train/i }).first().click();
        // The shell's own heading, not merely the word "Train" — which is on the tab that was
        // just tapped and would make this pass without anything having happened.
        await page
          .getByText(/what is on this phone/i)
          .first()
          .waitFor({
            timeout: USABLE_MS,
            state: "visible",
          });
      },
      page,
    );

    /* -- 4. a hard navigation ------------------------------------------------------ */
    console.log("\nnavigating directly");
    await timed(
      "a stalled private navigation falls back to the shell",
      async () => {
        // `commit` rather than the default `load`: the question is whether the worker answers,
        // not whether every subresource finished arriving over a 256 byte/s link.
        await page
          .goto(`${BASE}/private/athletics`, { timeout: USABLE_MS, waitUntil: "commit" })
          .catch(() => {});
        await page
          .getByText(/what is on this phone/i)
          .first()
          .waitFor({ timeout: USABLE_MS, state: "visible" });
      },
      page,
    );

    /* -- 5. the public site, which should not wait at all (N2) --------------------- */
    //
    // Stale-while-revalidate. A precached page is this build's page, so the round trip could
    // only ever confirm what is already on disk — and on this connection it would cost the
    // whole budget to do it.
    console.log("\nopening the portfolio");
    await timed(
      "a precached public page opens without waiting for the network",
      async () => {
        await page
          .goto(`${BASE}${PROJECT}`, { timeout: USABLE_MS, waitUntil: "commit" })
          .catch(() => {});
        await page.getByRole("heading", { level: 1 }).first().waitFor({ timeout: USABLE_MS });
      },
      page,
    );

    /* -- 6. the app says so (N7) --------------------------------------------------- */
    console.log("\nwhat the app says about it");
    await page
      .goto(`${BASE}/private/log`, { timeout: USABLE_MS, waitUntil: "commit" })
      .catch(() => {});
    const said = await page
      .getByText(/connection is poor|no connection/i)
      .first()
      .waitFor({ timeout: USABLE_MS, state: "visible" })
      .then(
        () => true,
        () => false,
      );
    check(said, "the app admits the connection is poor rather than looking broken");

    /* -- 7. and it recovers -------------------------------------------------------- */
    //
    // The half that stops all of the above being satisfied by an app that simply gave up on the
    // network. A restored connection has to go back to using it.
    console.log("\nconnection restored");
    network.stop();
    await page.goto(`${BASE}/private/sync`, { timeout: 30_000 });
    check(
      new URL(page.url()).pathname === "/private/sync",
      "a good connection serves the real page again",
      page.url(),
    );
    const quiet = await page
      .getByText(/connection is poor/i)
      .first()
      .waitFor({ timeout: 5_000, state: "visible" })
      .then(
        () => false,
        () => true,
      );
    check(quiet, "and stops saying the connection is poor");

    if (failures.length && consoleLines.length) {
      console.log(`\n  why   console: ${consoleLines.slice(0, 8).join(" | ")}`);
    }
  } finally {
    if (browser) await browser.close();
    server.kill();
  }

  console.log("");
  if (failures.length > 0) {
    console.error(`${failures.length} check(s) failed:`);
    for (const f of failures) console.error(`  - ${f}`);
    console.error(
      "\nIf it is the tab tap, the App Router's hard-navigation fallback did not hold and\n" +
        "N3 needs an explicit `location.href` from a router error boundary instead.",
    );
    process.exit(1);
  }
  console.log("a bad connection changes how fast the app is, never whether it works.");
}

await main();
