import "server-only";

import { Octokit } from "@octokit/rest";

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

function client(): Octokit {
  const auth = process.env.GITHUB_TOKEN;
  if (!auth) {
    throw new Error(
      "GITHUB_TOKEN is not set. Mint a fine-grained PAT scoped to the 2ndMind repo with " +
        "Contents: read and write. See web/.env.example.",
    );
  }
  return new Octokit({ auth });
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
