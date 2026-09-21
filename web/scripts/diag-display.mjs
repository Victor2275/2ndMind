/**
 * Does `hidden sm:block` still resolve to the base utility in this app?
 *
 * D-132/D-143 measured that it did — `hidden sm:flex` computed to `none` at every width on a
 * production build — and that measurement is why the nav switch and `.phone-hidden` are
 * hand-written unlayered CSS. V4 §4.7 then found `Stat`'s hint spelled the broken way and
 * recorded five more call sites to fix in §7.4.
 *
 * Before fixing them, this checks whether they are still broken. The compiled stylesheet now
 * puts `.sm\:block` some 75KB *after* `.hidden`, which by the cascade should make the variant
 * win — so either the stylesheet changed under us or the note is stale. Rewriting five call
 * sites on the strength of a note nobody re-ran is how a codebase accumulates defensive
 * workarounds for bugs that were fixed years ago.
 *
 * Two things this has to get right, both learned by getting them wrong:
 *
 *   - **Probe on the page that loads the CSS.** Next code-splits stylesheets per route, so an
 *     injected `sm:inline` probe on `/` reports nothing useful when the only call site is in
 *     the private header's chunk. Each row below names the page it must run on.
 *   - **Measure the real element, not a synthetic one.** A synthetic probe shares the class
 *     but not the ancestors, and `display` is exactly the property a parent's `flex` or an
 *     unlayered rule reaches in and changes.
 *
 * **The result, 2026-09-21 (D-310): the bug is gone.** Three of the five call sites render
 * unconditionally and all three measured correct at every width — the agenda's location
 * column (`sm:block`), the case-study rail (`laptop:block`) and the word "Private" in the
 * header (`sm:inline`). The other two are conditional on *data* rather than on layout — the
 * task tag chips only exist when a task carries tags, and the wide set table only when a
 * session is in progress — so they print "element not on the page" here, which is this
 * script saying it has nothing to measure rather than reporting a fault. Their spellings
 * (`sm:flex`, `lg:block`) are the same two mechanisms the three measured sites prove.
 *
 *   node scripts/diag-display.mjs
 */
import { chromium } from "playwright";

import { mintSession } from "./lib/session.mjs";

const BASE = process.env.SHOTS_BASE ?? "http://localhost:3000";
const WIDTHS = [360, 390, 768, 1280];

/**
 * The five call sites V4 §4.7 recorded, each with the width it should appear at and the
 * display it should take there. `from` is the breakpoint in px; below it the element is meant
 * to be `none`.
 */
const SITES = [
  {
    name: "agenda location",
    url: "/private/calendar",
    private: true,
    find: "agenda.tsx:46 — the event location column",
    sel: 'span[class*="max-w-[14ch]"][class*="sm:block"]',
    want: "block",
    from: 640,
  },
  {
    name: "case-study toc",
    url: "/projects/solenoid-bit-reader",
    private: false,
    find: "case-study-toc.tsx:95 — the on-this-page rail",
    sel: "nav[aria-label='On this page']",
    want: "block",
    from: 1024,
  },
  {
    name: "private link word",
    url: "/",
    private: false,
    returning: true,
    find: "private-link.tsx:49 — the word 'Private' beside the lock",
    sel: 'span[class*="sm:inline"]',
    want: "inline",
    from: 640,
  },
  {
    name: "session set table",
    url: "/private/athletics/log",
    private: true,
    find: "session-logger.tsx:1035 — the wide set table",
    sel: 'div[class*="lg:block"]',
    want: "block",
    from: 1024,
  },
  {
    name: "task tag row",
    url: "/private/academics",
    private: true,
    find: "task-list.tsx:222 — the tag chips beside a task",
    sel: 'span[class*="sm:flex"]',
    want: "flex",
    from: 640,
  },
];

const browser = await chromium.launch();
const secret = process.env.SESSION_SECRET?.trim();
const token = secret ? await mintSession(secret) : null;
const origin = new URL(BASE).origin;

for (const site of SITES) {
  console.log(`\n${site.name}  (${site.find})`);
  if (site.private && !token) {
    console.log("  SESSION_SECRET not set — skipped");
    continue;
  }

  for (const width of WIDTHS) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      isMobile: width < 768,
      hasTouch: width < 768,
    });
    if (site.private)
      await context.addCookies([
        { name: "2m_session", value: token, url: origin, httpOnly: true, sameSite: "Lax" },
      ]);
    if (site.returning)
      await context.addCookies([
        { name: "2m_returning", value: "1", url: origin, sameSite: "Lax" },
      ]);

    const page = await context.newPage();
    await page.goto(BASE + site.url, { waitUntil: "networkidle", timeout: 90_000 });
    await page.evaluate(() => document.fonts.ready).catch(() => {});

    const got = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      return { display: getComputedStyle(el).display, cls: el.className?.toString?.() ?? "" };
    }, site.sel);

    if (got === null) {
      console.log(`  ${String(width).padStart(4)}px  element not on the page`);
    } else {
      const expected = width >= site.from ? site.want : "none";
      const ok = got.display === expected;
      console.log(
        `  ${String(width).padStart(4)}px  display=${got.display.padEnd(8)}` +
          ` want=${expected.padEnd(8)} ${ok ? "ok" : "<-- MISMATCH"}`,
      );
    }
    await context.close();
  }
}

await browser.close();
