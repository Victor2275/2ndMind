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

import { auditContrast, auditHeadings, auditTap, auditText } from "./lib/audit.mjs";
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

/**
 * Every theme id, read out of the generated `tokens.css` — V4 §7.1 (Q464).
 *
 * `lib/theme/registry.ts` is the register of record, and this script cannot import it: it is
 * plain ESM and that is TypeScript. The options were to duplicate the five ids here, as
 * `render-icons.mjs` duplicates the ground colour and needs a test to pin it, or to read them
 * from the artefact the registry generates. This reads them, for the same reason `CRAMPED_PX`
 * above reads the breakpoint out of `scale.css`: a sweep carrying its own copy of a list is a
 * sweep that will one day pass a theme it never rendered.
 *
 * A theme added to the registry appears here on the next `npm run tokens`, with no edit.
 */
const THEME_IDS = (() => {
  const css = fs.readFileSync(path.join("src", "app", "tokens.css"), "utf8");
  const ids = [...css.matchAll(/^\[data-theme="([^"]+)"\]\s*\{/gm)].map((m) => m[1]);
  if (ids.length === 0)
    throw new Error("tokens.css has no [data-theme] blocks; run `npm run tokens`");
  return [...new Set(ids)];
})();

/**
 * Real device widths, not round numbers: 360 is the common Android floor, 390 is an iPhone.
 *
 * **1440 and 1920 are new in §7.1 (Q466).** The sweep stopped at 1280, which is the width this
 * script has always called "desktop" — and which is a laptop. Victor's external monitor is
 * neither, and §4.6's two-column layouts and §4.1's 80rem column are exactly the kind of thing
 * that looks considered at 1280 and becomes a pair of narrow strips with a field of empty
 * ground between them at 1920. Nothing in the app had ever been measured there.
 *
 * Two widths rather than one, because they fail differently: 1440 is just past the 80rem
 * content cap, where the question is whether the page still looks composed once the column
 * stops growing; 1920 is far enough past it to ask whether it still looks *intentional*.
 *
 * This is what 7.0 bought. Six widths over twenty-four pages is fifty per cent more page loads
 * than the sweep did before, and it costs less wall clock than the four-width sequential sweep
 * did, because that rewrite took it from 581s to roughly 250.
 */
const WIDTHS = [360, 390, 768, 1280, 1440, 1920];

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

/**
 * How far down a private page the first actionable item may sit on a phone — V4 §7.1 (Q467).
 *
 * **350, down from 500.** Q467 asked for this to tighten "once the header collapses", and §4.2
 * collapsed it: `PageHeader` is a title bar on a phone now, and the measured savings were Today
 * 334→297, Athletics 392→235, Calendar 293→179. The 500 was set when those numbers were the
 * numbers; leaving it there means the gate has 150px of slack it was never meant to have, and a
 * gate with slack is one that lets the thing it watches drift back most of the way.
 *
 * The new number is read off the sweep rather than chosen. Measured 2026-09-21 at 360 and 390:
 *
 *   plan 149 · today 171 · academics 171 · log 206 · calendar 249–291 · athletics 437
 *
 * Five of the six gated pages sit at or under 291, so 350 clears every one of them with room
 * and still fails on a panel creeping back above the action. Athletics is the exception and
 * gets its own number below rather than being allowed to set everyone else's.
 */
const FOLD_LIMIT = 350;

/**
 * The pages that do not meet the default, with the reason and the measurement.
 *
 * This is a grandfather list and it is meant to look like one — a page here is a page whose
 * fold is worse than the app's standard and which has an argued reason, not a page that has
 * been excused. §5.1's per-subject staleness thresholds are the same idea: one number for
 * everything is either too loose for the good cases or wrong for the justified ones.
 *
 * **athletics, 460.** Measured 437 at 360 and 390. D-276 put the fall-challenge card above the
 * rehab checklist deliberately — the challenge is the thing being trained for, and the
 * checklist is how today contributes to it, so the card reading first is the design. The
 * allowance is 23px over the measurement, which is enough for the card's text to reflow onto
 * another line and not enough for a second panel to appear above it.
 *
 * It is worth writing down that this page is the app's worst fold and that this entry is the
 * only thing keeping it passing. If Athletics is ever reordered, this line should be deleted
 * rather than raised.
 */
const FOLD_OVERRIDES = {
  "private-athletics": 460,
};

/**
 * The tap-target floor — Q441, raised from 40px to 44px.
 *
 * D-190 found this had never been a gate at all: `shots.mjs` computed the count, printed it,
 * and summed nothing. So this is two changes at once — the floor moves up, and for the first
 * time a run that fails it exits non-zero. See `auditTap` for what is measured, which is not
 * quite "every control's own box".
 */
const TAP_FLOOR = 44;

/**
 * The per-page tap-target budget — how many sub-44px controls each page is currently allowed.
 *
 * **This is a ratchet, not an exemption.** The floor lands on an app with a real backlog of
 * near-misses — a 51x32 header link, a 47x36 tab, a 40x40 icon button — and every one of those
 * is a design change rather than an allowlist entry. A gate that is red on the day it ships is
 * a gate somebody switches off inside a week, and D-190 is this repo's record of what that
 * costs: the tap and text counts were printed and summed by nothing for three versions, and
 * read as a pass the entire time.
 *
 * So every number below is **enforced**. A page over its budget fails the run, which means a
 * new small control is a failure the moment it is added, while the existing ones are a number
 * somebody can work down. The numbers only ever go down: `node scripts/diag-tap-budget.mjs`
 * re-measures and prints this block, and it is edited when a page comes in under.
 *
 * Measured 2026-09-22 against a production build, at 360 and 390 (the widths where the pointer
 * is a thumb), taking the worse of the two. **309 across 23 pages.** The two worst are worth
 * naming because they are the two to fix first:
 *
 *   private-plan          84   seventy-six day rows, each with an edit link
 *   private-training-log  32   the set inputs, at 80x27
 *
 * Legitimate exemptions are not in here — they carry `data-small-target` with a reason at the
 * call site (the skip link, the component gallery), and links inside a sentence are excluded by
 * `auditTap` under WCAG 2.5.8's own exception rather than by any list.
 */
const TAP_BUDGET = {
  "private-plan": 84,
  "private-training-log": 32,
  "private-work": 21,
  projects: 17,
  resume: 17,
  "private-today": 17,
  "private-log": 17,
  home: 15,
  now: 13,
  "private-athletics": 13,
  "private-training-history": 11,
  "project-detail": 10,
  "private-exercises": 9,
  "private-settings": 7,
  "private-tailor": 6,
  "private-academics": 6,
  "private-exercise-detail": 4,
  "private-calendar": 3,
  "private-now": 3,
  "private-hobbies": 2,
  "private-log-archive": 1,
  "private-sync": 1,
  "private-kitchen-sink": 0,
};

/**
 * The text floor — Q113, 11px, with `data-tiny-text` as the allowlist.
 *
 * Also never a gate before D-190. 11 rather than 12 is deliberate and is the number Q113 gives:
 * `--text-xs` is 12px and is the smallest step on the scale, and `build-scale.mts` records why
 * it is not the geometric 11.11px — so a floor *at* 12 would fail on any element that ever
 * lands on the step below the scale's bottom, which is a floor that cannot be satisfied. 11 is
 * below the scale and above the point where text stops being readable on a phone.
 */
const TEXT_FLOOR = 11;

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
  // The summary archive (V4 §5.4, D-285). Ungated: it is a record you read, and the one thing
  // you can do on it is leave. Swept because it is a new route rendering a stack of panels
  // whose height is written by a model, which is the shape most likely to overflow.
  { name: "private-log-archive", url: "/private/log/archive", gated: false },
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
/**
 * Waits for webfonts before anything is measured.
 *
 * This app self-hosts three faces through `next/font/local`, and until they load the browser
 * renders in a fallback whose metrics are different. Every number this script takes moves with
 * that swap: the fold, the text-size census, and the overflow read.
 *
 * It is the cause of a flake that survived two wrong diagnoses. `/private/athletics` reported
 * **394px on some runs and 414px on others**, same build, same server. The first guess was that
 * concurrency was to blame, because the sequential sweep happened to return 414 twice — then
 * the default six-way run produced 394 as well, which ruled parallelism out. Twenty pixels is
 * one line of heading re-flowing when Bricolage replaces the fallback. `settledFold` cannot see
 * it: the swap lands between two readings that have already agreed, so the loop exits happy.
 *
 * `document.fonts.ready` is the only real fix — waiting longer just narrows the window.
 */
async function fontsReady(page) {
  await page.evaluate(() => document.fonts.ready).catch(() => {});
}

async function settledFold(page) {
  await fontsReady(page);
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

  flush(
    await mapPool(RESUME_VARIANTS, CONCURRENCY, async (variant) => {
      const { say, out } = buffer();
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
      await shoot(page, {
        path: path.join(OUT, `resume-${variant}-print.png`),
        clip: { x: 0, y: 0, width: PAGE_W, height: Math.max(PAGE_H, Math.ceil(height)) },
      });

      const bad = pages === null ? false : pages > 1;
      if (bad) over += 1;

      say(
        `  ${variant.padEnd(9)} ratio=${ratio.toFixed(2)} pages` +
          `=${pages ?? "?"}` +
          (pages === null ? "  <-- could not read the page tree" : bad ? "  <-- OVER" : "  ok"),
      );

      await page.close();
      return { out };
    }),
  );

  return over;
}

fs.mkdirSync(OUT, { recursive: true });

/**
 * How many pages are measured at once.
 *
 * The sweep was fully sequential and that was most of its runtime: roughly ninety page loads,
 * each waiting for `networkidle` and then up to four seconds for the fold to settle, one after
 * another. None of them depend on each other, so they were queueing for no reason.
 *
 * **Six is measured, not guessed.** Timed against this repo on 2026-09-21, gate-only
 * (`SHOTS_PNG=0`), on a warm dev server:
 *
 * | Concurrency | Wall clock |
 * | ----------- | ---------- |
 * | 1 (the old sequential sweep) | 581 s |
 * | 6 | 192 s |
 * | 12 | 148 s |
 *
 * Twelve is faster and is still not the default, because the returns have flattened while the
 * ways it can go wrong have not: `next dev` compiles routes on demand, and a cold sweep at
 * twelve puts more work into the compiler than it puts through it. Six is roughly the knee.
 *
 * **Concurrency does not change what is measured, and it was wrongly blamed once.** A 20px
 * swing on `/private/athletics` looked like a parallelism race until the sequential run
 * reproduced it too; it was webfonts, and `fontsReady` fixes it at the source. Every reading
 * here is taken inside one page from its own DOM, and `settledFold` reads twice and compares
 * precisely so a slow frame is not mistaken for a settled layout. A loaded machine makes that
 * take more attempts, not report a different number.
 *
 * If a number does move with this value, that is a real race in the page or in this script.
 * Find it — do not lower the number to hide it.
 */
const CONCURRENCY = Number(process.env.SHOTS_CONCURRENCY ?? 6);

/**
 * Runs `fn` over `items` with at most `limit` in flight, resolving in **input order**.
 *
 * Order matters because the report is read top to bottom and diffed between runs; a sweep that
 * printed rows in completion order would churn on every run and be useless to compare. So each
 * job buffers its own lines (see `say` below) and the buffers are flushed in order afterwards
 * rather than logged as they finish.
 *
 * Counters like `faults` are still incremented inside the jobs, and that is safe without any
 * locking: Node runs one job's synchronous code at a time, so `faults += 1` cannot interleave.
 */
async function mapPool(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;

  async function worker() {
    for (;;) {
      const index = next;
      next += 1;
      if (index >= items.length) return;
      results[index] = await fn(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/**
 * Whether the sweep writes its screenshots.
 *
 * `SHOTS_PNG=0` keeps every measurement and skips the images. The sweep writes about 148 MB of
 * full-page PNGs at `deviceScaleFactor: 2`, and encoding them is a large share of the runtime --
 * but when this is being run as a *gate* (overflow, the fold, the header, resume page count)
 * nobody opens them. The images stay on by default, because the other half of what this script
 * is for is the visual review, and a flag that silently stopped producing them would be found
 * out weeks later.
 *
 * The resume **PDFs are always written** even here: the page count is read back out of the PDF
 * byte stream, so it is an input to the gate rather than a picture of one.
 */
const WRITE_PNG = process.env.SHOTS_PNG !== "0";

/** `page.screenshot`, unless this run is gate-only. */
async function shoot(page, options) {
  if (!WRITE_PNG) return;
  await page.screenshot(options);
}

/** Collects a job's output so the runner can print it in order. */
function buffer() {
  const out = [];
  return { say: (...args) => out.push(args.join(" ")), out };
}

/** Prints every job's buffered lines, in the order the jobs were queued. */
function flush(buffers) {
  for (const b of buffers) for (const line of b.out) console.log(line);
}

const browser = await chromium.launch();
let faults = 0;

flush(
  await mapPool(
    widths.flatMap((width) => PAGES.map((target) => ({ width, target }))),
    CONCURRENCY,
    async ({ width, target }) => {
      const { say, out } = buffer();
      const page = await browser.newPage({
        viewport: { width, height: 900 },
        deviceScaleFactor: 2,
        colorScheme: "dark",
        isMobile: width < 768,
        hasTouch: width < 768,
      });

      await page.goto(BASE + target.url, { waitUntil: "networkidle" });
      await hideDevOverlay(page);
      await fontsReady(page);
      await shoot(page, {
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

        return { overflow, wide: wide.slice(0, 4) };
      });

      // The three §7.1 audits, each run in the page and each returning offenders rather than a
      // count (D-190's lesson: a number nothing sums is a diagnostic wearing a gate's clothes).
      const text = await page.evaluate(auditText, TEXT_FLOOR);
      const tap = await page.evaluate(auditTap, TAP_FLOOR);
      const headings = await page.evaluate(auditHeadings);

      const over = report.overflow > 0;
      // The tap floor applies where a thumb is the pointer. At 1280 and up the pointer is a
      // mouse, and holding a desktop toolbar to a 44px minimum would either bloat it or teach
      // everyone to allowlist it — both worse than not measuring it there.
      const tapGated = width < 768;
      const budget = TAP_BUDGET[target.name] ?? 0;
      const badTap = tapGated && tap.offenders.length > budget;
      const badText = text.offenders.length > 0;
      const badHeadings = headings.jumps.length > 0 || headings.h1s > 1;

      if (over || badTap || badText || badHeadings) faults += 1;

      say(
        `${String(width).padStart(4)}px ${target.name.padEnd(15)}` +
          ` overflow=${String(report.overflow).padStart(4)}px` +
          ` tap<${TAP_FLOOR}=${String(tap.offenders.length).padStart(3)}/${budget}${tapGated ? "" : "-"}` +
          ` text<${TEXT_FLOOR}=${String(text.offenders.length).padStart(3)}` +
          ` h=${headings.count}` +
          (badTap ? `  <-- over its tap budget (${budget})` : "") +
          (over ? "  <-- " + report.wide.map((w) => `${w.tag}.${w.cls}`).join(" | ") : ""),
      );

      // Offenders are printed underneath the row rather than on it, because the row is the
      // thing that gets diffed between runs and a row that grows a list is a row that cannot be.
      for (const o of text.offenders.slice(0, 5))
        say(`        text ${o.px}px  ${o.tag}.${o.cls}  "${o.text}"`);
      if (text.offenders.length > 5) say(`        text … and ${text.offenders.length - 5} more`);

      if (badTap) {
        for (const o of tap.offenders.slice(0, 5))
          say(`        tap  ${o.w}x${o.h}  ${o.tag}.${o.cls}  "${o.label}"`);
        if (tap.offenders.length > 5) say(`        tap  … and ${tap.offenders.length - 5} more`);
      }

      for (const j of headings.jumps) say(`        heading h${j.from} -> h${j.to}  "${j.text}"`);
      if (headings.h1s > 1) say(`        heading ${headings.h1s} <h1>s on one page`);

      await page.close();
      return { out };
    },
  ),
);

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

  flush(
    await mapPool(widths, CONCURRENCY, async (width) => {
      const { say, out } = buffer();
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
      await fontsReady(page);
      await shoot(page, { path: path.join(OUT, `home-returning-${width}.png`) });

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

      say(
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
      return { out };
    }),
  );
}

let privateFaults = 0;
const secret = process.env.SESSION_SECRET?.trim();
if (process.env.SHOTS_PRIVATE !== "0" && secret) {
  const token = await mintSession(secret);
  const origin = new URL(BASE).origin;
  console.log("");

  flush(
    await mapPool(
      widths.flatMap((width) => PRIVATE_PAGES.map((target) => ({ width, target }))),
      CONCURRENCY,
      async ({ width, target }) => {
        const { say, out } = buffer();
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

        await shoot(page, {
          path: path.join(OUT, `${target.name}-${width}.png`),
          fullPage: true,
        });

        // A 390x844 phone shows roughly 690px once browser chrome is taken off. /private was
        // 791px before feature 3 was closed out and 265px after D-132. §7.1 tightened the
        // limit to 350 and gave the one page that cannot meet it its own number — see
        // `FOLD_LIMIT` and `FOLD_OVERRIDES` for both measurements and the reason.
        const limit = FOLD_OVERRIDES[target.name] ?? FOLD_LIMIT;
        const buried = width < 768 && fold !== null && fold > limit;

        // The same three audits the public sweep runs. D-190's second finding was that the
        // private loop asked neither the text nor the tap question at all — which is why the
        // 8.8px tab bar went unmeasured for three versions, on the one screen Victor opens
        // every day and the only one he uses under a thumb.
        const text = await page.evaluate(auditText, TEXT_FLOOR);
        const tap = await page.evaluate(auditTap, TAP_FLOOR);
        const headings = await page.evaluate(auditHeadings);

        const tapGated = width < 768;
        const budget = TAP_BUDGET[target.name] ?? 0;
        const badTap = tapGated && tap.offenders.length > budget;
        const badText = text.offenders.length > 0;
        const badHeadings = headings.jumps.length > 0 || headings.h1s > 1;

        // A gated page with no marker is a fault in its own right, and a quiet one: the check
        // would otherwise report nothing and the page would pass by having lost the very thing
        // being measured. That is how a page stops being checked without anyone noticing —
        // see the migration test that spent a release testing nothing (D-165's commit).
        const unmarked = target.gated && !rejected && fold === null;
        if (buried || rejected || unmarked || badTap || badText || badHeadings) privateFaults += 1;

        say(
          `${String(width).padStart(4)}px ${target.name.padEnd(18)}` +
            ` status=${response?.status() ?? "?"}` +
            (fold === null ? "" : ` first-action-at=${String(fold).padStart(4)}px`) +
            ` tap<${TAP_FLOOR}=${String(tap.offenders.length).padStart(3)}/${budget}${tapGated ? "" : "-"}` +
            ` text<${TEXT_FLOOR}=${String(text.offenders.length).padStart(3)}` +
            ` h=${headings.count}` +
            (badTap ? `  <-- over its tap budget (${budget})` : "") +
            (rejected ? `  <-- redirected to ${landed}` : "") +
            (unmarked ? `  <-- gated, but no [data-first-action] on the page` : "") +
            (buried ? `  <-- below the fold (limit ${limit}px)` : ""),
        );

        for (const o of text.offenders.slice(0, 5))
          say(`        text ${o.px}px  ${o.tag}.${o.cls}  "${o.text}"`);
        if (text.offenders.length > 5) say(`        text … and ${text.offenders.length - 5} more`);

        if (badTap) {
          for (const o of tap.offenders.slice(0, 5))
            say(`        tap  ${o.w}x${o.h}  ${o.tag}.${o.cls}  "${o.label}"`);
          if (tap.offenders.length > 5) say(`        tap  … and ${tap.offenders.length - 5} more`);
        }

        for (const j of headings.jumps) say(`        heading h${j.from} -> h${j.to}  "${j.text}"`);
        if (headings.h1s > 1) say(`        heading ${headings.h1s} <h1>s on one page`);

        await context.close();
        return { out };
      },
    ),
  );
} else if (!secret) {
  console.log("\nSESSION_SECRET not set, so the private pages were skipped.");
}

/* --- Themes, and the contrast they actually render — V4 §7.1 (Q463, Q464) ---------------
   Two of §7.1's items, done as one sweep, because they are the same question asked once per
   theme: **does the text on this screen clear AA against the ground it landed on.**

   `tokens.test.ts` already checks every token *pair* for contrast, and the palettes are
   generated from contrast targets rather than chosen by eye — so it is worth being clear about
   what this adds, or it looks like the same check twice. A pair being solvable says nothing
   about which pairs actually meet on screen. Text lands on grounds it was never paired with: a
   muted label on a raised card inside a tinted panel composites to something no pair in the
   generator describes. Only a rendered page knows which combinations occurred, which is exactly
   why Q463 asks for this as a sweep rather than as another unit test.

   **Capped, per Q464's "capped".** Five themes over every page and width is 570 page loads and
   would triple the sweep. What runs instead is five themes over four pages at one width, and
   the four are chosen so that between them they render every token the app has:

     kitchen-sink   every component and every state on one page — the reason it exists (§1.11)
     private-today  the densest real screen, and the one with the most semantic colour on it
     home           the public ground, which is pinned to `carbon` in the app and therefore
                    never sees the other four in normal use
     projects       cards and badges over the ambient layer, the one place text sits on a
                    composited ground rather than a flat one

   1280 rather than a phone width: this sweep is about colour, and at 1280 every page renders
   its full desktop furniture — sidebar, two columns, the footer — so there is simply more text
   on screen per load to check.

   The theme is set by writing `data-theme` on `<html>`, which is what `next-themes` does
   (`theme-provider.tsx`); the public site pins itself to one theme with `forcedTheme`, so
   overriding the attribute directly is the only way to see the others on a public page. */
/**
 * The contrast backlog, per theme and page — V4 §7.1 (Q463), D-323.
 *
 * Same mechanism as `TAP_BUDGET` and for the same reason: what the sweep found is thirty real
 * AA shortfalls, every one of them a *near* miss between 3.74:1 and 4.41:1, and closing them
 * means moving palette tokens in the generator — which changes all five themes at once and is a
 * colour decision rather than a mechanical edit. The budget gates every one of them against
 * regression while leaving the fix to a pass that should be looked at.
 *
 * Measured 2026-09-22 at 1280, and **byte-identical across two consecutive runs**, which is the
 * property that makes it safe to gate on. It was not stable until the theme was pinned against
 * `next-themes` — see the init script below, and D-323 for what an unstable version of this
 * reported.
 *
 * What is in it, so the numbers are not anonymous: the `destructive` button and badge at 3.74:1
 * on the dark themes (white on the destructive red), the sidebar's inactive nav labels at
 * 4.31:1 on the light themes, and three single controls — a "stale" count, a capture-mode
 * button, a Records tab — between 4.03:1 and 4.41:1.
 */
const CONTRAST_BUDGET = {
  "dark-magenta/kitchen-sink": 4,
  "dark-magenta/today": 1,
  "dark-magenta/athletics": 0,
  "light-teal/kitchen-sink": 4,
  "light-teal/today": 3,
  "light-teal/athletics": 2,
  "hc-dark/kitchen-sink": 4,
  "hc-dark/today": 0,
  "hc-dark/athletics": 0,
  "carbon/kitchen-sink": 4,
  "carbon/today": 0,
  "carbon/athletics": 0,
  "steel-light/kitchen-sink": 4,
  "steel-light/today": 3,
  "steel-light/athletics": 1,
};

let contrastFaults = 0;
if (!only && process.env.SHOTS_THEMES !== "0") {
  console.log("");
  const secretForThemes = process.env.SESSION_SECRET?.trim();
  const themeToken = secretForThemes ? await mintSession(secretForThemes) : null;
  const origin = new URL(BASE).origin;

  /**
   * **Private pages only, and that is a correction.**
   *
   * The public site is pinned to one theme by `forcedTheme` (D-197, `theme-provider.tsx`), so
   * `next-themes` rewrites `data-theme` back on render and a sweep that sets the attribute is
   * racing it. The first version of this swept `/` and `/projects` too, and the result was
   * exactly what a race looks like once you read it: four themes returning byte-identical
   * counts, because four of them measured the pinned theme, and the fifth returning thirty-odd
   * contrast failures, because that one happened to win the race and measured a half-applied
   * palette. None of it was real, and all of it would have been believed.
   *
   * The theme picker applies in the private app and nowhere else, so this is also the only
   * place the question means anything. The public site has one theme; it is swept in it by the
   * main sweep above.
   */
  const THEME_PAGES = [
    { name: "kitchen-sink", url: "/private/kitchen-sink" },
    { name: "today", url: "/private" },
    { name: "athletics", url: "/private/athletics" },
  ].filter(() => Boolean(themeToken));

  const jobs = THEME_IDS.flatMap((theme) => THEME_PAGES.map((target) => ({ theme, target })));

  flush(
    await mapPool(jobs, CONCURRENCY, async ({ theme, target }) => {
      const { say, out } = buffer();
      const context = await browser.newContext({
        viewport: { width: 1280, height: 900 },
        deviceScaleFactor: 1,
      });
      await context.addCookies([
        { name: "2m_session", value: themeToken, url: origin, httpOnly: true, sameSite: "Lax" },
      ]);

      const page = await context.newPage();

      // **Pin the theme against `next-themes`, before the page's own scripts run.**
      //
      // Setting `data-theme` after load and checking it once is a race, and it lost often
      // enough to produce confident nonsense: two consecutive runs reported `dark-magenta`
      // athletics at 49 failures and then at 0, while `carbon` went 5 and then 44 — the same
      // 231 elements both times. `next-themes` writes the stored theme onto `<html>` when it
      // mounts, which can land after the attribute has been set and verified but before
      // anything is measured.
      //
      // An observer that re-applies the attribute whenever anything changes it is the only
      // version of this that does not depend on timing. Installed as an init script so it is
      // running before React is.
      await page.addInitScript((id) => {
        const pin = () => {
          const html = document.documentElement;
          if (html && html.getAttribute("data-theme") !== id) html.setAttribute("data-theme", id);
        };

        // An init script runs before the page's own scripts, which can be before
        // `document.documentElement` exists at all — the first version threw here, installed
        // no observer, and every job silently measured whatever `next-themes` chose. With
        // `enableSystem` and Playwright's default light preference, that was `light-teal` for
        // all five, which the verification below caught and named.
        const start = () => {
          if (!document.documentElement) return void requestAnimationFrame(start);
          pin();
          new MutationObserver(pin).observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["data-theme"],
          });
        };
        start();
        document.addEventListener("DOMContentLoaded", pin);
      }, theme);

      await page.goto(BASE + target.url, { waitUntil: "networkidle", timeout: 90_000 });
      await hideDevOverlay(page);

      // Two frames, so the new custom properties are resolved before anything is read.
      await page.evaluate(
        () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
      );
      await fontsReady(page);

      // **Verify it stuck, and fail loudly when it does not.** This is the check whose absence
      // made the first version of this sweep report confident nonsense. A contrast number taken
      // against a theme that is not the one named is worse than no number, because it is
      // indistinguishable from a real finding.
      const applied = await page.evaluate(() =>
        document.documentElement.getAttribute("data-theme"),
      );
      if (applied !== theme) {
        contrastFaults += 1;
        say(
          ` ${theme.padEnd(13)} ${target.name.padEnd(14)}  <-- theme did not apply (got ${applied})`,
        );
        await context.close();
        return { out };
      }

      await shoot(page, {
        path: path.join(OUT, `theme-${theme}-${target.name}.png`),
        fullPage: true,
      });

      const contrast = await page.evaluate(auditContrast);
      const allowed = CONTRAST_BUDGET[`${theme}/${target.name}`] ?? 0;
      const bad = contrast.offenders.length > allowed;
      if (bad) contrastFaults += 1;

      say(
        ` ${theme.padEnd(13)} ${target.name.padEnd(14)}` +
          ` checked=${String(contrast.checked).padStart(4)}` +
          ` unknown=${String(contrast.unknown).padStart(3)}` +
          ` below-AA=${String(contrast.offenders.length).padStart(3)}/${allowed}` +
          (bad ? `  <-- over its contrast budget (${allowed})` : ""),
      );
      for (const o of contrast.offenders.slice(0, 4))
        say(`        ${o.ratio}:1 (needs ${o.need}) ${o.px}px  ${o.tag}.${o.cls}  "${o.text}"`);
      if (contrast.offenders.length > 4) say(`        … and ${contrast.offenders.length - 4} more`);

      await context.close();
      return { out };
    }),
  );
}

// Paper has no viewport width, so this runs once rather than inside the sweep. Skipped when
// a single width was requested, because that invocation is a targeted layout check.
const overLong = only ? 0 : await measureResumes(browser);

await browser.close();
console.log(
  `\n${faults} public page/width combination(s) with a layout, text, tap or heading fault.` +
    ` Written to ${OUT}/`,
);
if (!only) console.log(`${overLong} resume variant(s) print to more than one page.`);
if (privateFaults > 0)
  console.log(`${privateFaults} private page/width combination(s) with a fault.`);
if (returningFaults > 0)
  console.log(
    `${returningFaults} width(s) where the signed-in header is missing its link or does not fit.`,
  );
if (contrastFaults > 0)
  console.log(`${contrastFaults} theme/page combination(s) with text below AA.`);

// A non-zero exit is what lets this gate a commit, rather than being advice nobody reads.
// §7.1 added text, tap, heading and contrast to the list; before it, only the first four
// counted and the other two were printed and summed by nothing at all (D-190).
if (faults > 0 || overLong > 0 || privateFaults > 0 || returningFaults > 0 || contrastFaults > 0)
  process.exitCode = 1;
