import "server-only";

import fs from "node:fs";
import path from "node:path";

import { VAULT_ROOT } from "./load";

/**
 * Freshness audit — the TypeScript half of `scripts/audit_freshness.py`.
 *
 * CLAUDE.md's rule is that a `volatile` file older than ~14 days should be treated as
 * suspect rather than reported as current fact. The Python script enforces that from the
 * command line; this puts the same judgement on the dashboard, where it is actually seen.
 *
 * The two implementations must agree, so `THRESHOLDS` and the "missing metadata counts as a
 * problem" rule are copied deliberately and covered by a test that reads the Python source.
 */

export const THRESHOLDS: Record<string, number> = { volatile: 14, stable: 180 };

/** Unknown `stability:` values fall back to the laxest threshold, as the Python script does. */
const DEFAULT_LIMIT = 180;

export type FreshnessVerdict = "fresh" | "stale" | "unknown";

export type FreshnessRow = {
  path: string;
  stability: string;
  updated: string | null;
  ageDays: number | null;
  limitDays: number;
  verdict: FreshnessVerdict;
};

export type FreshnessReport = {
  rows: FreshnessRow[];
  stale: FreshnessRow[];
  unknown: FreshnessRow[];
  checked: number;
};

type VaultFile = { path: string; raw: string };

const FRONTMATTER = /^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n/;

/** Reads one scalar out of a frontmatter block. Deliberately not a YAML parser. */
function field(block: string, key: string): string | null {
  // `\r?$` matters: a bare `$` under /m still stops before \n but leaves \r on the value,
  // so `Date.parse("2026-08-21\r")` would be handed a string that fails in a confusing way.
  const match = block.match(new RegExp(`^${key}:[ \t]*(.+?)[ \t]*\r?$`, "m"));
  return match ? match[1] : null;
}

/** Whole-day difference. Both sides are floored to UTC midnight so a late-evening render
 *  does not report a file edited this morning as "1 day old". */
export function ageInDays(updated: string, today: Date): number | null {
  const then = Date.parse(`${updated}T00:00:00Z`);
  if (Number.isNaN(then)) return null;
  const now = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.floor((now - then) / 86_400_000);
}

/** Pure core: given file contents, decide what is stale. Separated from the filesystem so
 *  the interesting cases (missing frontmatter, junk dates, boundary ages) are testable. */
export function assessFreshness(files: VaultFile[], today: Date): FreshnessReport {
  const rows: FreshnessRow[] = files.map(({ path: filePath, raw }) => {
    const header = raw.match(FRONTMATTER);
    const block = header ? header[1] : "";
    const stability = (field(block, "stability") ?? "stable").trim();
    const limitDays = THRESHOLDS[stability] ?? DEFAULT_LIMIT;
    const updated = header ? field(block, "updated") : null;
    const ageDays = updated ? ageInDays(updated, today) : null;

    // No frontmatter, no `updated:`, or an unparseable date are all the same failure from
    // the reader's point of view: the file cannot vouch for itself.
    const verdict: FreshnessVerdict =
      ageDays === null ? "unknown" : ageDays > limitDays ? "stale" : "fresh";

    return { path: filePath, stability, updated, ageDays, limitDays, verdict };
  });

  // Worst first: the most overdue file is the one worth acting on.
  const stale = rows
    .filter((r) => r.verdict === "stale")
    .sort((a, b) => (b.ageDays ?? 0) - (a.ageDays ?? 0));

  return {
    rows,
    stale,
    unknown: rows.filter((r) => r.verdict === "unknown"),
    checked: rows.length,
  };
}

/** Every live vault file. `99_archive/` is excluded for the same reason CLAUDE.md forbids
 *  globbing it: superseded documents are supposed to be out of date. */
export function readVaultFiles(root: string = VAULT_ROOT): VaultFile[] {
  const out: VaultFile[] = [];

  function walk(dir: string, rel: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "99_archive" || entry.name === "assets") continue;
      const abs = path.join(dir, entry.name);
      const next = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(abs, next);
      else if (entry.name.endsWith(".md")) {
        out.push({ path: next, raw: fs.readFileSync(abs, "utf8") });
      }
    }
  }

  walk(root, "");
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

export function loadFreshness(today: Date = new Date()): FreshnessReport {
  return assessFreshness(readVaultFiles(), today);
}
