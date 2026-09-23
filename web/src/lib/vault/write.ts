import "server-only";

import { Octokit } from "@octokit/rest";
import { unstable_cache, updateTag } from "next/cache";

import { bumpUpdated } from "./frontmatter";

/**
 * Vault writes go through the GitHub Contents API, never the filesystem.
 *
 * Vercel functions run on an ephemeral, read-only filesystem with no git binary. `fs.writeFile`
 * appears to succeed locally and then silently loses every write in production — which is the
 * worst possible failure mode for a logging tool, because the data is gone before anyone
 * notices. One commit per save; last-write-wins on conflict, per Victor's decision.
 */

export type WriteResult = { commit: string; path: string; url: string };

const OWNER = "Victor2275";
const REPO = "2ndMind";
const BRANCH = "main";

/**
 * Every request gets a deadline. Without one, a network problem is not a slow page — it is a
 * hung one: when the connection dropped mid-session on 2026-08-21, private pages sat for
 * minutes instead of failing. `fetch` has no default timeout, so this is the only place a
 * deadline can come from.
 */
// 8s rather than 5s: a 5s deadline fired on Victor's connection during normal use, and a
// timeout that trips on a working-but-slow link is worse than none — it turns a slow page
// into a broken one. Long enough to ride out a bad moment, short enough to fail before
// anyone assumes the app has hung.
const REQUEST_TIMEOUT_MS = 8_000;

function timeoutFetch(url: string | URL | Request, init?: RequestInit): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) }).catch(
    (error: unknown) => {
      // AbortError says "the operation was aborted", which reads like a bug rather than a
      // network problem. Say what actually happened.
      if (error instanceof Error && error.name === "TimeoutError") {
        throw new Error(
          `GitHub did not respond within ${REQUEST_TIMEOUT_MS / 1000}s. Check your connection.`,
        );
      }
      throw error;
    },
  );
}

function client(): Octokit {
  const auth = process.env.GITHUB_TOKEN;
  if (!auth) {
    throw new Error(
      "GITHUB_TOKEN is not set. Mint a fine-grained PAT scoped to the 2ndMind repo with " +
        "Contents: read and write. See web/.env.example.",
    );
  }
  return new Octokit({ auth, request: { fetch: timeoutFetch } });
}

/**
 * Paths are validated rather than trusted. Everything written is under `context/`, and a
 * `..` segment would let a write escape the vault entirely — into `web/`, or into a
 * workflow file, which a Contents-scoped token is otherwise perfectly able to modify.
 */
export function assertVaultPath(path: string): void {
  // Shape first, prefix second. A backslash path fails the prefix check too, but reporting
  // it as "outside the vault" would point at the wrong defect.
  if (path.includes("..") || path.includes("\\")) {
    throw new Error(`refusing to write a path with traversal: ${path}`);
  }
  if (!path.startsWith("context/")) {
    throw new Error(`refusing to write outside the vault: ${path}`);
  }
  if (!path.endsWith(".md")) {
    throw new Error(`refusing to write a non-markdown file: ${path}`);
  }
}

export async function readVaultFile(path: string): Promise<{ content: string; sha: string }> {
  assertVaultPath(path);
  const octokit = client();
  const response = await octokit.repos.getContent({
    owner: OWNER,
    repo: REPO,
    path,
    ref: BRANCH,
  });

  if (Array.isArray(response.data) || response.data.type !== "file") {
    throw new Error(`${path} is not a file`);
  }

  return {
    content: Buffer.from(response.data.content, "base64").toString("utf8"),
    sha: response.data.sha,
  };
}

/** Invalidated whenever anything in the vault is written. */
export const VAULT_CACHE_TAG = "vault";

/**
 * Cached read, for rendering.
 *
 * A vault file changes only when this app commits to it, and we know exactly when that
 * happens — so refetching on every page load was pure latency. Measured before this existed:
 * `/private/academics` spent 761ms on two serial GitHub round trips, against 33ms for the one
 * private page that makes no network call at all.
 *
 * `unstable_cache` rather than the `use cache` directive: `use cache` needs
 * `cacheComponents: true`, which changes how every dynamic API in the app behaves and
 * conflicts with the `force-dynamic` these pages rely on. Deprecated but stable, and the
 * migration is contained to this function.
 *
 * The write path deliberately does *not* use this — `writeVaultFile` needs a live blob SHA,
 * and a cached one would make last-write-wins into last-write-fails.
 */
export const readVaultFileCached = unstable_cache(
  async (path: string) => readVaultFile(path),
  // The deploy is part of the cache key (V4 §8.3, D-335). See `revalidate` below — this is what
  // lets the safety net be an hour instead of five minutes.
  ["vault-file", process.env.VERCEL_GIT_COMMIT_SHA ?? "local"],
  {
    tags: [VAULT_CACHE_TAG],
    /**
     * A safety net, not the mechanism — and it was set far too short for how this app is used.
     *
     * Writes still invalidate immediately by tag, so nothing about *this app's* edits depends on
     * this number. It only ever bounded how long a change made **outside** the app stays
     * invisible, and "outside the app" means a direct `git push` to `context/`.
     *
     * At 300s the cache almost never helped. Measured 2026-09-22, a Contents API round trip
     * averages **357ms**, and Today reads two files serially — so a cold miss costs it ~713ms,
     * which is D-022's original 761ms measurement almost exactly. Victor opens the app a few
     * times a day, essentially always more than five minutes apart, so **essentially every open
     * was a cold miss**: the cache was paying for itself only during a single browsing session.
     *
     * The key above is what makes a longer window safe, and it is better than the timer it
     * replaces. The vault lives in **this same repository**, so a direct push to `context/`
     * redeploys the app and changes `VERCEL_GIT_COMMIT_SHA` — which changes this cache key and
     * drops the stale entry *immediately*, rather than up to 300s later. The one case left is a
     * vault change that somehow does not deploy, and an hour bounds that.
     */
    revalidate: 3_600,
  },
);

/**
 * Writes a file and returns the commit. The `updated:` frontmatter field is bumped here
 * rather than by the caller, so freshness stays honest without relying on anyone
 * remembering — `audit_freshness.py` and the site's staleness warnings both depend on it.
 */
export async function writeVaultFile(
  path: string,
  content: string,
  message: string,
  options: { today?: string } = {},
): Promise<WriteResult> {
  assertVaultPath(path);
  const octokit = client();

  // Read for the blob SHA. The API requires it to replace an existing file, and fetching it
  // immediately before writing is what makes this last-write-wins rather than an error.
  let sha: string | undefined;
  try {
    sha = (await readVaultFile(path)).sha;
  } catch {
    sha = undefined; // new file
  }

  const body = bumpUpdated(content, options.today);

  const response = await octokit.repos.createOrUpdateFileContents({
    owner: OWNER,
    repo: REPO,
    path,
    message,
    content: Buffer.from(body, "utf8").toString("base64"),
    branch: BRANCH,
    ...(sha ? { sha } : {}),
  });

  // Invalidate here rather than in each action, for the same reason `bumpUpdated` lives
  // here: correctness that depends on every caller remembering will eventually be wrong.
  //
  // `updateTag`, not `revalidateTag`. The latter now requires a cache profile, and the
  // recommended `"max"` means stale-while-revalidate — which would serve the *pre-edit*
  // content on the very next read, so a save would appear not to have happened. `updateTag`
  // is the Server Action path for changes that must be visible immediately.
  try {
    updateTag(VAULT_CACHE_TAG);
  } catch {
    // Throws outside a Server Action — tests, scripts. The write itself already succeeded,
    // and there is no cache to invalidate in those contexts.
  }

  return {
    commit: response.data.commit.sha ?? "",
    path,
    url: response.data.content?.html_url ?? "",
  };
}

/** Recent commits, for the private dashboard's activity feed. */
export async function recentCommits(limit = 8) {
  const octokit = client();
  const response = await octokit.repos.listCommits({
    owner: OWNER,
    repo: REPO,
    sha: BRANCH,
    per_page: limit,
  });

  return response.data.map((c) => ({
    sha: c.sha.slice(0, 7),
    message: c.commit.message.split("\n")[0],
    date: c.commit.author?.date ?? "",
    url: c.html_url,
  }));
}
