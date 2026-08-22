import { PageHeader, Panel } from "@/components/site/page-shell";
import { Prose } from "@/components/site/prose";
import { readVaultFileCached } from "@/lib/vault/write";

export const dynamic = "force-dynamic";

const SPRINT = "context/04_operations/current_sprint.md";
const RULES_HEADING = "2. Operational Rules & Boundaries";

/** Pulls one `## Heading` section out of a vault file. `(?![\s\S])` rather than `$`, which
 *  under the `m` flag means end-of-line and would match the empty string. */
function section(content: string, heading: string): string | null {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = content.match(
    new RegExp(
      `^##[ \\t]+${escaped}[ \\t]*\\r?\\n([\\s\\S]*?)(?=\\r?\\n##[ \\t]|(?![\\s\\S]))`,
      "m",
    ),
  );
  return match ? match[1].trim() : null;
}

export default async function CalendarPage() {
  let rules: string | null = null;
  let failure: string | null = null;

  try {
    rules = section((await readVaultFileCached(SPRINT)).content, RULES_HEADING);
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error);
  }

  return (
    <main className="pb-16">
      <PageHeader
        eyebrow="Time"
        title="Calendar"
        lede="Feeds land in feature 4. Until then, the rules that actually shape the week."
      />

      <div className="mt-6 rounded-lg border border-highlight/40 bg-highlight/10 px-4 py-3 text-sm">
        <p className="font-medium text-foreground">Feeds not connected yet.</p>
        <p className="mt-2 text-muted-foreground">
          Classes and assignments arrive in feature 4, read from private iCal URLs that Google
          Calendar and Canvas each publish — no OAuth, no consent screen, no cost. Assignments
          become tasks and show up on Today alongside everything else.
        </p>
        <p className="mt-2 text-muted-foreground">
          Set <code className="font-mono text-xs">GOOGLE_CALENDAR_ICS</code> and{" "}
          <code className="font-mono text-xs">CANVAS_ICS</code> when you have them. Until then,
          the rules that actually shape the week:
        </p>
      </div>

      <div className="mt-6">
        <Panel title="Operating rules">
        {failure ? (
          <p className="text-sm text-muted-foreground">{failure}</p>
        ) : rules ? (
          <Prose>{rules}</Prose>
        ) : (
          <p className="text-sm text-muted-foreground">
            The <code className="font-mono text-xs">{RULES_HEADING}</code> section is missing
            from the sprint file.
          </p>
        )}
        </Panel>
      </div>
    </main>
  );
}
