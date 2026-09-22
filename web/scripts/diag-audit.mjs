/**
 * Groups the §7.1 audit offenders by component, across every page, so the decision about what
 * to fix and what to allowlist is made against counts rather than against the first five rows
 * the sweep happened to print.
 *
 * `shots.mjs` prints five offenders per page and a tally, which is right for a gate — the list
 * is there to make one failure findable, not to plan a refactor. This is the other view: the
 * same data collapsed by class, because seventeen offenders on five pages was, when it was
 * finally counted, four components appearing over and over.
 *
 *   node scripts/diag-audit.mjs
 */
import { chromium } from "playwright";

import { auditTap, auditText } from "./lib/audit.mjs";
import { mintSession } from "./lib/session.mjs";

const BASE = process.env.SHOTS_BASE ?? "http://localhost:3000";
const WIDTH = Number(process.argv[2] ?? 390);

const PAGES = [
  { url: "/", private: false },
  { url: "/now", private: false },
  { url: "/projects", private: false },
  { url: "/projects/solenoid-bit-reader", private: false },
  { url: "/resume/swe", private: false },
  { url: "/private", private: true },
  { url: "/private/log", private: true },
  { url: "/private/athletics", private: true },
  { url: "/private/academics", private: true },
  { url: "/private/calendar", private: true },
  { url: "/private/settings", private: true },
  { url: "/private/kitchen-sink", private: true },
  { url: "/private/athletics/log", private: true },
  { url: "/private/athletics/exercises", private: true },
];

const browser = await chromium.launch();
const secret = process.env.SESSION_SECRET?.trim();
const token = secret ? await mintSession(secret) : null;
const origin = new URL(BASE).origin;

/** class -> { count, pages:Set, sample } */
const text = new Map();
const tap = new Map();

function add(map, key, page, sample) {
  const row = map.get(key) ?? { count: 0, pages: new Set(), sample };
  row.count += 1;
  row.pages.add(page);
  map.set(key, row);
}

for (const target of PAGES) {
  if (target.private && !token) continue;
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: 900 },
    isMobile: WIDTH < 768,
    hasTouch: WIDTH < 768,
  });
  if (target.private)
    await context.addCookies([
      { name: "2m_session", value: token, url: origin, httpOnly: true, sameSite: "Lax" },
    ]);

  const page = await context.newPage();
  try {
    await page.goto(BASE + target.url, { waitUntil: "networkidle", timeout: 90_000 });
    await page.evaluate(() => document.fonts.ready).catch(() => {});

    const t = await page.evaluate(auditText, 11);
    for (const o of t.offenders) add(text, `${o.px}px ${o.tag}.${o.cls}`, target.url, o.text);

    const p = await page.evaluate(auditTap, 44);
    for (const o of p.offenders) add(tap, `${o.tag}.${o.cls}`, target.url, `${o.w}x${o.h}`);
  } catch (error) {
    console.log(`  ${target.url}: ${String(error).split("\n")[0]}`);
  }
  await context.close();
}

await browser.close();

function report(title, map) {
  console.log(
    `\n=== ${title} (${WIDTH}px) — ${map.size} distinct, ${[...map.values()].reduce(
      (n, r) => n + r.count,
      0,
    )} total ===\n`,
  );
  const rows = [...map.entries()].sort((a, b) => b[1].count - a[1].count);
  for (const [key, row] of rows) {
    console.log(`${String(row.count).padStart(4)}x  ${key}`);
    console.log(`        on ${[...row.pages].join(", ")}`);
    console.log(`        e.g. "${row.sample}"`);
  }
}

report("text under 11px", text);
report("tap targets under 44px", tap);
