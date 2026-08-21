import { AcademicTracker } from "@/components/site/academic-tracker";
import { VaultDocument } from "@/components/site/vault-document";
import { getChecklistItems, type ChecklistItem } from "@/lib/vault/checklist";
import { TRACKER_HEADING } from "@/lib/vault/tracker";
import { readVaultFile } from "@/lib/vault/write";

export const dynamic = "force-dynamic";

const SPRINT = "context/04_operations/current_sprint.md";

export default async function AcademicsPage() {
  let items: ChecklistItem[] = [];
  let failure: string | null = null;

  try {
    const { content } = await readVaultFile(SPRINT);
    items = getChecklistItems(content, TRACKER_HEADING);
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error);
  }

  return (
    <main className="py-10">
      <p className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-highlight">
        Academics
      </p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">Coursework</h1>

      <section className="mt-8">
        <h2 className="text-lg font-bold tracking-tight">Tracker</h2>
        <p className="mt-1 mb-4 max-w-2xl text-sm text-muted-foreground">
          Midterms and projects that span more than one sprint. Each change is a commit to{" "}
          <code className="font-mono text-xs">current_sprint.md</code>.
        </p>

        {failure ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
            <p className="font-medium text-foreground">Could not read the sprint file.</p>
            <p className="mt-1 text-muted-foreground">{failure}</p>
          </div>
        ) : (
          <AcademicTracker items={items} />
        )}
      </section>

      <section className="mt-10 rounded-lg border border-border bg-card/70 p-5">
        <h2 className="mb-4 text-lg font-bold tracking-tight">Record</h2>
        <VaultDocument path="context/01_engineering/coursework_and_labs.md" />
      </section>
    </main>
  );
}
