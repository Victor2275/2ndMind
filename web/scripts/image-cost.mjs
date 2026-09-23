/**
 * What a visitor actually downloads in images — V4 §8.11.
 *
 * ## Why this exists rather than just compressing the PNGs
 *
 * Three hero images are 792KB, 582KB and 542KB **on disk**, which reads like an obvious problem.
 * It is not obviously the visitor's problem: `next/image` re-encodes on demand, so what lands in
 * a browser is a WebP or AVIF at the requested width, and the source size may cost nothing at
 * all on the wire. The disk number and the wire number are different questions and only the
 * second one is about page speed.
 *
 * So this measures the wire number first. The same reasoning as `bundle-budget.mjs`: the build
 * output and the file listing are static accountings, and a real browser at the production
 * server is what a visitor pays.
 *
 * It reports, per route, every image response with its transferred size and whether it came
 * through `/_next/image` (optimised) or straight from `/public` (not). **An unoptimised image
 * over ~150KB is the actionable finding**; a large source PNG that is only ever served as a
 * 40KB WebP is not.
 *
 *   npm run build && npm start      # in another terminal
 *   npm run images
 *
 * `IMAGE_BASE` points it at another origin.
 */
import { chromium } from "playwright";

const BASE = process.env.IMAGE_BASE ?? process.env.SHOTS_BASE ?? "http://localhost:3000";

/**
 * Public routes that carry images, plus the widths that matter.
 *
 * Two widths because `next/image` picks from a `srcset` by viewport: a phone should be getting
 * a much smaller file than a desktop, and "does the phone actually get the small one" is a real
 * question this answers. A lab image in the lightbox is deliberately included — those are plain
 * `<img>` by decision (see `image-lightbox.tsx`) and are therefore the ones most likely to be
 * shipped at full size.
 */
const ROUTES = [
  { name: "home", url: "/" },
  { name: "projects", url: "/projects" },
  { name: "project-detail", url: "/projects/five-second-rule" },
];

const WIDTHS = [
  { label: "phone", width: 390, height: 844 },
  { label: "desktop", width: 1440, height: 900 },
];

/** Anything bigger than this, served unoptimised, is worth acting on. */
const LOUD_KB = 150;

const browser = await chromium.launch();

console.log(`Image bytes actually transferred, by route and width (V4 §8.11):\n`);

let loud = 0;

for (const route of ROUTES) {
  for (const size of WIDTHS) {
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();

    /** url -> { bytes, optimised } */
    const images = new Map();

    page.on("response", async (response) => {
      if (!response.ok()) return;
      const type = response.headers()["content-type"] ?? "";
      if (!type.startsWith("image/")) return;

      const url = response.url();
      try {
        const body = await response.body();
        images.set(url, {
          bytes: body.length,
          // `/_next/image` is the optimiser; anything else is served as it sits on disk.
          optimised: new URL(url).pathname === "/_next/image",
          type: type.split(";")[0],
        });
      } catch {
        // Body already gone — a cancelled request. Not counted rather than guessed at.
      }
    });

    await page.goto(BASE + route.url, { waitUntil: "load", timeout: 60_000 });
    // Images below the fold are lazy by default, so scroll the page to pull them in. This
    // measures the full-visit cost rather than the first-screen cost, which is the
    // conservative read.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2_000);

    const total = [...images.values()].reduce((a, b) => a + b.bytes, 0);
    console.log(
      `  ${route.name.padEnd(16)} ${size.label.padEnd(8)} ` +
        `${(total / 1024).toFixed(1).padStart(8)} KB in ${String(images.size).padStart(2)} images`,
    );

    for (const [url, info] of [...images].sort((a, b) => b[1].bytes - a[1].bytes).slice(0, 5)) {
      const kb = info.bytes / 1024;
      const bad = !info.optimised && kb > LOUD_KB;
      if (bad) loud += 1;
      console.log(
        `        ${kb.toFixed(1).padStart(8)} KB  ${info.optimised ? "opt " : "RAW "}` +
          `${info.type.padEnd(10)} ${decodeURIComponent(url.split("/").pop()).slice(0, 52)}` +
          (bad ? `   <-- unoptimised and over ${LOUD_KB}KB` : ""),
      );
    }

    await context.close();
  }
}

await browser.close();

console.log(
  loud > 0
    ? `\n${loud} unoptimised image(s) over ${LOUD_KB}KB reaching a visitor.`
    : `\nNo unoptimised image over ${LOUD_KB}KB. Source file size is not reaching visitors.`,
);

/**
 * A gate, not a diagnostic — D-190's standing lesson.
 *
 * The bug this was written to find (D-333) was a full-size PNG downloaded on every project page
 * for a dialog nobody had opened, and it was invisible in every other check: the page looked
 * right, `npm run shots` passed, the bundle gate measures scripts only, and `next build` says
 * nothing about images at all. A number that is printed and never enforced is how it survived.
 */
if (loud > 0) process.exitCode = 1;
