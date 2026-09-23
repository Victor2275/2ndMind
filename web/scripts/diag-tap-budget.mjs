/**
 * Prints the per-page tap-target budget for `shots.mjs` — V4 §7.1 (Q441).
 *
 * The 44px floor lands on an app with a real backlog of near-misses: a 51x32 header link, a
 * 47x36 tab, a 40x40 icon button. Those are design changes, not allowlist entries, and a gate
 * that is red on the day it ships is a gate somebody switches off within a week.
 *
 * So the floor lands as a **budget that only ever ratchets down**. `shots.mjs` carries the
 * measured count for each page and fails when a page exceeds it — a new small target is a
 * failure immediately, while the existing ones are a number somebody can work down. When a page
 * comes in under its budget, this script is how the budget is lowered to match.
 *
 * This is deliberately not the same thing as "report only, never fail" (D-190's failure, and
 * the state this whole section exists to leave): every number here is enforced, and none of
 * them can grow without turning the build red.
 *
 *   node scripts/diag-tap-budget.mjs > /tmp/budget.txt
 */
import { chromium } from "playwright";

import { auditTap } from "./lib/audit.mjs";
import { mintSession } from "./lib/session.mjs";

const BASE = process.env.SHOTS_BASE ?? "http://localhost:3000";
const FLOOR = 44;
/** The widths the tap floor is gated at — where the pointer is a thumb. */
const WIDTHS = [360, 390];

const PAGES = [
  { name: "home", url: "/", private: false },
  { name: "projects", url: "/projects", private: false },
  { name: "project-detail", url: "/projects/solenoid-bit-reader", private: false },
  { name: "resume", url: "/resume/swe", private: false },
  { name: "private-today", url: "/private", private: true },
  { name: "private-log", url: "/private/log", private: true },
  { name: "private-log-archive", url: "/private/log/archive", private: true },
  { name: "private-athletics", url: "/private/athletics", private: true },
  { name: "private-academics", url: "/private/academics", private: true },
  { name: "private-calendar", url: "/private/calendar", private: true },
  { name: "private-now", url: "/private/now", private: true },
  { name: "private-work", url: "/private/work", private: true },
  { name: "private-tailor", url: "/private/work/tailor", private: true },
  { name: "private-hobbies", url: "/private/hobbies", private: true },
  { name: "private-sync", url: "/private/sync", private: true },
  { name: "private-settings", url: "/private/settings", private: true },
  { name: "private-kitchen-sink", url: "/private/kitchen-sink", private: true },
  { name: "private-exercises", url: "/private/athletics/exercises", private: true },
  {
    name: "private-exercise-detail",
    url: "/private/athletics/exercises/bench-press",
    private: true,
  },
  { name: "private-training-history", url: "/private/athletics/history", private: true },
  { name: "private-plan", url: "/private/athletics/plan", private: true },
  { name: "private-training-log", url: "/private/athletics/log", private: true },
];

const browser = await chromium.launch();
const secret = process.env.SESSION_SECRET?.trim();
const token = secret ? await mintSession(secret) : null;
const origin = new URL(BASE).origin;

/** name -> the worst count across the gated widths. */
const worst = new Map();

for (const target of PAGES) {
  if (target.private && !token) continue;
  for (const width of WIDTHS) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      isMobile: true,
      hasTouch: true,
    });
    if (target.private)
      await context.addCookies([
        { name: "2m_session", value: token, url: origin, httpOnly: true, sameSite: "Lax" },
      ]);
    const page = await context.newPage();
    try {
      await page.goto(BASE + target.url, { waitUntil: "networkidle", timeout: 90_000 });
      await page.evaluate(() => document.fonts.ready).catch(() => {});
      const tap = await page.evaluate(auditTap, FLOOR);
      worst.set(target.name, Math.max(worst.get(target.name) ?? 0, tap.offenders.length));
    } catch (error) {
      console.error(`  ${target.name} @ ${width}: ${String(error).split("\n")[0]}`);
    }
    await context.close();
  }
}

await browser.close();

console.log("const TAP_BUDGET = {");
for (const [name, count] of [...worst].sort((a, b) => b[1] - a[1])) {
  console.log(`  "${name}": ${count},`);
}
console.log("};");
console.log(
  `\n// total ${[...worst.values()].reduce((a, b) => a + b, 0)} across ${worst.size} pages`,
);
