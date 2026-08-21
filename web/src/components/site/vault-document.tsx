import { Prose } from "@/components/site/prose";
import { getFrontmatterField, splitFrontmatter } from "@/lib/vault/frontmatter";
import { readVaultFile } from "@/lib/vault/write";

/**
 * Renders one vault file inside the private site, with its own freshness stated.
 *
 * Read over the GitHub API rather than from disk, per DECISIONS.md D-019 — these are files
 * the private site can edit, so the local copy is stale by definition after a write. The
 * bulk freshness walk on the dashboard is the deliberate exception (D-022).
 */

const VOLATILE_LIMIT_DAYS = 14;

function daysSince(iso: string): number | null {
  const then = Date.parse(`${iso}T00:00:00Z`);
  if (Number.isNaN(then)) return null;
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.floor((today - then) / 86_400_000);
}

export async function VaultDocument({ path }: { path: string }) {
  let raw: string;
  try {
    raw = (await readVaultFile(path)).content;
  } catch (error) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
        <p className="font-medium text-foreground">Could not read {path}.</p>
        <p className="mt-1 text-muted-foreground">
          {error instanceof Error ? error.message : String(error)}
        </p>
      </div>
    );
  }

  const split = splitFrontmatter(raw);
  const body = split ? split.body : raw;
  const updated = getFrontmatterField(raw, "updated");
  const stability = getFrontmatterField(raw, "stability") ?? "stable";
  const age = updated ? daysSince(updated) : null;
  const stale = stability === "volatile" && age !== null && age > VOLATILE_LIMIT_DAYS;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded border border-border/70 px-1.5 py-0.5 font-mono text-[0.55rem] text-muted-foreground">
          {path.replace(/^context\//, "")}
        </span>
        {updated && (
          <span
            className={`tabular font-mono text-[0.65rem] ${
              stale ? "text-destructive" : "text-muted-foreground"
            }`}
          >
            updated {updated}
            {age !== null && age > 0 ? ` · ${age}d ago` : ""}
          </span>
        )}
      </div>

      {stale && (
        <p className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-muted-foreground">
          Marked <code>volatile</code> and untouched for {age} days. Treat this as suspect
          rather than current.
        </p>
      )}

      <div className="mt-5">
        <Prose>{body}</Prose>
      </div>
    </div>
  );
}
