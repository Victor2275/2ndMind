import Link from "next/link";

import { getLabelledBullet, getFrontmatterField } from "@/lib/vault/frontmatter";
import { GOAL_LABELS } from "@/lib/sprint-goals";
import { readVaultFile, recentCommits } from "@/lib/vault/write";

export const dynamic = "force-dynamic";

/** Days between an ISO date and today. Negative means the date is in the future. */
function daysSince(iso: string): number | null {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return null;
  return Math.floor((Date.now() - then) / 86_400_000);
}

export default async function DashboardPage() {
  const results = await Promise.allSettled([
    readVaultFile("context/04_operations/current_sprint.md"),
    recentCommits(6),
  ]);

  const sprint = results[0].status === "fulfilled" ? results[0].value.content : null;
  const commits = results[1].status === "fulfilled" ? results[1].value : [];
  const failure =
    results[0].status === "rejected"
      ? results[0].reason instanceof Error
        ? results[0].reason.message
        : String(results[0].reason)
      : null;

  const goals = sprint
    ? GOAL_LABELS.map((label) => ({ label, value: getLabelledBullet(sprint, label) ?? "" }))
    : [];

  const updated = sprint ? getFrontmatterField(sprint, "updated") : null;
  const age = updated ? daysSince(updated) : null;
  // The sprint file is `stability: volatile`; CLAUDE.md treats those as suspect past ~14 days.
  const stale = age !== null && age > 14;

  return (
    <main className="py-10">
      <p className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-highlight">
        Second brain
      </p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">Dashboard</h1>

      {failure && (
        <div className="mt-6 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-foreground">
          <p className="font-medium">The vault is unreachable.</p>
          <p className="mt-1 text-muted-foreground">{failure}</p>
        </div>
      )}

      <section className="mt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-lg font-bold tracking-tight">This week</h2>
          <div className="flex items-center gap-3">
            {updated && (
              <span
                className={`tabular font-mono text-[0.68rem] ${
                  stale ? "text-destructive" : "text-muted-foreground"
                }`}
              >
                updated {updated}
                {age !== null && age > 0 ? ` · ${age}d ago` : ""}
              </span>
            )}
            <Link
              href="/private/sprint"
              className="font-mono text-xs text-primary underline-offset-4 hover:underline"
            >
              Edit
            </Link>
          </div>
        </div>

        {stale && (
          <p className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-muted-foreground">
            This file is marked <code>volatile</code> and has not been touched in {age} days.
            Treat what it says as suspect rather than current.
          </p>
        )}

        <dl className="mt-4 grid gap-3 sm:grid-cols-3">
          {goals.map((goal) => (
            <div
              key={goal.label}
              className="rounded-lg border border-border bg-card/70 p-4 transition-colors duration-300 hover:border-primary/50"
            >
              <dt className="font-mono text-[0.58rem] uppercase tracking-[0.14em] text-muted-foreground">
                {goal.label}
              </dt>
              <dd className="mt-2 text-sm text-foreground">
                {goal.value || (
                  <span className="text-muted-foreground italic">Not set for this week.</span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-10 grid gap-4 sm:grid-cols-2">
        <Link
          href="/private/logbook"
          className="card-scan group rounded-lg border border-border bg-card/70 p-5"
        >
          <h2 className="text-base font-semibold transition-colors group-hover:text-primary">
            Log something
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Append a dated entry to the logbook. One line per thing.
          </p>
        </Link>

        <Link
          href="/private/sprint"
          className="card-scan group rounded-lg border border-border bg-card/70 p-5"
        >
          <h2 className="text-base font-semibold transition-colors group-hover:text-primary">
            Set this week&rsquo;s goals
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Three fields, one commit. Replaces the sprint-review ritual.
          </p>
        </Link>
      </section>

      {commits.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-bold tracking-tight">Recent vault activity</h2>
          <ul className="mt-4 divide-y divide-border rounded-lg border border-border bg-card/70">
            {commits.map((commit) => (
              <li key={commit.sha} className="flex flex-wrap items-baseline gap-x-3 px-4 py-2.5">
                <a
                  href={commit.url}
                  className="tabular font-mono text-xs text-primary underline-offset-4 hover:underline"
                >
                  {commit.sha}
                </a>
                <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                  {commit.message}
                </span>
                <span className="tabular font-mono text-[0.65rem] text-muted-foreground">
                  {commit.date.slice(0, 10)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
