/**
 * Full-page screenshots of named routes at phone width, for looking at rather than asserting on.
 *
 *   node --env-file-if-exists=.env.local scripts/diag-shots.mjs <outDir> [base] [width]
 */
import path from "node:path";

import { chromium } from "playwright";

import { mintSession, SESSION_COOKIE } from "./lib/session.mjs";

const outDir = process.argv[2];
const base = process.argv[3] ?? "http://localhost:3112";
const width = Number(process.argv[4] ?? 390);
if (!outDir) {
  console.error("usage: diag-shots.mjs <outDir> [base] [width]");
  process.exit(2);
}

const secret = process.env.SESSION_SECRET;
if (!secret) {
  console.error("diag-shots: SESSION_SECRET is required.");
  process.exit(2);
}

const ROUTES = (process.env.ROUTES ?? "/private/settings,/private/now,/private/log").split(",");

const browser = await chromium.launch();
const context = await browser.newContext({
  serviceWorkers: "block",
  viewport: { width, height: 900 },
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

for (const route of ROUTES) {
  await page.goto(base + route, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1_500);
  const name = route.replaceAll("/", "_").replace(/^_/, "") || "root";
  const file = path.join(outDir, `${name}-${width}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(file);
}

await browser.close();
