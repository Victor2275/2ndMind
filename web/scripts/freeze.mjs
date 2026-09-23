/**
 * Freezes the deployed site to a folder of standalone HTML files you can browse with no
 * network at all — for reviewing the site on a plane and writing notes against it.
 *
 * This exists because the public site runs offline under `npm run dev` but the private one
 * does not: `/private/*` redirects to sign-in, athletics needs Neon, and several pages read
 * editable files through the GitHub API. A frozen snapshot sidesteps all of that.
 *
 * Public pages capture as-is. Private pages need your session: copy the value of the
 * `2m_session` cookie from victorgusev.com (DevTools > Application > Cookies > victorgusev.com)
 * and pass it as FREEZE_COOKIE. Without it, only the public pages are saved.
 *
 *   FREEZE_COOKIE='<2m_session value>' npm run freeze
 *   npm run freeze                                    # public only
 *   FREEZE_BASE=http://localhost:3000 npm run freeze  # against a local dev server
 *
 * Output: .frozen/ (gitignored). Open .frozen/index.html and click around.
 *
 * Each file is self-contained: stylesheets, fonts and images are inlined as data URIs and
 * every <script> is stripped, so a frozen page renders on the plane exactly as it did when
 * captured and never reaches for the network. Buttons and forms are therefore inert by
 * design — this is a snapshot to look at, not a running app.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = (process.env.FREEZE_BASE ?? "https://victorgusev.com").replace(/\/+$/, "");
const COOKIE = process.env.FREEZE_COOKIE?.trim();
const OUT = path.join(process.cwd(), ".frozen");

// Project detail routes come from the vault so this stays correct as projects are added —
// CLAUDE.md guarantees the slug matches the filename.
const projectSlugs = fs
  .readdirSync(path.join(process.cwd(), "..", "context", "01_engineering", "projects"))
  .filter((f) => f.endsWith(".md"))
  .map((f) => f.replace(/\.md$/, ""))
  .sort();

// RESUME_VARIANTS from src/lib/resume.ts — stable, not worth importing TS from here.
const resumeVariants = ["robotics", "ml", "swe"];

const PUBLIC_ROUTES = [
  "/",
  "/projects",
  ...projectSlugs.map((s) => `/projects/${s}`),
  ...resumeVariants.map((v) => `/resume/${v}`),
];

const PRIVATE_ROUTES = [
  "/private",
  "/private/academics",
  "/private/athletics",
  "/private/calendar",
  "/private/hobbies",
  "/private/log",
  "/private/now",
  "/private/tailor",
  "/private/work",
];

/** `/` -> `home`, `/private/athletics` -> `private-athletics`. */
function fileFor(route) {
  const slug = route.replace(/^\/+/, "").replace(/\/+$/, "").replace(/\//g, "-");
  return `${slug || "home"}.html`;
}

/**
 * Runs in the page: replace every network dependency with an inline copy, then remove
 * anything that would still hit the network or try to rehydrate.
 */
async function inlinePage(page, routeMap) {
  await page.evaluate(async (routeMap) => {
    const toDataURI = async (url) => {
      try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const bytes = new Uint8Array(await res.arrayBuffer());
        let bin = "";
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        const type = res.headers.get("content-type") || "application/octet-stream";
        return `data:${type};base64,${btoa(bin)}`;
      } catch {
        return null;
      }
    };

    const inlineCssUrls = async (cssText, baseUrl) => {
      const refs = [...cssText.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g)]
        .map((m) => m[2])
        .filter((r) => r && !r.startsWith("data:"));
      let out = cssText;
      for (const ref of [...new Set(refs)]) {
        try {
          const data = await toDataURI(new URL(ref, baseUrl).href);
          if (data) out = out.split(ref).join(data);
        } catch {
          /* leave the reference; it just won't load offline */
        }
      }
      return out;
    };

    for (const link of [...document.querySelectorAll('link[rel="stylesheet"]')]) {
      try {
        const css = await inlineCssUrls(await (await fetch(link.href)).text(), link.href);
        const style = document.createElement("style");
        style.textContent = css;
        link.replaceWith(style);
      } catch {
        link.remove();
      }
    }

    for (const style of [...document.querySelectorAll("style")]) {
      if (style.textContent.includes("url(")) {
        style.textContent = await inlineCssUrls(style.textContent, location.href);
      }
    }

    for (const img of [...document.querySelectorAll("img")]) {
      img.removeAttribute("srcset");
      img.removeAttribute("loading");
      const src = img.currentSrc || img.src;
      if (src && !src.startsWith("data:")) {
        const data = await toDataURI(src);
        if (data) img.src = data;
      }
    }
    for (const s of [...document.querySelectorAll("picture source")]) s.remove();

    for (const el of [
      ...document.querySelectorAll(
        'script, link[rel="modulepreload"], link[rel="preload"], link[rel="prefetch"], link[rel="dns-prefetch"], link[rel="preconnect"]',
      ),
    ]) {
      el.remove();
    }

    // Rewrite same-origin links to the sibling frozen file, so clicking through works on
    // file://. Unknown paths and external links are left alone.
    for (const a of [...document.querySelectorAll("a[href]")]) {
      const raw = a.getAttribute("href");
      if (!raw || raw.startsWith("#") || /^[a-z]+:/i.test(raw)) continue;
      let pathname = raw;
      let tail = "";
      const hash = raw.indexOf("#");
      if (hash !== -1) {
        tail = raw.slice(hash);
        pathname = raw.slice(0, hash);
      }
      pathname = pathname.split("?")[0].replace(/\/+$/, "") || "/";
      if (routeMap[pathname]) a.setAttribute("href", routeMap[pathname] + tail);
    }

    document.documentElement.setAttribute("data-frozen-at", new Date().toISOString());
  }, routeMap);
}

async function capture(page, route, routeMap) {
  const url = `${BASE}${route}`;
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
  } catch {
    await page.goto(url, { waitUntil: "load", timeout: 30_000 }).catch(() => {});
  }
  await page.waitForTimeout(700); // let late fonts/images settle before inlining

  if (route.startsWith("/private") && new URL(page.url()).pathname.startsWith("/signin")) {
    return { route, ok: false, reason: "bounced to /signin — FREEZE_COOKIE missing or expired" };
  }

  await inlinePage(page, routeMap);
  const html = "<!doctype html>\n" + (await page.content());
  fs.writeFileSync(path.join(OUT, fileFor(route)), html, "utf8");
  return { route, ok: true, bytes: html.length };
}

function writeIndex(results) {
  const row = (r) =>
    r.ok
      ? `<li><a href="${fileFor(r.route)}">${r.route}</a> <span class="k">${(r.bytes / 1024).toFixed(0)} KB</span></li>`
      : `<li class="miss">${r.route} <span class="k">${r.reason}</span></li>`;

  const pub = results.filter((r) => !r.route.startsWith("/private"));
  const priv = results.filter((r) => r.route.startsWith("/private"));

  fs.writeFileSync(
    path.join(OUT, "index.html"),
    `<!doctype html><meta charset="utf-8"><title>Frozen site — ${new Date().toISOString().slice(0, 10)}</title>
<style>
  :root { color-scheme: dark }
  body { background:#0c0a0d; color:#e7e3e6; font:16px/1.6 system-ui,sans-serif; max-width:52rem; margin:4rem auto; padding:0 1.5rem }
  h1 { font-size:1.4rem } h2 { font-size:1rem; margin-top:2.5rem; color:#d94f93 }
  ul { list-style:none; padding:0 } li { padding:.35rem 0; border-bottom:1px solid #221e24 }
  a { color:#8fc0dc; text-decoration:none } a:hover { text-decoration:underline }
  .k { color:#6b656e; font-size:.8rem; margin-left:.5rem } .miss { color:#8a7f88 }
  p { color:#9a929c; font-size:.9rem }
</style>
<h1>Frozen site &middot; ${BASE} &middot; ${new Date().toISOString()}</h1>
<p>Static snapshot. JavaScript is stripped, so buttons and forms don't work &mdash; this is for
looking and note-taking. Jot reactions in <code>web/SITE-REVIEW.md</code>.</p>
<h2>Public</h2><ul>${pub.map(row).join("")}</ul>
<h2>Private</h2><ul>${priv.map(row).join("")}</ul>`,
    "utf8",
  );

  // The review doc lives in web/ (committed), not in .frozen/ (gitignored), so notes written
  // on the plane survive and can be pushed. Created once, then left alone on re-runs.
  const notes = path.join(process.cwd(), "SITE-REVIEW.md");
  if (!fs.existsSync(notes)) {
    fs.writeFileSync(
      notes,
      `# Site review — snapshot ${new Date().toISOString().slice(0, 10)}\n\n` +
        `What I like / don't like, page by page. Rough is fine; tidy later.\n\n` +
        results
          .filter((r) => r.ok)
          .map((r) => `## ${r.route}\n\n- \n`)
          .join("\n"),
      "utf8",
    );
    console.log(`Wrote ${notes}`);
  }
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
if (COOKIE) {
  await context.addCookies([
    {
      name: "2m_session",
      value: COOKIE,
      domain: new URL(BASE).hostname,
      path: "/",
      httpOnly: true,
      secure: BASE.startsWith("https"),
      sameSite: "Lax",
    },
  ]);
}

// Clear old snapshot pages so a renamed route never leaves a stale file behind — but keep
// NOTES.md, which is the whole point of the exercise and survives re-runs.
fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) {
  if (f.endsWith(".html")) fs.rmSync(path.join(OUT, f));
}
const page = await context.newPage();
const routes = COOKIE ? [...PUBLIC_ROUTES, ...PRIVATE_ROUTES] : PUBLIC_ROUTES;
const routeMap = Object.fromEntries(routes.map((r) => [r.replace(/\/+$/, "") || "/", fileFor(r)]));

const results = [];
for (const route of routes) {
  const r = await capture(page, route, routeMap);
  results.push(r);
  console.log(r.ok ? `  ok   ${route}` : `  MISS ${route} — ${r.reason}`);
}

writeIndex(results);
await browser.close();

const missed = results.filter((r) => !r.ok);
console.log(`\n${results.length - missed.length}/${results.length} pages -> ${OUT}`);
if (!COOKIE) console.log("Private pages skipped: set FREEZE_COOKIE to include them.");
console.log(`Open ${path.join(OUT, "index.html")}`);
process.exit(missed.some((r) => !r.route.startsWith("/private")) ? 1 : 0);
