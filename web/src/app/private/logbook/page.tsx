import { LogbookForm } from "@/components/site/logbook-form";
import { PageHeader, Panel } from "@/components/site/page-shell";

export const dynamic = "force-dynamic";

/**
 * Free-text daily log. Structured per-category logging (feature 2) replaces this; until then
 * it stays, because deleting the only way to record a day before its replacement exists
 * would leave a hole rather than an improvement.
 *
 * Still writes to the vault rather than Postgres, deliberately: one entry a day is prose
 * meant to be read later by an AI agent, which is what the vault is for, and one commit a
 * day is not the write volume D-036 was about.
 */
export default function LogbookPage() {
  return (
    <main className="pb-16">
      <PageHeader
        eyebrow="Append only"
        title="Log"
        lede="One line per thing that happened. Dated and formatted on the way in, so there is no markdown to type and nothing to get wrong at 11pm."
      />

      <div className="mt-8">
        <Panel title="Today's entry">
          <LogbookForm />
        </Panel>
      </div>
    </main>
  );
}
