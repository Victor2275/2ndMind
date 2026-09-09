/**
 * Finds elements that are wider than the box holding them, at phone width.
 *
 * The horizontal-overflow bug this exists for is invisible to every other check the project
 * has: jsdom reports every element as zero-width, so a unit test cannot see it; the page does
 * not error; and a screenshot only shows it once you know which screen to look at. This walks
 * the whole document and reports the offenders by measurement.
 *
 *   node --env-file-if-exists=.env.local scripts/diag-widths.mjs [base]
 *
 * A common cause in this codebase is a Tailwind width conflict — a shared field constant
 * carrying `w-full` and a call site adding `w-24`, which are the same specificity, so the one
 * that wins is whichever the generated stylesheet happens to emit last. See D-219.
 */
import { chromium } from "playwright";

import { mintSession, SESSION_COOKIE } from "./lib/session.mjs";

const base = process.argv[2] ?? "http://localhost:3112";
const secret = process.env.SESSION_SECRET;
if (!secret) {
  console.error("diag-widths: SESSION_SECRET is required.");
  process.exit(2);
}

const ROUTES = [
  "/private",
  "/private/log",
  "/private/settings",
  "/private/now",
  "/private/athletics/log",
  "/private/athletics",
  "/private/sync",
  "/private/calendar",
  "/private/academics",
  "/private/work",
  "/private/hobbies",
];

const browser = await chromium.launch();
const context = await browser.newContext({
  serviceWorkers: "block",
  viewport: { width: 390, height: 844 },
});
await context.addCookies([
  {
    name: SESSION_COOKIE,
    value: await mintSession(secret),
    url: base,
    httpOnly: true,
    sameSite: "Lax",
  },
]);
const page = await context.newPage();

let bad = 0;

for (const route of ROUTES) {
  // The dashboard summarises the day with a model call, which is slow and not what
  // this measures — generous, so a warm cache is not a prerequisite for running it.
  await page.goto(base + route, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForTimeout(1_200);

  const report = await page.evaluate(() => {
    const docWidth = document.documentElement.clientWidth;
    const offenders = [];

    for (const element of document.querySelectorAll("body *")) {
      const box = element.getBoundingClientRect();
      if (box.width === 0 && box.height === 0) continue;

      // Off the right edge of the viewport entirely.
      const past = Math.round(box.right - docWidth);

      // Or wider than the element that is supposed to contain it. Fixed and absolute boxes are
      // positioned against something else and are not a containment failure.
      const parent = element.parentElement;
      const position = getComputedStyle(element).position;
      const spill =
        parent && position !== "fixed" && position !== "absolute"
          ? Math.round(box.width - parent.getBoundingClientRect().width)
          : 0;

      if (past > 1 || spill > 1) {
        offenders.push({
          tag: element.tagName.toLowerCase(),
          cls: String(element.className).slice(0, 60),
          w: Math.round(box.width),
          past,
          spill,
        });
      }
    }

    return { scrollWidth: document.documentElement.scrollWidth, docWidth, offenders };
  });

  const overflows = report.scrollWidth > report.docWidth + 1;
  const label = overflows ? "SCROLLS" : "ok     ";
  console.log(`${label}  ${route}  (${report.scrollWidth}px in ${report.docWidth}px)`);

  for (const offender of report.offenders.slice(0, 8)) {
    bad += 1;
    console.log(
      `           ${offender.tag}.${offender.cls} — ${offender.w}px, ${offender.past}px past the edge, ${offender.spill}px wider than its parent`,
    );
  }
}

await browser.close();
console.log(`\n${bad} offending element${bad === 1 ? "" : "s"}.`);
process.exit(bad > 0 ? 1 : 0);
