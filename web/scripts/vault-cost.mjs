/**
 * What a vault read actually costs — V4 §8.3.
 *
 * Eight call sites render private screens off `readVaultFileCached`, which wraps
 * `readVaultFile` in `unstable_cache` with tag invalidation and a 300s safety net. The question
 * §8.3 exists to answer is whether that cache is doing meaningful work or whether the reads were
 * never the problem — and D-193 is the precedent for asking before optimising: the ambient
 * layer's cost was argued from first principles, measured, and came back inside the noise.
 *
 * This times the **uncached** path, which is what a cold miss pays: one GitHub Contents API
 * round trip per file. It does not attempt to time `unstable_cache` itself, because a cache hit
 * on Vercel's Data Cache is a different machine from this one and the number here would mean
 * nothing.
 *
 *   node --env-file-if-exists=.env.local scripts/vault-cost.mjs
 */
import { Octokit } from "@octokit/rest";

const OWNER = "Victor2275";
const REPO = "2ndMind";
const BRANCH = "main";

const token = process.env.GITHUB_TOKEN;
if (!token) {
  console.error("GITHUB_TOKEN is not set. Run with --env-file-if-exists=.env.local");
  process.exit(1);
}

const octokit = new Octokit({ auth: token });

/**
 * The files private screens actually read, and which screen reads them.
 *
 * Taken from the eight `readVaultFileCached` call sites. `/private` (Today) is the interesting
 * row: it is the page Victor opens most, and it reads the challenge file through `loadPlan()`
 * as well as its own.
 */
const FILES = [
  ["context/02_physical_performance/fall_2026_challenge.md", "Today + Athletics + Plan"],
  ["context/04_operations/current_sprint.md", "Today"],
  ["context/01_engineering/degree_audit.md", "Academics"],
  ["context/01_engineering/course_plan.md", "Academics plan"],
  ["context/02_physical_performance/training_blocks.md", "Athletics"],
];

async function timeRead(path) {
  const t0 = performance.now();
  const response = await octokit.repos.getContent({ owner: OWNER, repo: REPO, path, ref: BRANCH });
  const ms = performance.now() - t0;
  const bytes = Buffer.from(response.data.content, "base64").length;
  return { ms, bytes };
}

console.log(`One GitHub Contents API round trip per vault file (V4 §8.3):\n`);

const timings = [];
for (const [path, screen] of FILES) {
  try {
    const { ms, bytes } = await timeRead(path);
    timings.push(ms);
    console.log(
      `  ${ms.toFixed(0).padStart(6)} ms  ${(bytes / 1024).toFixed(1).padStart(6)} KB  ` +
        `${screen.padEnd(26)} ${path.split("/").pop()}`,
    );
  } catch (error) {
    console.log(
      `  ${"—".padStart(6)}     ${screen.padEnd(26)} ${path} (${error.status ?? "failed"})`,
    );
  }
}

if (timings.length > 0) {
  const total = timings.reduce((a, b) => a + b, 0);
  const avg = total / timings.length;
  console.log(`\n  average round trip: ${avg.toFixed(0)} ms`);
  console.log(
    `  a screen reading two files serially on a cold cache pays about ${(avg * 2).toFixed(0)} ms`,
  );
  console.log(
    `\n  For scale: D-022 measured /private/academics at 761 ms on two serial round trips before\n` +
      `  any caching existed, against 33 ms for the one private page that makes no network call.`,
  );
}
