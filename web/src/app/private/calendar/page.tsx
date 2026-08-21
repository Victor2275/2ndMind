import { Prose } from "@/components/site/prose";
import { readVaultFile } from "@/lib/vault/write";

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
    rules = section((await readVaultFile(SPRINT)).content, RULES_HEADING);
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error);
  }

  return (
    <main className="py-10">
      <p className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-highlight">
        Time
      </p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">Calendar</h1>

      <div className="mt-6 rounded-md border border-highlight/40 bg-highlight/10 px-4 py-3 text-sm">
        <p className="font-medium text-foreground">No live sync in V1 — on purpose.</p>
        <p className="mt-2 text-muted-foreground">
          Reading Google Calendar needs an OAuth consent screen that Google must review before
          it works for anything beyond a test account, plus refresh-token storage and a
          rotation story. That is days of work for a read-only view of an app already open in
          another tab, and it would be the only part of 2ndMind that could lock itself out
          without warning.
        </p>
        <p className="mt-2 text-muted-foreground">
          What is here instead: the rules that actually shape the week, where they can be read
          without opening the vault.
        </p>
      </div>

      <section className="mt-8 rounded-lg border border-border bg-card/70 p-5">
        <h2 className="mb-4 text-lg font-bold tracking-tight">Operating rules</h2>
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
      </section>
    </main>
  );
}
