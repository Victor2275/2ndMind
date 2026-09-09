/**
 * The bits every end-to-end script needs: a server, a signed-in browser, a way to wait for
 * something, and a way to record what held and what did not.
 *
 * Extracted when V4 Phase N added a second suite (`e2e-degraded.mjs`) alongside
 * `e2e-offline.mjs`. Two copies of "start a production server and mint a session" is two places
 * for the session shape to drift from the app's, and the way that fails is a suite which
 * silently tests a signed-out browser and passes every assertion about a sign-in page.
 */
import { spawn } from "node:child_process";
import path from "node:path";

import { chromium } from "playwright";

import { mintSession, SESSION_COOKIE } from "./session.mjs";

/**
 * Collects results and prints them as they happen.
 *
 * Returns `check` plus the running list, rather than throwing on the first failure: an e2e run
 * costs a build and a minute, and stopping at the first problem means paying that again to find
 * the second one.
 */
export function checker() {
  const failures = [];

  function check(ok, label, detail = "") {
    console.log(`  ${ok ? "ok  " : "FAIL"}  ${label}${detail ? `  — ${detail}` : ""}`);
    if (!ok) failures.push(`${label}${detail ? `: ${detail}` : ""}`);
    return ok;
  }

  return { check, failures };
}

/** Poll until `predicate` returns something truthy, or give up with a named error. */
export async function waitFor(label, predicate, { timeout = 30_000, every = 250 } = {}) {
  const deadline = Date.now() + timeout;
  for (;;) {
    let result;
    try {
      result = await predicate();
    } catch {
      result = false;
    }
    if (result) return result;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${label}`);
    await new Promise((r) => setTimeout(r, every));
  }
}

/**
 * A production build, not `next dev`.
 *
 * The worker precaches by scraping `/_next/static/...` out of the pages it caches, and dev
 * serves different URLs than a build does. Running these against a dev server would exercise a
 * caching behaviour that no phone ever sees, which is the one thing they exist for.
 */
export function startServer(port) {
  const bin = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
  const child = spawn(process.execPath, [bin, "start", "-p", String(port)], {
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
  });
  child.stdout.on("data", () => {});
  child.stderr.on("data", (d) => process.stderr.write(d));
  return child;
}

/**
 * A signed-in Chromium, sized like the phone.
 *
 * The viewport is not cosmetic: this app's offline navigation is phone-only by construction —
 * the tab bar is `.nav-mobile`, which is `display: none` above the breakpoint. The first run of
 * the offline suite reported the bar missing from a 1280px-wide browser, which was true and
 * meant nothing.
 */
export async function openSignedIn(base, secret) {
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
  return { browser, context };
}

/** Whether the worker is active, controlling this page, and what it has cached. */
export function workerState(page) {
  return page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) return { ready: false, controlled: false, cached: [] };
    const registration = await navigator.serviceWorker.ready;
    const names = await caches.keys();
    const shell = names.find((n) => n.startsWith("2ndmind-shell-"));
    if (!shell) {
      return {
        ready: !!registration.active,
        controlled: !!navigator.serviceWorker.controller,
        cached: [],
      };
    }
    const cache = await caches.open(shell);
    const keys = await cache.keys();
    return {
      ready: !!registration.active,
      controlled: !!navigator.serviceWorker.controller,
      cached: keys.map((request) => new URL(request.url).pathname),
    };
  });
}
