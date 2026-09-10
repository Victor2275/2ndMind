/**
 * What the exercise picker actually looks like on a phone (D-237).
 *
 * Points a signed-in Chromium at an already-running server, opens the session logger at phone
 * width, taps "Add exercise", and screenshots the panel — closed, searching, with the create
 * block open, and with two rows selected. Also measures the three things that are the whole
 * point of the change and that jsdom cannot see: whether the search box is still on screen after
 * the list is scrolled, whether the footer is above the fold, and whether the panel fills the
 * viewport rather than sliding in as a drawer.
 *
 *   node --env-file-if-exists=.env.local scripts/diag-picker.mjs [base] [outDir]
 */
import { chromium } from "playwright";
import path from "node:path";

import { mintSession, SESSION_COOKIE } from "./lib/session.mjs";

const base = process.argv[2] ?? "http://localhost:3111";
const outDir = process.argv[3] ?? ".";
const secret = process.env.SESSION_SECRET;
if (!secret) {
  console.error("diag: SESSION_SECRET is required (it lives in .env.local).");
  process.exit(2);
}

const shot = (name) => path.join(outDir, `picker-${name}.png`);

const browser = await chromium.launch();
const context = await browser.newContext({
  serviceWorkers: "allow",
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
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
page.on("console", (m) => {
  if (m.type() === "error") console.log("  console.error:", m.text());
});

await page.goto(`${base}/private/athletics/log`, { waitUntil: "networkidle" });
await page.waitForTimeout(2500); // the sync runner fills the catalogue

await page.getByRole("button", { name: "Add exercise" }).click();
await page.waitForTimeout(600);
await page.screenshot({ path: shot("open") });

const panel = page.locator('[data-slot="sheet-content"]');
const box = await panel.boundingBox();
const viewport = page.viewportSize();
console.log(
  `panel  x${Math.round(box.x)} y${Math.round(box.y)} ${Math.round(box.width)}x${Math.round(box.height)}` +
    `  viewport ${viewport.width}x${viewport.height}`,
);

const scroller = panel.locator("div.overflow-y-auto");
await scroller.evaluate((el) => el.scrollTo(0, 1200));
await page.waitForTimeout(300);
await page.screenshot({ path: shot("scrolled") });

const search = page.getByRole("searchbox", { name: /search exercises/i });
const searchBox = await search.boundingBox();
console.log(
  `search after scrolling 1200px:  y${Math.round(searchBox.y)}  ` +
    (searchBox.y >= 0 && searchBox.y < viewport.height ? "ON SCREEN" : "OFF SCREEN"),
);

const add = page.getByRole("button", { name: /Select an exercise|Add \d+ exercise/ });
const addBox = await add.boundingBox();
console.log(
  `add button:  y${Math.round(addBox.y)}..${Math.round(addBox.y + addBox.height)}  ` +
    (addBox.y + addBox.height <= viewport.height ? "ABOVE THE FOLD" : "BELOW THE FOLD"),
);

await search.fill("erg");
await page.waitForTimeout(400);
await page.screenshot({ path: shot("search-erg") });
const firstRow = await page.locator("ul li").first().innerText();
console.log(`first row for "erg":  ${firstRow.replace(/\s+/g, " ").trim()}`);
const top = await scroller.evaluate((el) => el.scrollTop);
console.log(
  `scroll after typing:  ${Math.round(top)}px  ` + (top === 0 ? "AT THE TOP" : "NOT RESET"),
);

await search.fill("");
await page.waitForTimeout(300);
const rows = page.locator("ul li button");
await rows.nth(0).click();
await rows.nth(1).click();
await page.waitForTimeout(300);
await page.screenshot({ path: shot("selected") });

await page.getByRole("button", { name: /Not in the list/ }).click();
await page.waitForTimeout(300);
await page.getByRole("textbox", { name: /Add a movement by name/ }).focus();
await page.waitForTimeout(400);
await page.screenshot({ path: shot("create") });

await browser.close();
console.log("wrote", shot("open"), "and four more");
