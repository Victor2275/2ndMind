/**
 * Screenshots the public pages at several widths, and reports layout faults that are
 * invisible to a text-only check.
 *
 * This exists because for most of the project's life nothing here could see a rendered page.
 * Verification was grep over built HTML, which catches a fabricated claim or a leaked field
 * but is blind to a layout — the resume had been printing at 1.33 pages for weeks and nobody
 * knew. Local only: Playwright drives a browser on this machine and nothing leaves it.
 *
 *   npm run dev            # in another terminal
 *   npm run shots          # writes to .shots/ (gitignored)
 *   npm run shots -- 390   # only the 390px width
 *
 * It also measures how many pages each resume variant prints to. That is a different kind of
 * check from the ones above — paper has no viewport width — so it runs once, after the width
 * sweep. See `measureResumes` for why it exists.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.SHOTS_BASE ?? "http://localhost:3000";
const OUT = process.env.SHOTS_OUT ?? ".shots";

/** Real device widths, not round numbers: 360 is the common Android floor, 390 is an iPhone. */
const WIDTHS = [360, 390, 768, 1280];

const PAGES = [
  { name: "home", url: "/" },
  { name: "now", url: "/now" },
  { name: "projects", url: "/projects" },
  { name: "project-detail", url: "/projects/solenoid-bit-reader" },
  { name: "resume", url: "/resume/swe" },
];

const only = process.argv[2] ? Number(process.argv[2]) : null;
const widths = only ? WIDTHS.filter((w) => w === only) : WIDTHS;

/* --- Resume page count ---------------------------------------------------------------
   All three variants are measured, but only `swe` is screenshotted above. The three pages
   are one component fed different data, so a mobile layout fault appears in all of them
   identically — twelve more PNGs would carry no signal the swe shots do not. What differs
   between variants is *length*, and length is exactly what this measures.

   An intern resume is one page. Before the print density block in `globals.css` every
   variant ran over (swe 1.33, ml 1.24, robotics 1.18) and nobody knew for weeks, because
   the only check anyone ran was looking at it. So this reports two numbers:

   - `pages`, from Chromium's own PDF writer at Letter/0.5in. This is ground truth: it is
     the same path as the browser print dialog, which is how the file Victor sends is made.
   - `ratio`, the print-emulated document height over one printable page. This is the number
     that makes an overflow *fixable* — "1.03" says trim a line, "2" says nothing at all. */

/* --- The private side ----------------------------------------------------------------
   `/private` is the page Victor opens most and the only one he uses on a phone every day,
   and until now it was the one page nothing could see: it is behind a passkey, so the sweep
   above stopped at the sign-in screen.

   The session is an HMAC over a JSON payload (`lib/auth/session.ts`), so a valid cookie can
   be minted here from the same `SESSION_SECRET` the app verifies against. Nothing is
   weakened by doing so: the secret is already on this machine, the server is this machine,
   and the token expires in fifteen minutes. Skipped entirely when the secret is absent, so
   this stays optional rather than a new setup step.

   Run with `SHOTS_PRIVATE=0` to skip it deliberately. */

/** How far down /private the first actionable item may sit on a phone. See the check below. */
const FOLD_LIMIT = 500;

const PRIVATE_PAGES = [
  { name: "private-today", url: "/private" },
  { name: "private-log", url: "/private/log" },
  { name: "private-now", url: "/private/now" },
  { name: "private-work", url: "/private/work" },
  { name: "private-tailor", url: "/private/tailor" },
];

function b64url(bytes) {
  return Buffer.from(bytes).toString("base64url");
}

async function mintSession(secret) {
  const now = Math.floor(Date.now() / 1000);
  // Fifteen minutes, not the app's seven days: this token exists for the length of one run.
  const payload = { sub: "victor", iat: now, exp: now + 900 };
  const body = b64url(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return `${body}.${b64url(new Uint8Array(signature))}`;
}

const RESUME_VARIANTS = ["swe", "ml", "robotics"];

/** Letter at 0.5in margins, in CSS pixels at 96dpi: 7.5in x 10in. */
const PAGE_W = 720;
const PAGE_H = 960;

/**
 * Counts pages in a Chromium-generated PDF.
 *
 * Chromium's PDF writer emits classic indirect objects and an xref table rather than
 * compressed object streams, so the page tree is readable in the raw bytes. The `/Count` on
 * the root `/Pages` node is authoritative; counting `/Type /Page` objects is the fallback,
 * and `[^s]` is what stops it also matching every `/Type /Pages`. If both fail we return
 * null rather than a wrong number — a silently wrong page count is the failure this whole
 * function exists to prevent.
 */
function pdfPageCount(buffer) {
  const raw = buffer.toString("latin1");

  const counts = [...raw.matchAll(/\/Type\s*\/Pages\b[\s\S]{0,400}?\/Count\s+(\d+)/g)].map((m) =>
    Number(m[1]),
  );
  if (counts.length > 0) return Math.max(...counts);

  const pages = raw.match(/\/Type\s*\/Page[^s]/g);
  return pages ? pages.length : null;
}

async function measureResumes(browser) {
  console.log("\nResume, printed at Letter with 0.5in margins:\n");
  let over = 0;

  for (const variant of RESUME_VARIANTS) {
    // Viewport at the printable width so text wraps the way it wraps on paper. `main` keeps
    // its px-6 in print, and so does this — the inset is real in the PDF too.
    const page = await browser.newPage({ viewport: { width: PAGE_W, height: PAGE_H } });
    await page.goto(`${BASE}/resume/${variant}`, { waitUntil: "networkidle" });

    // `print:hidden` controls are display:none under print media, so they stop counting
    // toward the height — which is the point of emulating rather than measuring on screen.
    await page.emulateMedia({ media: "print" });

    // The bottom edge of the sheet, plus the padding below it.
    //
    // Not `scrollHeight`, which never reports less than the viewport — every variant that fit
    // would read exactly 1.00, and a resume with room to spare would be indistinguishable
    // from one filled to the millimetre. Not `main` either: it carries `flex-1` inside the
    // layout's flex column, so it is stretched to the viewport whatever it contains. Both of
    // those measure the window. The sheet is the only element whose height is the content's.
    const height = await page.evaluate(() => {
      const sheet = document.querySelector(".resume-sheet");
      const main = document.querySelector("main");
      if (!sheet || !main) return 0;
      // `py-12` below the sheet is not overridden in print, so it occupies paper too.
      const below = parseFloat(getComputedStyle(main).paddingBottom) || 0;
      return sheet.getBoundingClientRect().bottom + window.scrollY + below;
    });
    const ratio = height / PAGE_H;

    const pdf = await page.pdf({
      format: "Letter",
      margin: { top: "0.5in", right: "0.5in", bottom: "0.5in", left: "0.5in" },
      printBackground: false,
    });
    const pages = pdfPageCount(pdf);

    fs.writeFileSync(path.join(OUT, `resume-${variant}.pdf`), pdf);

    // A PNG as well as the PDF, because reviewing the PDF needs a viewer and reviewing this
    // does not. Same print media, white background, so what it shows is what prints.
    await page.screenshot({
      path: path.join(OUT, `resume-${variant}-print.png`),
      clip: { x: 0, y: 0, width: PAGE_W, height: Math.max(PAGE_H, Math.ceil(height)) },
    });

    const bad = pages === null ? false : pages > 1;
    if (bad) over += 1;

    console.log(
      `  ${variant.padEnd(9)} ratio=${ratio.toFixed(2)} pages` +
        `=${pages ?? "?"}` +
        (pages === null ? "  <-- could not read the page tree" : bad ? "  <-- OVER" : "  ok"),
    );

    await page.close();
  }

  return over;
}

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
let faults = 0;

for (const width of widths) {
  for (const target of PAGES) {
    const page = await browser.newPage({
      viewport: { width, height: 900 },
      deviceScaleFactor: 2,
      colorScheme: "dark",
      isMobile: width < 768,
      hasTouch: width < 768,
    });

    await page.goto(BASE + target.url, { waitUntil: "networkidle" });
    await page.screenshot({
      path: path.join(OUT, `${target.name}-${width}.png`),
      fullPage: true,
    });

    const report = await page.evaluate(() => {
      const doc = document.documentElement;
      const overflow = doc.scrollWidth - doc.clientWidth;

      // Which elements actually stick out past the viewport. Reporting the widest few is
      // what makes an overflow fixable rather than just visible.
      const wide = [];
      for (const el of document.querySelectorAll("body *")) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.right > doc.clientWidth + 1 || r.left < -1) {
          wide.push({
            tag: el.tagName.toLowerCase(),
            cls: (el.className?.toString?.() ?? "").slice(0, 60),
            right: Math.round(r.right),
          });
        }
      }

      // Tap targets below ~40px are hard to hit accurately on a phone.
      const small = [...document.querySelectorAll("a, button, input, select")].filter((el) => {
        const r = el.getBoundingClientRect();
        return r.height > 0 && r.height < 40;
      }).length;

      // Text under 12px is uncomfortable on a phone regardless of how tidy it looks.
      const tiny = [...document.querySelectorAll("body *")].filter((el) => {
        if (!el.textContent?.trim() || el.children.length > 0) return false;
        return parseFloat(getComputedStyle(el).fontSize) < 12;
      }).length;

      return { overflow, wide: wide.slice(0, 4), small, tiny };
    });

    const bad = report.overflow > 0;
    if (bad) faults += 1;
    console.log(
      `${String(width).padStart(4)}px ${target.name.padEnd(15)}` +
        ` overflow=${String(report.overflow).padStart(4)}px` +
        ` tap<40px=${String(report.small).padStart(3)}` +
        ` text<12px=${String(report.tiny).padStart(3)}` +
        (bad ? "  <-- " + report.wide.map((w) => `${w.tag}.${w.cls}`).join(" | ") : ""),
    );

    await page.close();
  }
}

/* --- The header, as Victor sees it ----------------------------------------------------
   The public sweep above renders the header a stranger gets: four items. Victor gets five,
   because `2m_returning` adds a "Private" link — and the header was the one place that link
   was originally kept out of, precisely because five items plus a truncated name is tight at
   390px. So the crowded case is the one that has to be measured, and it is invisible to every
   other check here: no cookie, no fifth item, no overflow.

   The cookie carries no authority (see `lib/auth/returning.ts`), so setting it here needs no
   secret and reveals nothing. */
let returningFaults = 0;
if (process.env.SHOTS_RETURNING !== "0") {
  console.log("");
  const origin = new URL(BASE).origin;

  for (const width of widths) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      deviceScaleFactor: 2,
      colorScheme: "dark",
      isMobile: width < 768,
      hasTouch: width < 768,
    });
    if (process.env.SHOTS_NO_COOKIE !== "1")
      await context.addCookies([
        { name: "2m_returning", value: "1", url: origin, sameSite: "Lax" },
      ]);

    const page = await context.newPage();
    await page.goto(BASE + "/", { waitUntil: "networkidle" });
    await page.screenshot({ path: path.join(OUT, `home-returning-${width}.png`) });

    const header = await page.evaluate(() => {
      const bar = document.querySelector("header");
      if (!bar) return null;
      const links = [...bar.querySelectorAll("nav a")].map(
        (a) => a.getAttribute("aria-label") || a.textContent?.trim() || "",
      );
      const nav = bar.querySelector("nav");

      // How much of the name is still on screen.
      //
      // This is the measurement the first version of this check lacked, and it cost a real
      // mistake: the fifth nav item fit perfectly, reported zero overflow, and had silently
      // squeezed "Victor Gusev" out of the header altogether. Nothing overflowed because the
      // name is `min-w-0` and simply collapsed. A nav that fits is not the same as a header
      // that works.
      const brand = bar.querySelector("a span:last-child");
      return {
        links,
        navOverflow: nav ? nav.scrollWidth - nav.clientWidth : 0,
        barOverflow: bar.scrollWidth - bar.clientWidth,
        brandWidth: brand ? Math.round(brand.getBoundingClientRect().width) : 0,
        brandText: brand?.textContent?.trim() ?? "",
      };
    });

    const hasPrivate = header?.links.includes("Private") ?? false;
    const squeezed = (header?.navOverflow ?? 0) > 0 || (header?.barOverflow ?? 0) > 0;
    // 40px is about four characters — enough to tell that a name is there and being
    // truncated, rather than gone. Below that the header has no identity on it at all.
    const nameGone = (header?.brandWidth ?? 0) < 40;
    if (!hasPrivate || squeezed || nameGone) returningFaults += 1;

    console.log(
      ` ${String(width).padStart(4)}px header (signed in) ` +
        `items=${header?.links.length ?? 0} ` +
        `private=${hasPrivate ? "yes" : "NO"} ` +
        `name=${header?.brandWidth ?? 0}px ` +
        `overflow=${Math.max(header?.navOverflow ?? 0, header?.barOverflow ?? 0)}px` +
        (squeezed ? "  <-- the nav does not fit" : "") +
        (nameGone ? "  <-- the name is squeezed out" : ""),
    );

    await context.close();
  }
}

let privateFaults = 0;
const secret = process.env.SESSION_SECRET?.trim();
if (process.env.SHOTS_PRIVATE !== "0" && secret) {
  const token = await mintSession(secret);
  const origin = new URL(BASE).origin;
  console.log("");

  for (const width of widths) {
    for (const target of PRIVATE_PAGES) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        deviceScaleFactor: 2,
        colorScheme: "dark",
        isMobile: width < 768,
        hasTouch: width < 768,
      });
      await context.addCookies([
        { name: "2m_session", value: token, url: origin, httpOnly: true, sameSite: "Lax" },
      ]);

      const page = await context.newPage();
      const response = await page.goto(BASE + target.url, { waitUntil: "networkidle" });
      await page.screenshot({
        path: path.join(OUT, `${target.name}-${width}.png`),
        fullPage: true,
      });

      // A redirect to /signin means the cookie was rejected — report it rather than
      // silently screenshotting a sign-in page and calling the layout fine.
      const landed = new URL(page.url()).pathname;
      const rejected = landed.startsWith("/signin");

      // How much of the answer to "what do I do now" is above the fold. The first task list
      // is the answer; everything above it is what you have to scroll past to reach it.
      const fold = await page.evaluate(() => {
        const list = document.querySelector("[data-task-list]");
        if (!list) return null;
        return Math.round(list.getBoundingClientRect().top + window.scrollY);
      });

      // The whole point of /private is answering "what do I do now" without scrolling. A
      // 390x844 phone shows roughly 690px once browser chrome is taken off, so 500px leaves
      // margin and still fails loudly if a panel creeps back above the task list. It was
      // 791px before feature 3 was closed out.
      const buried = width < 768 && fold !== null && fold > FOLD_LIMIT;
      if (buried || rejected) privateFaults += 1;

      console.log(
        `${String(width).padStart(4)}px ${target.name.padEnd(15)}` +
          ` status=${response?.status() ?? "?"}` +
          (fold === null ? "" : ` first-task-at=${String(fold).padStart(4)}px`) +
          (rejected ? `  <-- redirected to ${landed}` : "") +
          (buried ? `  <-- below the fold (limit ${FOLD_LIMIT}px)` : ""),
      );

      await context.close();
    }
  }
} else if (!secret) {
  console.log("\nSESSION_SECRET not set, so the private pages were skipped.");
}

// Paper has no viewport width, so this runs once rather than inside the sweep. Skipped when
// a single width was requested, because that invocation is a targeted layout check.
const overLong = only ? 0 : await measureResumes(browser);

await browser.close();
console.log(`\n${faults} page/width combination(s) scroll sideways. Written to ${OUT}/`);
if (!only) console.log(`${overLong} resume variant(s) print to more than one page.`);
if (privateFaults > 0) console.log(`${privateFaults} private page(s) bury the answer or refused the session.`);
if (returningFaults > 0)
  console.log(`${returningFaults} width(s) where the signed-in header is missing its link or does not fit.`);

// A non-zero exit is what lets this gate a commit, rather than being advice nobody reads.
if (faults > 0 || overLong > 0 || privateFaults > 0 || returningFaults > 0) process.exitCode = 1;
