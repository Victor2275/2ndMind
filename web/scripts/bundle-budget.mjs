/**
 * The public JavaScript budget — V4 §7.1/§7.3 (Q459, Q461).
 *
 * Q459 sets the budget at **under 90KB gzipped for a public page**; Q461 asks for a gate rather
 * than a number somebody looks up occasionally.
 *
 * ## Why this exists even though the plan says 7.2 is done
 *
 * V4 item 7.2 is two things — "bundle gate + drop `ProjectGrid`'s client boundary" — and D-223
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

/** Q459: under 90KB gzipped, per public page. */
const BUDGET_KB = Number(process.env.BUNDLE_BUDGET ?? 90);

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
  { name: "now", url: "/now" },
  { name: "projects", url: "/projects" },
  { name: "project-detail", url: "/projects/solenoid-bit-reader" },
  { name: "resume", url: "/resume/swe" },
];

const browser = await chromium.launch();
let over = 0;

console.log(`Public JavaScript, gzipped, against a ${BUDGET_KB}KB budget (Q459):\n`);

for (const route of ROUTES) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  /** url -> gzipped bytes, so a chunk requested twice is counted once. */
  const chunks = new Map();

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
    } catch {
      // A response whose body is gone by the time this runs — a redirect, or a request the
      // page cancelled. Not counted rather than guessed at.
    }
  });

  await page.goto(BASE + route.url, { waitUntil: "networkidle", timeout: 60_000 });
  // `networkidle` fires before a late `import()` settles on some pages; one extra frame and a
  // short settle catches the ones the first load kicks off.
  await page.waitForTimeout(1500);

  const total = [...chunks.values()].reduce((a, b) => a + b, 0);
  const kb = total / 1024;
  const bad = kb > BUDGET_KB;
  if (bad) over += 1;

  console.log(
    `  ${route.name.padEnd(16)} ${kb.toFixed(1).padStart(7)} KB  ` +
      `${String(chunks.size).padStart(3)} chunks` +
      (bad ? `  <-- over by ${(kb - BUDGET_KB).toFixed(1)} KB` : ""),
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

console.log(
  over > 0
    ? `\n${over} public route(s) over the ${BUDGET_KB}KB budget.`
    : `\nEvery public route is inside the ${BUDGET_KB}KB budget.`,
);

if (over > 0) process.exitCode = 1;
