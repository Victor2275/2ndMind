import { SprintForm } from "@/components/site/sprint-form";
import { getLabelledBullet } from "@/lib/vault/frontmatter";
import { GOAL_LABELS, type GoalLabel } from "@/lib/sprint-goals";
import { readVaultFile } from "@/lib/vault/write";

export const dynamic = "force-dynamic";

export default async function SprintPage() {
  let goals: { label: GoalLabel; value: string }[] = [];
  let error: string | null = null;

  try {
    // Read through the GitHub API, not the filesystem. Vercel's runtime filesystem holds
    // only what the build traced, and after a write the local copy would be stale anyway.
    const { content } = await readVaultFile("context/04_operations/current_sprint.md");
    goals = GOAL_LABELS.map((label) => ({
      label,
      value: getLabelledBullet(content, label) ?? "",
    }));
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  return (
    <main className="py-10">
      <p className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-highlight">
        This week
      </p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">Sprint goals</h1>
      <p className="mt-2 max-w-[60ch] text-sm text-muted-foreground">
        Saving commits straight to the vault and bumps the file&rsquo;s <code>updated:</code>{" "}
        date. This replaces the <code>/sprint-review</code> slash command.
      </p>

      {error ? (
        <p className="mt-6 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-foreground">
          <span className="font-medium">Could not read the vault.</span> {error}
        </p>
      ) : (
        <SprintForm goals={goals} />
      )}
    </main>
  );
}
