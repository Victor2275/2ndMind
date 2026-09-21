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

import { mintSession } from "./lib/session.mjs";

const BASE = process.env.SHOTS_BASE ?? "http://localhost:3000";
const OUT = process.env.SHOTS_OUT ?? ".shots";

/**
 * The `cramped` breakpoint, in pixels — below it the header drops the wordmark and shows the
 * mark alone (V4 6.3, Q42, D-216).
 *
 * Read out of the generated `scale.css` rather than typed here. The value exists in exactly one
 * place — `scripts/build-scale.mts` — and a gate that carries its own copy of a breakpoint is a
 * gate that will one day pass for the wrong reason after someone moves the line.
 */
const CRAMPED_PX = (() => {
  const css = fs.readFileSync(path.join("src", "app", "scale.css"), "utf8");
  const found = css.match(/--breakpoint-cramped:\s*([\d.]+)rem/);
  if (!found) throw new Error("scale.css has no --breakpoint-cramped; run `npm run scale`");
  return Number(found[1]) * 16;
})();

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

/** How far down a private page the first actionable item may sit on a phone. See the check below. */
const FOLD_LIMIT = 500;

/* Every private screen is swept (V3 §3.2). `gated` says whether the fold check applies.
 *
 * D-083 gated one page and D-132 improved it, and that number is the only measured thing in
 * the whole private app. §3.1 is a ten-hour reordering pass over these screens, and doing it
 * against four pages' worth of opinion and one page's worth of measurement is exactly the
 * mistake §7's "measure, do not assume" was written after.
 *
 * A gated page carries `[data-first-action]` on the one thing you can *do* there. Which
 * element that is was Victor's call, not an inference:
 *
 *   today      the Due task list          the answer to "what do I do now"
 *   log        the quick capture box      getting a thought out of your head (D-164)
 *   athletics  today's rehab checklist    the only thing on the page you can tick
 *   academics  the Outstanding list       already a TaskList, so it came for free
 *   calendar   today's agenda             "what do I have next"
 *
 * The rest are ungated because they carry no action at all: now, work, tailor and hobbies are
 * vault documents you sit down and read, and sync is a report on a queue. Screenshot them,
 * do not hold them to a fold. Gating a page with nothing to reach would either invent an
 * action to satisfy the gate or teach us to ignore the gate, and both are worse than not
 * measuring. */
const PRIVATE_PAGES = [
  { name: "private-today", url: "/private", gated: true },
  { name: "private-log", url: "/private/log", gated: true },
  { name: "private-athletics", url: "/private/athletics", gated: true },
  { name: "private-academics", url: "/private/academics", gated: true },
  { name: "private-calendar", url: "/private/calendar", gated: true },
  { name: "private-now", url: "/private/now", gated: false },
  { name: "private-work", url: "/private/work", gated: false },
  { name: "private-tailor", url: "/private/work/tailor", gated: false },
  { name: "private-hobbies", url: "/private/hobbies", gated: false },
  { name: "private-sync", url: "/private/sync", gated: false },
  // Ungated (V4 §4.4). Every row on settings is actionable, so there is no single "the thing
  // you came to do" for the fold check to measure — gating it would mean picking one control
  // arbitrarily and then defending the number. Swept for the screenshots and the overflow read.
  { name: "private-settings", url: "/private/settings", gated: false },
  // Ungated (V4 §1.11). A component gallery has no "first action" — it is the one private page
  // you are not trying to do anything on. It is swept anyway, and for a reason the other rows do
  // not have: it renders all five themes, every component and every state on one page, so it is
  // the single screenshot where a token regression is visible without knowing where to look.
  // The overflow check earns its keep here too, since nothing else in the app puts a five-theme
  // stack of galleries into a 360px viewport.
  { name: "private-kitchen-sink", url: "/private/kitchen-sink", gated: false },
  // The Training area (V4 Phase 2++). Ungated: the logger's first action is the exercise picker,
  // which is a sheet rather than a thing on the page, and the other three are screens you read.
  // Swept for the screenshots and the overflow read, which is what caught the picker sheet's
  // 140-row list needing its own scroll container.
  { name: "private-exercises", url: "/private/athletics/exercises", gated: false },
  {
    name: "private-exercise-detail",
    url: "/private/athletics/exercises/bench-press",
    gated: false,
  },
  { name: "private-training-history", url: "/private/athletics/history", gated: false },
  // The plan (D-276). **Gated**: it is seventy-six rows of read-only plan with exactly one
  // thing you can do on it — change a day — and that link is the whole reason the screen is
  // not just the vault file rendered. If it slides below the fold it has become a document.
  { name: "private-plan", url: "/private/athletics/plan", gated: true },
  // The logger, swept because the challenge card now sits above it (D-276) and what this
  // measures is whether that card pushed the first set off a phone. Ungated for the reason
  // the other Training screens are: its first action is the exercise picker, which is a sheet.
  { name: "private-training-log", url: "/private/athletics/log", gated: false },
];

/**
 * Hides the Next.js dev-tools button before anything is measured or shot.
 *
 * It is `position: fixed`, so in a full-page screenshot it lands wherever the viewport
 * happened to be — mid-page, on top of real content. It was sitting squarely over a stack
 * badge on the Solenoid case study, which is exactly the failure this whole script exists to
 * catch, hidden by the tool meant to catch it. `next dev` is the only server these run
 * against, so this is not optional dressing.
 */
/**
 * Where the first actionable element sits, once the page has stopped moving.
 *
 * Read the number twice, half a second apart, until two readings agree. Without this the
 * check is a race it loses roughly half the time: every private page streams, the boundaries
 * around the schedule and the summaries have `fallback={null}`, and `networkidle` fires while
 * the HTML response is still open. Measured on `/private` in one sweep: **208px at 360 wide
 * and 936px at 390**, same build, same server, one difference — whether the schedule panel
 * had arrived yet. The low number is not a better layout, it is a page that has not finished.
 *
 * A racy gate is worse than no gate. It passes often enough to look healthy and fails often
 * enough to be dismissed as flaky, and either way nobody trusts the number it prints.
 */
async function settledFold(page) {
  let previous = null;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const fold = await page.evaluate(() => {
      // The **deepest** marked element, not the first (D-182).
      //
      // `querySelector` was here until the capture box landed on Today above the task list
      // (§3.5). Both carry the marker, so the gate silently switched to measuring the higher
      // one: the number improved and the coverage shrank, which is the worst way for a gate to
      // change. A gate that can be relieved of its job by putting something above the thing it
      // watches is not a gate.
      //
      // This only means anything because the marker is now opt-in. Applied by every `TaskList`,
      // as it was, "deepest" measured Today's collapsed Backlog at 1231px — the rule was right
      // and the marker was meaningless. Both had to change together.
      const marked = [...document.querySelectorAll("[data-first-action]")];
      if (marked.length === 0) return null;
      return Math.max(
        ...marked.map((el) => Math.round(el.getBoundingClientRect().top + window.scrollY)),
      );
    });
    if (fold !== null && fold === previous) return fold;
    previous = fold;
    await page.waitForTimeout(500);
  }
  // Four seconds of a page still reshuffling is its own finding. Report the last reading
  // rather than pretending it settled.
  return previous;
}

async function hideDevOverlay(page) {
  await page
    .addStyleTag({
      content:
        "nextjs-portal, [data-nextjs-dev-tools-button], #next-logo { display: none !important; }",
    })
    .catch(() => {});
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
    await hideDevOverlay(page);

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
    await hideDevOverlay(page);
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
      // Grouped by size and class, because a bare count cannot be acted on: 28 elements at
      // the same 0.62rem as every other eyebrow label on the page is a style, and one
      // element at 9px is a bug, and the count reads identically for both.
      const tinyEls = [...document.querySelectorAll("body *")].filter((el) => {
        if (!el.textContent?.trim() || el.children.length > 0) return false;
        return parseFloat(getComputedStyle(el).fontSize) < 12;
      });
      const tinyBy = {};
      for (const el of tinyEls) {
        const px = parseFloat(getComputedStyle(el).fontSize).toFixed(1);
        tinyBy[px] = (tinyBy[px] ?? 0) + 1;
      }

      return { overflow, wide: wide.slice(0, 4), small, tiny: tinyEls.length, tinyBy };
    });

    const bad = report.overflow > 0;
    if (bad) faults += 1;
    console.log(
      `${String(width).padStart(4)}px ${target.name.padEnd(15)}` +
        ` overflow=${String(report.overflow).padStart(4)}px` +
        ` tap<40px=${String(report.small).padStart(3)}` +
        ` text<12px=${String(report.tiny).padStart(3)}` +
        (report.tiny > 0
          ? ` (${Object.entries(report.tinyBy)
              .sort((a, b) => Number(a[0]) - Number(b[0]))
              .map(([px, n]) => `${n}@${px}px`)
              .join(" ")})`
          : "") +
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
    await hideDevOverlay(page);
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
      // The mark (V4 6.1). Below `cramped` the wordmark is dropped on purpose and this is the
      // only identity left in the header, so it is measured rather than assumed.
      const mark = bar.querySelector("a svg");
      return {
        links,
        navOverflow: nav ? nav.scrollWidth - nav.clientWidth : 0,
        barOverflow: bar.scrollWidth - bar.clientWidth,
        brandWidth: brand ? Math.round(brand.getBoundingClientRect().width) : 0,
        brandText: brand?.textContent?.trim() ?? "",
        markWidth: mark ? Math.round(mark.getBoundingClientRect().width) : 0,
      };
    });

    const hasPrivate = header?.links.includes("Private") ?? false;
    const squeezed = (header?.navOverflow ?? 0) > 0 || (header?.barOverflow ?? 0) > 0;

    // Below `cramped` the wordmark is dropped and the mark stands alone (V4 6.3, Q42), so what
    // "the header still has an identity on it" means depends on the width.
    //
    // This check used to demand the name at every width, and it was right to until 2026-09-10:
    // the name vanishing meant the fifth nav item had silently squeezed it out, with no overflow
    // to show for it. That failure is still caught — it is just now only a failure *above* the
    // breakpoint, and below it the mark has to be there instead. Dropping the check entirely
    // would have been the easy way through and would have retired a gate that earned its place.
    //
    // 40px is about four characters — enough to tell that a name is there and being truncated,
    // rather than gone.
    const nameGone = width >= CRAMPED_PX && (header?.brandWidth ?? 0) < 40;
    const markGone = width < CRAMPED_PX && (header?.markWidth ?? 0) < 12;
    if (!hasPrivate || squeezed || nameGone || markGone) returningFaults += 1;

    console.log(
      ` ${String(width).padStart(4)}px header (signed in) ` +
        `items=${header?.links.length ?? 0} ` +
        `private=${hasPrivate ? "yes" : "NO"} ` +
        `name=${header?.brandWidth ?? 0}px ` +
        `overflow=${Math.max(header?.navOverflow ?? 0, header?.barOverflow ?? 0)}px` +
        (squeezed ? "  <-- the nav does not fit" : "") +
        (nameGone ? "  <-- the name is squeezed out" : "") +
        (markGone ? "  <-- no mark, and no room for the name either" : "") +
        (width < CRAMPED_PX && !markGone ? "  (mark only, by design)" : ""),
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
      // 90s, not Playwright's default 30. `/private` renders the daily AI summary, and on a
      // cold cache that is a live Gemini call from the server — measured past 30s on the first
      // run after a build, which failed this gate twice with a timeout that had nothing to do
      // with layout. Subsequent runs are fast because the summary is persisted (D-124).
      const response = await page.goto(BASE + target.url, {
        waitUntil: "networkidle",
        timeout: 90_000,
      });
      await hideDevOverlay(page);

      // A redirect to /signin means the cookie was rejected — report it rather than
      // silently screenshotting a sign-in page and calling the layout fine.
      const landed = new URL(page.url()).pathname;
      const rejected = landed.startsWith("/signin");

      // How much of the answer is above the fold: everything above the marker is what you
      // have to scroll past to reach the one thing this page is for. Settled first, and the
      // screenshot is taken afterwards for the same reason — a PNG of a page mid-stream shows
      // a layout that nobody ever sees.
      const fold = await settledFold(page);

      await page.screenshot({
        path: path.join(OUT, `${target.name}-${width}.png`),
        fullPage: true,
      });

      // A 390x844 phone shows roughly 690px once browser chrome is taken off, so 500px leaves
      // margin and still fails loudly if a panel creeps back above the action. /private was
      // 791px before feature 3 was closed out and 265px after D-132.
      const buried = width < 768 && fold !== null && fold > FOLD_LIMIT;

      // A gated page with no marker is a fault in its own right, and a quiet one: the check
      // would otherwise report nothing and the page would pass by having lost the very thing
      // being measured. That is how a page stops being checked without anyone noticing —
      // see the migration test that spent a release testing nothing (D-165's commit).
      const unmarked = target.gated && !rejected && fold === null;
      if (buried || rejected || unmarked) privateFaults += 1;

      console.log(
        `${String(width).padStart(4)}px ${target.name.padEnd(18)}` +
          ` status=${response?.status() ?? "?"}` +
          (fold === null ? "" : ` first-action-at=${String(fold).padStart(4)}px`) +
          (rejected ? `  <-- redirected to ${landed}` : "") +
          (unmarked ? `  <-- gated, but no [data-first-action] on the page` : "") +
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
if (privateFaults > 0)
  console.log(`${privateFaults} private page(s) bury the answer or refused the session.`);
if (returningFaults > 0)
  console.log(
    `${returningFaults} width(s) where the signed-in header is missing its link or does not fit.`,
  );

// A non-zero exit is what lets this gate a commit, rather than being advice nobody reads.
if (faults > 0 || overLong > 0 || privateFaults > 0 || returningFaults > 0) process.exitCode = 1;
