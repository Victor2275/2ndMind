import { Prose } from "@/components/site/prose";
import { getFrontmatterField, splitFrontmatter } from "@/lib/vault/frontmatter";
import { readVaultFileCached } from "@/lib/vault/write";

/**
 * Renders one vault file inside the private site, with its own freshness stated.
 *
 * Loading is split from rendering so a page showing two documents can fetch both with
 * `Promise.all` instead of awaiting them one after the other. Two serial GitHub round trips
 * were measurably half the cost of `/private/work` and `/private/academics`.
 *
 * Reads go through the cached reader: a vault file changes only when this app commits to it,
 * and the write path invalidates the tag. The uncached `readVaultFile` stays for actions,
 * which need a live blob SHA.
 */

const VOLATILE_LIMIT_DAYS = 14;

export type VaultDoc = {
  path: string;
  body: string;
  updated: string | null;
  ageDays: number | null;
  stale: boolean;
  error: string | null;
};

function daysSince(iso: string): number | null {
  const then = Date.parse(`${iso}T00:00:00Z`);
  if (Number.isNaN(then)) return null;
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.floor((today - then) / 86_400_000);
}

/** Never throws: a document that cannot be read renders as a message, not a crashed page. */
export async function loadVaultDoc(path: string): Promise<VaultDoc> {
  const empty = { path, body: "", updated: null, ageDays: null, stale: false };
  try {
    const { content } = await readVaultFileCached(path);
    const split = splitFrontmatter(content);
    const updated = getFrontmatterField(content, "updated");
    const stability = getFrontmatterField(content, "stability") ?? "stable";
    const ageDays = updated ? daysSince(updated) : null;

    return {
      ...empty,
      body: split ? split.body : content,
      updated,
      ageDays,
      stale: stability === "volatile" && ageDays !== null && ageDays > VOLATILE_LIMIT_DAYS,
      error: null,
    };
  } catch (error) {
    return {
      ...empty,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function VaultDocument({ doc }: { doc: VaultDoc }) {
  if (doc.error) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3">
        <p className="text-sm font-medium text-foreground">Could not load this document.</p>
        <p className="mt-1 text-xs text-muted-foreground">{doc.error}</p>
      </div>
    );
  }

  return (
    <div>
      {doc.stale && (
        <p className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-muted-foreground">
          Marked <code>volatile</code> and untouched for {doc.ageDays} days. Treat as suspect.
        </p>
      )}
      <Prose>{doc.body}</Prose>
    </div>
  );
}
