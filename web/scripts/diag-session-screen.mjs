/**
 * Why the exercise catalogue is empty on the phone, and what the set row actually looks like.
 *
 * Points a signed-in Chromium at an already-running server, opens the session logger at phone
 * width, waits for the sync runner to do its work, and then asks the page three questions that
 * cannot be answered by reading the source:
 *
 *   1. How many rows are in the `exercises` object store — i.e. did the pull deliver them.
 *   2. What the search returns for a query that must match.
 *   3. The measured width of every control in a set row.
 *
 *   node --env-file-if-exists=.env.local scripts/diag-session-screen.mjs [base]
 *
 * Kept in the repo rather than thrown away: the layout failure it measures is invisible to
 * jsdom, which reports every element as zero-width, so this is the only thing that can tell a
 * fixed row from a broken one.
 */
import { chromium } from "playwright";

import { mintSession, SESSION_COOKIE } from "./lib/session.mjs";

const base = process.argv[2] ?? "http://localhost:3111";
const secret = process.env.SESSION_SECRET;
if (!secret) {
  console.error("diag: SESSION_SECRET is required (it lives in .env.local).");
  process.exit(2);
}

const browser = await chromium.launch();
const context = await browser.newContext({
  serviceWorkers: "allow",
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
page.on("console", (message) => {
  if (message.type() === "error") console.log("  console.error:", message.text());
});

await page.goto(`${base}/private/athletics/log`, { waitUntil: "networkidle" });

// The runner flushes on mount; give it room, then read the store directly.
await page.waitForTimeout(8_000);

const store = await page.evaluate(async () => {
  const open = (name, version) =>
    new Promise((resolve, reject) => {
      const request = indexedDB.open(name, version);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error("blocked"));
    });

  try {
    const db = await open("2ndmind");
    const names = [...db.objectStoreNames];
    const count = (store) =>
      new Promise((resolve) => {
        if (!names.includes(store)) return resolve(-1);
        const request = db.transaction(store).objectStore(store).count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(-2);
      });
    const meta = await new Promise((resolve) => {
      const request = db.transaction("meta").objectStore("meta").get("cursor");
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => resolve(null);
    });
    return {
      version: db.version,
      stores: names,
      cursor: meta,
      exercises: await count("exercises"),
      workouts: await count("workouts"),
      logEntries: await count("log_entries"),
      outbox: await count("outbox"),
    };
  } catch (error) {
    return { error: String(error) };
  }
});

console.log("\nlocal store");
console.log(JSON.stringify(store, null, 2));

// What the picker shows for a query that has to match something.
await page.getByRole("button", { name: "Add exercise" }).click();
const search = page.getByRole("textbox", { name: "Search exercises" });
await search.fill("bnch");
await page.waitForTimeout(500);
const hits = await page.locator("section >> ul >> li").allTextContents();
console.log("\nsearch 'bnch' ->", hits.slice(0, 5));

// Add one and measure the row it produces.
if (hits.length > 0) {
  await page.locator("section >> ul >> li >> button").first().click();
} else {
  await page.getByRole("button", { name: /^Add / }).first().click();
}
await page.waitForTimeout(500);

const row = await page.evaluate(() => {
  const item = document.querySelector("ol > li");
  if (!item) return null;
  const parent = item.getBoundingClientRect();
  return {
    row: Math.round(parent.width),
    children: [...item.children].map((element) => ({
      tag: element.tagName.toLowerCase(),
      cls: element.className.slice(0, 40),
      width: Math.round(element.getBoundingClientRect().width),
      overflowsRight: Math.round(element.getBoundingClientRect().right - parent.right),
    })),
  };
});

console.log("\nset row at 390px");
console.log(JSON.stringify(row, null, 2));

await page.screenshot({ path: process.env.SHOT ?? "diag-session.png", fullPage: true });
console.log(`\nscreenshot: ${process.env.SHOT ?? "diag-session.png"}`);

await browser.close();
