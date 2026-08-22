import { PageHeader, Panel } from "@/components/site/page-shell";
import { VaultDocument, loadVaultDoc } from "@/components/site/vault-document";

export const dynamic = "force-dynamic";

/**
 * Career operations: strategy and targets, read from the vault.
 *
 * Deliberately *not* an application tracker. `internship_pipeline.md` records that a
 * background script already scans Gmail and maintains a master Google Sheet, and asks AI
 * assistants to leave that data entry alone. A second tracker here would be a competing
 * source of truth for the same facts, which is what this whole vault exists to avoid.
 */
export default async function WorkPage() {
  // Both at once. Awaiting them in sequence was half the cost of this page.
  const [pipeline, targets] = await Promise.all([
    loadVaultDoc("context/04_operations/internship_pipeline.md"),
    loadVaultDoc("context/01_engineering/career_targets.md"),
  ]);

  return (
    <main className="pb-16">
      <PageHeader
        eyebrow="Career"
        title="Work"
        lede="Strategy and targets. Applications are tracked in the Google Sheet the mail script maintains — this page does not duplicate it."
      />

      <div className="mt-8 space-y-4">
        <Panel
          title="Pipeline"
          meta={pipeline.updated ? `updated ${pipeline.updated}` : undefined}
          collapsible
          defaultOpen
        >
          <VaultDocument doc={pipeline} />
        </Panel>

        {/* Reference rather than routine: closed by default so the page opens scannable. */}
        <Panel
          title="Targets"
          meta={targets.updated ? `updated ${targets.updated}` : undefined}
          collapsible
          defaultOpen={false}
        >
          <VaultDocument doc={targets} />
        </Panel>
      </div>
    </main>
  );
}
