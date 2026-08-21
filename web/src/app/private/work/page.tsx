import { VaultDocument } from "@/components/site/vault-document";

export const dynamic = "force-dynamic";

/**
 * Career operations: strategy and targets, read from the vault.
 *
 * Deliberately *not* an application tracker. `internship_pipeline.md` records that a
 * background script already scans Gmail and maintains a master Google Sheet, and asks AI
 * assistants to leave that data entry alone. A second tracker here would be a competing
 * source of truth for the same facts, which is the failure mode this whole vault exists to
 * avoid.
 */
export default function WorkPage() {
  return (
    <main className="py-10">
      <p className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-highlight">
        Career
      </p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">Work</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Strategy and targets. Application tracking lives in the Google Sheet the mail script
        maintains — this page does not duplicate it.
      </p>

      <section className="mt-8 rounded-lg border border-border bg-card/70 p-5">
        <h2 className="mb-4 text-lg font-bold tracking-tight">Pipeline</h2>
        <VaultDocument path="context/04_operations/internship_pipeline.md" />
      </section>

      <section className="mt-6 rounded-lg border border-border bg-card/70 p-5">
        <h2 className="mb-4 text-lg font-bold tracking-tight">Targets</h2>
        <VaultDocument path="context/01_engineering/career_targets.md" />
      </section>
    </main>
  );
}
