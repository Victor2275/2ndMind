/**
 * The public JavaScript budget — V4 §7.1/§7.3 (Q459, Q461).
 *
 * Q459 sets the budget at **under 90KB gzipped for a public page**; Q461 asks for a gate rather
 * than a number somebody looks up occasionally.
 *
 * ## Why this exists even though the plan says 7.2 is done
 *
 * V4 item 7.2 is two things — "bundle gate + drop `ProjectGrid`'s client boundary" — and D-354
 * shipped the second and recorded the item as complete, because moving the filter into the URL
 * happened to remove the boundary as a side effect. The gate itself was never built. Nothing
 * in this repo measured a bundle until now, which means the 90KB budget has been a number in a
 * planning document rather than a constraint on the code for the whole of V4.
 *
 * ## What it measures, and why not `next build`'s table
 *
 * `next build` prints per-route "First Load JS", which is a *static* accounting of the chunks a
 * route imports. This drives a real browser at the production server and sums what it actually
 * downloads, because those are different numbers and the second is the one a visitor pays:
 *
 *   - a chunk fetched by a `<Script>` tag, a dynamic `import()` or the service worker never
 *     appears in the build table, and is still bytes on the wire;
 *   - a chunk shared with another route is counted once per route in the table and once in
 *     total by a browser with a warm cache — this measures the cold visit, which is the one
 *     that decides whether the page felt fast.
 *
 * **Gzip, not brotli.** Both are served in practice and brotli is smaller, so gzip is the
 * conservative read: a page that fits the budget here fits it everywhere. `content-encoding` is
 * whatever the server negotiated, so the bytes are re-compressed here rather than trusted — the
 * local `next start` serves some assets uncompressed, and counting those raw would fail the
 * gate for a reason that does not exist in production.
 *
 *   npm run build && npm start      # in another terminal
 *   npm run bundle
 *
 * `BUNDLE_BASE` points it at another origin; `BUNDLE_BUDGET` overrides the budget in KB.
 */
import { chromium } from "playwright";
import { gzipSync } from "node:zlib";

const BASE = process.env.BUNDLE_BASE ?? process.env.SHOTS_BASE ?? "http://localhost:3000";

/**
 * Q459's number: under 90KB gzipped, per public page. **It is not reachable and is kept as the
 * aspiration, not the gate** (D-320, and now measured in detail — D-329).
 *
 * Two chunks account for 112.7KB of every public page and neither is application code:
 * react-dom (69.9KB gzipped) and the React Server Components / App Router client runtime
 * (42.8KB — identifiable by `resolved_model`, `server-action` and the `x-nextjs-*` header
 * names inside it). Nothing this codebase does can remove either while it is a Next 16 + React
 * 19 app, so 90 was a number set without measuring and the gate below would be permanently red
 * against it — which is the state that trains everyone to ignore a gate.
 */
const ASPIRATION_KB = Number(process.env.BUNDLE_BUDGET ?? 90);

/**
 * What each route is **currently allowed**, in KB gzipped. A route over its number fails.
 *
 * Same mechanism and same reasoning as `TAP_BUDGET` and `CONTRAST_BUDGET` in `shots.mjs`: the
 * honest position is a real number that ratchets, not a wish that stays red. **These only ever
 * go down.** Re-measure with `npm run bundle -- --save` and paste the block it prints; a value
 * that goes up needs a sentence in `DECISIONS.md` saying what bought it.
 *
 * Recorded 2026-09-22, after V4 §8.4 took `zod` off the public bundle and §8.5 removed four
 * unused dependencies. The headroom over the measured value is deliberately zero — the point is
 * to notice the next regression, not to leave room for one.
 *
 * **These numbers replace a set recorded hours earlier that were ~22KB too low** (D-336). The
 * first measurement was taken against a `next start` left over from an earlier build, because
 * `npm start` fails silently when the port is held and the *old* server answers. Re-record only
 * from a run you have seen agree with itself at least twice — see the note on stability below.
 */
const ROUTE_BUDGET = {
  home: 169,
  now: 176,
  projects: 176,
  "project-detail": 176,
  resume: 169,
};

/**
 * The public routes, and only the public routes.
 *
 * The private app is deliberately not budgeted. It is an installed PWA behind a passkey that
 * one person opens on a phone he owns, its assets are precached by the service worker after the
 * first visit, and it does things — a logger, a picker, a sync runner — that cannot be done
 * without JavaScript. The public site is the opposite on every count: strangers, cold caches,
 * one visit, and a portfolio that is mostly text. A budget that covered both would have to be
 * loose enough to be meaningless for the half that matters.
 */
const ROUTES = [
  { name: "home", url: "/" },
  { name: "projects", url: "/projects" },
  { name: "project-detail", url: "/projects/solenoid-bit-reader" },
  { name: "resume", url: "/resume/swe" },
];

const SAVE = process.argv.includes("--save");

const browser = await chromium.launch();
let over = 0;

/** route name -> Map(url -> gzipped bytes), kept so the shared floor can be computed after. */
const perRoute = new Map();

console.log(
  `Public JavaScript, gzipped. Gate is the per-route budget; ${ASPIRATION_KB}KB is Q459's ` +
    `aspiration and is not reachable (D-329).\n`,
);

for (const route of ROUTES) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  /** url -> gzipped bytes, so a chunk requested twice is counted once. */
  const chunks = new Map();

  /**
   * When the last *script* response landed — the signal `networkidle` could not give (D-328).
   *
   * Counting in-flight requests is what `networkidle` does and it is why this gate could not
   * finish: `/projects` renders a link per project, Next prefetches every one of them, and the
   * connection therefore never goes quiet for the required 500ms. The run died at the 60s
   * timeout having measured two of five routes — so a gate that existed reported nothing about
   * three of the pages it was written for, which is worse than not having it, because the two
   * numbers it did print looked like a complete answer.
   *
   * Scripts are what this gate measures, so script quiet is the condition it should wait on.
   * Prefetches are already filtered below and never touch this clock.
   */
  let lastScriptAt = Date.now();

  page.on("response", async (response) => {
    const url = response.url();
    if (!response.ok()) return;

    // **Only scripts the page actually runs.** Next prefetches the routes it can see links to,
    // and those arrive on the same connection as real chunks — counting them measured the
    // whole site rather than the page, and inflated every route here to ~235KB. A prefetch is
    // issued as `fetch`/`other`; a `<script>` the document executes is `script`. That
    // distinction is the difference between "what this page costs" and "what this page costs
    // plus everything it links to".
    if (response.request().resourceType() !== "script") return;

    const type = response.headers()["content-type"] ?? "";
    if (!type.includes("javascript") && !/\.js(\?|$)/.test(url)) return;
    try {
      // `body()` is the decoded bytes, so this re-compresses rather than trusting whatever
      // `content-encoding` the local server happened to negotiate.
      const body = await response.body();
      chunks.set(url, gzipSync(body).length);
      lastScriptAt = Date.now();
    } catch {
      // A response whose body is gone by the time this runs — a redirect, or a request the
      // page cancelled. Not counted rather than guessed at.
    }
  });

  // `load`, not `networkidle` — see `lastScriptAt`. The document and its own subresources are
  // what `load` waits for, and everything after that is settled by the quiet window below.
  await page.goto(BASE + route.url, { waitUntil: "load", timeout: 60_000 });

  // Wait for scripts to stop arriving, capped so a page that never settles fails loudly with a
  // number rather than hanging. The cap is generous because it is only ever reached when
  // something is wrong; the normal path exits after QUIET_MS.
  const QUIET_MS = 1_500;
  const CAP_MS = 20_000;
  const startedAt = Date.now();
  while (Date.now() - lastScriptAt < QUIET_MS && Date.now() - startedAt < CAP_MS) {
    await page.waitForTimeout(100);
  }
  if (Date.now() - startedAt >= CAP_MS) {
    console.log(`  ${route.name.padEnd(16)} scripts never stopped arriving after ${CAP_MS}ms`);
  }

  perRoute.set(route.name, chunks);

  const total = [...chunks.values()].reduce((a, b) => a + b, 0);
  const kb = total / 1024;
  const budget = ROUTE_BUDGET[route.name] ?? ASPIRATION_KB;
  const bad = kb > budget;
  if (bad) over += 1;

  console.log(
    `  ${route.name.padEnd(16)} ${kb.toFixed(1).padStart(7)} KB / ${String(budget).padStart(3)}  ` +
      `${String(chunks.size).padStart(3)} chunks` +
      (bad ? `  <-- over its budget by ${(kb - budget).toFixed(1)} KB` : ""),
  );

  // The four largest, so an overage is actionable rather than just known.
  if (bad) {
    const biggest = [...chunks].sort((a, b) => b[1] - a[1]).slice(0, 4);
    for (const [url, size] of biggest) {
      console.log(`        ${(size / 1024).toFixed(1).padStart(7)} KB  ${url.split("/").pop()}`);
    }
  }

  await context.close();
}

await browser.close();

/**
 * Chunks every public route downloads — the shared floor.
 *
 * **Not the same thing as "the framework", and an earlier version of this label said it was**
 * (D-336). Two of these chunks are react-dom (69.9KB) and the RSC / App Router client runtime
 * (42.8KB), which application work genuinely cannot touch. The rest — about 56KB — is the root
 * layout's own client components: `ErrorWatch`, `ThemeProvider`, `ServiceWorker` and
 * `@vercel/analytics`, mounted on every page including the portfolio. That part *is* reachable,
 * and calling the whole number a floor hid the largest remaining opportunity on the public site.
 *
 * Printed separately because the per-route total is not the actionable number, and reading it
 * as one is how the 90KB budget got set in the first place.
 */
const names = [...perRoute.keys()];
if (names.length > 1) {
  const first = perRoute.get(names[0]);
  const shared = [...first].filter(([url]) => names.every((n) => perRoute.get(n).has(url)));
  const floorKb = shared.reduce((a, [, size]) => a + size, 0) / 1024;

  console.log(
    `\n  Shared by every route  ${floorKb.toFixed(1).padStart(7)} KB in ${shared.length} chunks`,
  );
  console.log(`  — react-dom (69.9) and the RSC/App Router runtime (42.8) are fixed. The rest is`);
  console.log(`    the root layout's own client components, and IS reachable. See D-336.`);
  console.log(`  Route-specific code on top:`);
  for (const [name, chunks] of perRoute) {
    const own = [...chunks].filter(([url]) => !shared.some(([s]) => s === url));
    const ownKb = own.reduce((a, [, size]) => a + size, 0) / 1024;
    console.log(`      ${name.padEnd(16)} ${ownKb.toFixed(1).padStart(6)} KB`);
  }
}

if (SAVE) {
  console.log(`\nconst ROUTE_BUDGET = {`);
  for (const [name, chunks] of perRoute) {
    const kb = [...chunks.values()].reduce((a, b) => a + b, 0) / 1024;
    const key = /^[a-z][a-z0-9]*$/i.test(name) ? name : JSON.stringify(name);
    console.log(`  ${key}: ${Math.ceil(kb)},`);
  }
  console.log(`};`);
}

console.log(
  over > 0
    ? `\n${over} public route(s) over budget.`
    : `\nEvery public route is inside its budget.`,
);

if (over > 0) process.exitCode = 1;
