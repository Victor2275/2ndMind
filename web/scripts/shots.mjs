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
  { name: "projects", url: "/projects" },
  { name: "project-detail", url: "/projects/solenoid-bit-reader" },
  { name: "resume", url: "/resume/swe" },
];

const only = process.argv[2] ? Number(process.argv[2]) : null;
const widths = only ? WIDTHS.filter((w) => w === only) : WIDTHS;

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

await browser.close();
console.log(`\n${faults} page/width combination(s) scroll sideways. Written to ${OUT}/`);
