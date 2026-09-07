/**
 * Measures what the ambient background layer costs to raster and composite.
 *
 * `globals.css` paints the ground with `body::before` — three large radial gradients on a
 * fixed, full-viewport layer, animated by `mesh-drift` on desktop — and `body::after`, an
 * SVG-noise grain over it. D-179 turned the *animation* off below 40rem on the argument that a
 * composited layer the size of the display, repainting for as long as the app is open, costs
 * warmth and battery rather than frames. That argument was made from first principles and
 * never measured.
 *
 * V4 §0.6 takes the "before" number so §1.4's redesign can be held to it (D-193).
 *
 *   npm run dev                       # in another terminal
 *   npm run paint                     # desktop, and a 6x-throttled phone proxy
 *   npm run paint -- --cpu 4          # different throttle
 *   npm run paint -- --reps 5         # more pairs, tighter median
 *   npm run paint -- --url /private   # a different page
 *   npm run paint -- --headless       # CI. Reports raster only — see below
 *
 * ## How it measures
 *
 * Traces the same page twice — once as it ships, once with `body::before`/`::after` forced to
 * `display: none` — and reports the difference. Two runs differing only in that one rule is
 * the only way to attribute cost to the layer rather than to the page behind it.
 *
 * Pairs are run **alternately and repeated**, and the reported figure is the **median** of the
 * per-pair deltas. A single pair is not enough: the first version of this script took one of
 * each and reported the layer *saving* 3.6ms/s, which is noise wearing a finding's clothes.
 *
 * ## Two things that were wrong in the first version, and cost the first measurement
 *
 * 1. **The event names were invented.** `Paint`, `RasterTask` and `CompositeLayers` are the
 *    names in DevTools' UI and in most blog posts; they are not what this Chromium emits. The
 *    trace actually carries `RendererRasterWorker`, `RasterDecoderImpl::DoEndRasterCHROMIUM`
 *    and `ProxyImpl::ScheduledActionDraw`. Matching on the wrong names does not error — it
 *    quietly sums zero, which is exactly what it did.
 * 2. **Headless does no GPU raster.** The desktop run reported 0.00 ms/s across 34,600 trace
 *    events, because headless Chromium draws through `DirectRenderer::DrawFrame` with no
 *    rasterisation pipeline behind it. Headed is the default here for that reason; measuring a
 *    GPU cost in a browser with no GPU is measuring nothing.
 *
 * ## What it still cannot do
 *
 * **This is not the Samsung.** CPU throttling slows script and layout; it does not reproduce a
 * mobile GPU, a tiled renderer, or thermal throttling — which is the actual complaint. Treat
 * the throttled figure as a regression detector, not as the phone's number. The real-device
 * procedure is printed at the end of a run, and that number is the one that settles Q462.
 */
import { chromium } from "playwright";

const BASE = process.env.SHOTS_BASE ?? "http://localhost:3000";

function flag(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}
const has = (name) => process.argv.includes(`--${name}`);

const SECONDS = Number(flag("seconds", 5));
const CPU = Number(flag("cpu", 6));
const REPS = Number(flag("reps", 3));
const PATHNAME = flag("url", "/");
const HEADLESS = has("headless");

/*
 * The buckets, by the names this Chromium actually emits. Verified by dumping the trace rather
 * than assumed — see the header.
 *
 * `RASTER` is where a large gradient should show up: turning it into pixels is the work.
 * `DRAW` is compositing those pixels into a frame, which is where an animated fixed layer
 * costs even when nothing about it changed.
 *
 * Nesting is the trap. `RasterDecoderImpl::DoEndRasterCHROMIUM::Flush` sits inside
 * `RasterDecoderImpl::DoEndRasterCHROMIUM`, and `MainFrame.Draw` inside
 * `ProxyImpl::ScheduledActionDraw` — counting both halves of either pair double-counts the
 * same microseconds. Only the outer name of each is listed.
 */
const RASTER = new Set(["RendererRasterWorker", "RasterDecoderImpl::DoEndRasterCHROMIUM"]);
const DRAW = new Set(["ProxyImpl::ScheduledActionDraw", "DirectRenderer::DrawFrame"]);

/** Sums complete events into the two buckets. `dur` is microseconds; instant events have none. */
function buckets(events) {
  let raster = 0;
  let draw = 0;
  let n = 0;
  for (const e of events) {
    if (typeof e.dur !== "number" || e.dur <= 0) continue;
    if (RASTER.has(e.name)) {
      raster += e.dur / 1000;
      n += 1;
    } else if (DRAW.has(e.name)) {
      draw += e.dur / 1000;
      n += 1;
    }
  }
  return { raster, draw, total: raster + draw, n };
}

/**
 * One traced sample.
 *
 * @param ambient  false injects the kill switch before the trace starts, so the layer is
 *                 already gone by the time anything is recorded.
 */
async function sample(browser, { width, height, cpu, ambient }) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2,
    colorScheme: "dark",
    isMobile: width < 768,
    hasTouch: width < 768,
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);

  if (cpu > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpu });

  if (!ambient) {
    // `addInitScript`, not `addStyleTag`: this has to be in place before first paint, or the
    // first frames measured still have the layer up.
    await page.addInitScript(() => {
      const style = document.createElement("style");
      style.textContent = "body::before, body::after { display: none !important; }";
      document.documentElement.appendChild(style);
    });
  }

  await page.goto(BASE + PATHNAME, { waitUntil: "networkidle", timeout: 90_000 });
  await page
    .addStyleTag({
      content:
        "nextjs-portal, [data-nextjs-dev-tools-button], #next-logo { display: none !important; }",
    })
    .catch(() => {});

  // A second of settling. The first second after `networkidle` is hydration, which is the same
  // in both runs and only widens the spread.
  await page.waitForTimeout(1000);

  // Filtered *in the handler*, not after. `cc` and `gpu` emit ~10k events a second; keeping all
  // of them across twelve samples wedged the first version of this script — node sat at a
  // constant 12s of CPU with 28 orphaned browser processes and never returned. Only the handful
  // of names the buckets care about are retained, which is a ~99% reduction.
  const events = [];
  cdp.on("Tracing.dataCollected", ({ value }) => {
    for (const e of value) {
      if (typeof e.dur === "number" && e.dur > 0 && (RASTER.has(e.name) || DRAW.has(e.name))) {
        events.push(e);
      }
    }
  });

  await cdp.send("Tracing.start", {
    traceConfig: {
      recordMode: "recordAsMuchAsPossible",
      includedCategories: [
        "devtools.timeline",
        "disabled-by-default-devtools.timeline",
        "cc",
        "gpu",
      ],
    },
  });

  await page.waitForTimeout(SECONDS * 1000);

  // Bounded. `tracingComplete` not arriving is a hang with no symptom, and a measurement script
  // that can block forever is worse than one that reports a gap.
  const done = new Promise((resolve) => {
    const timer = setTimeout(() => resolve("timeout"), 20_000);
    cdp.once("Tracing.tracingComplete", () => {
      clearTimeout(timer);
      resolve("ok");
    });
  });
  await cdp.send("Tracing.end");
  if ((await done) === "timeout") {
    console.warn("  (trace did not flush within 20s — this sample is short)");
  }

  const b = buckets(events);
  await context.close();

  return {
    raster: b.raster / SECONDS,
    draw: b.draw / SECONDS,
    total: b.total / SECONDS,
    n: b.n,
  };
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

async function compare(browser, { width, height, cpu, name }) {
  const on = [];
  const off = [];

  // Alternated rather than run in two blocks, so a machine that warms up or throttles part-way
  // through biases both sides equally instead of whichever ran second.
  for (let i = 0; i < REPS; i += 1) {
    on.push(await sample(browser, { width, height, cpu, ambient: true }));
    off.push(await sample(browser, { width, height, cpu, ambient: false }));
  }

  const onTotal = median(on.map((r) => r.total));
  const offTotal = median(off.map((r) => r.total));
  const delta = onTotal - offTotal;
  const spread = Math.max(...on.map((r) => r.total)) - Math.min(...on.map((r) => r.total));

  console.log(`\n${name}  —  ${width}x${height}, CPU x${cpu}, ${REPS} pairs of ${SECONDS}s`);
  console.log(
    `  ambient on    ${onTotal.toFixed(2)} ms/s` +
      `  (raster ${median(on.map((r) => r.raster)).toFixed(2)},` +
      ` draw ${median(on.map((r) => r.draw)).toFixed(2)})`,
  );
  console.log(
    `  ambient off   ${offTotal.toFixed(2)} ms/s` +
      `  (raster ${median(off.map((r) => r.raster)).toFixed(2)},` +
      ` draw ${median(off.map((r) => r.draw)).toFixed(2)})`,
  );

  // A delta smaller than the run-to-run spread is not a measurement, and saying so is the
  // whole point of taking more than one sample.
  const trustworthy = Math.abs(delta) > spread;
  console.log(
    `  the layer costs ${delta >= 0 ? "+" : ""}${delta.toFixed(2)} ms/s` +
      `   [spread across runs ${spread.toFixed(2)} ms/s` +
      ` — ${trustworthy ? "delta is above the noise" : "BELOW THE NOISE, do not quote this"}]`,
  );

  return { name, onTotal, offTotal, delta, spread, trustworthy };
}

console.log(`Ambient layer cost — ${BASE}${PATHNAME}${HEADLESS ? "  (headless)" : ""}`);
if (HEADLESS) {
  console.log("Headless has no GPU raster pipeline; expect raster to read 0. See the header.");
}

const browser = await chromium.launch({ headless: HEADLESS });
const rows = [];

/* Desktop is where `mesh-drift` still runs (D-179 stopped it below 40rem), so this is the case
   with a continuously animated, full-viewport composited layer. */
rows.push(await compare(browser, { width: 1280, height: 900, cpu: 1, name: "Desktop, drift ON" }));

/* 390px: the drift is off here, so this measures the static gradient and grain alone — the part
   D-179 deliberately kept. Throttled, because an unthrottled desktop core cannot answer a
   phone-shaped question. */
rows.push(
  await compare(browser, { width: 390, height: 844, cpu: CPU, name: "Phone proxy, drift OFF" }),
);

await browser.close();

console.log("\n--- baseline, for docs/V4_PLAN.md §0.6 ---");
for (const r of rows) {
  console.log(
    `${r.name.padEnd(24)} on=${r.onTotal.toFixed(2)} off=${r.offTotal.toFixed(2)} ` +
      `delta=${r.delta >= 0 ? "+" : ""}${r.delta.toFixed(2)} ms/s ` +
      `${r.trustworthy ? "" : "(below noise)"}`,
  );
}

console.log(`
Recorded: ${new Date().toISOString().slice(0, 10)}

## The number that settles Q462 still needs the Samsung

Everything above is a proxy. For the phone:

  1. Phone: Developer options -> USB debugging, and plug it in.
  2. Laptop: chrome://inspect#devices, confirm the phone appears.
  3. Same page, "Port forwarding": map 3000 -> localhost:3000.
  4. Open http://localhost:3000/private on the phone, then "inspect" it.
  5. Performance panel -> record 6 seconds of the page sitting idle. Do not scroll.
  6. Read Summary -> Rendering + Painting. Write it down.
  7. In the Console of that inspected page, turn the layer off:

       document.documentElement.insertAdjacentHTML('beforeend',
         '<style>body::before,body::after{display:none!important}</style>')

  8. Record again. The difference between the two totals is the answer.

Do it on /private rather than /, and at the brightness you actually use — on OLED part of a
large gradient's cost is the panel's, not the GPU's, and that half never appears in a trace.`);
