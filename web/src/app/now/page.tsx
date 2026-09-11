import Link from "next/link";

import { ProjectUpdates, formatUpdateDate } from "@/components/site/project-updates";
import { Badge } from "@/components/ui/badge";
import { publicProjects } from "@/lib/vault/public";

/**
 * `/now` — what Victor is actually working on.
 *
 * A project appears here because its frontmatter says `status: active`, not because it was
 * added to a second list. The schema has carried `status` since the beginning, so this page
 * cannot drift from `/projects`: a project cannot be finished on one page and in progress on
 * the other. A separate list would buy the ability to show motion on things that will never
 * be portfolio projects, and can be added later without moving any of this.
 *
 * `/now` is an established convention and reads as current, which is the whole signal the
 * page exists to carry — a "Projects" list says what was built, not what is being built.
 */

export const metadata = {
  title: "Now",
  description: "What Victor Gusev is working on at the moment.",
};

export default function NowPage() {
  // Drafts included, deliberately. `draft` marks the *case study* as scaffolding, not the
  // project — the summary and any updates are real prose. Excluding them would hide the most
  // actively-in-progress work from the page whose entire subject is work in progress, which
  // is how this page first rendered with one project on it instead of two.
  const active = publicProjects()
    .filter((p) => p.status === "active")
    // Most recently updated first: the page is about motion, so the thing that moved last
    // belongs at the top. Projects with no updates sort below those that have them rather
    // than jumping to the front on an empty string.
    .sort((a, b) => (b.updates[0]?.date ?? "").localeCompare(a.updates[0]?.date ?? ""));

  // The single most recent update across every active project, with the project it belongs to
  // (Q343). `active` is already sorted by recency, so the head of the list owns it.
  const lead = active[0]?.updates[0] ? { project: active[0], update: active[0].updates[0] } : null;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-20">
      <h1 className="font-heading text-4xl font-extrabold tracking-tight">Now</h1>
      <p className="mt-3 max-w-[60ch] text-muted-foreground">
        What I am working on at the moment.
        {lead ? ` Last update ${formatUpdateDate(lead.update.date)}.` : ""}
      </p>

      {/* Q343 — the page leads with the newest thing on it, named and quoted, rather than
          making a reader scan three project sections to find what moved last. The same update
          still appears in its project's own list below; that repetition is the point of a lead. */}
      {lead && (
        <section className="mt-12 rounded-card border border-primary/25 bg-primary/[0.05] p-6 tablet:p-7">
          <p className="eyebrow text-primary">Latest</p>
          <h2 className="mt-2 font-heading text-xl font-bold tracking-tight">
            <Link
              href={`/projects/${lead.project.slug}`}
              className="link-wipe transition-colors hover:text-primary"
            >
              {lead.project.title}
            </Link>
          </h2>
          <div className="mt-4 border-l border-primary/30 pl-5">
            <ProjectUpdates updates={[lead.update]} />
          </div>
        </section>
      )}

      {active.length === 0 ? (
        // Deliberate rather than empty: a bare page reads as broken, and "nothing active" is
        // a real and temporarily-true state — between terms, mid-move — not a failure.
        <p className="mt-10 rounded-md border border-border bg-card/40 px-4 py-6 text-sm text-muted-foreground">
          Nothing active at the moment. Everything I have built is on{" "}
          <Link href="/projects" className="link-wipe text-foreground hover:text-primary">
            Projects
          </Link>
          .
        </p>
      ) : (
        <div className="mt-16 space-y-20">
          {active.map((project) => (
            <section key={project.slug}>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 className="font-heading text-xl font-bold tracking-tight">
                  <Link href={`/projects/${project.slug}`} className="link-wipe hover:text-primary">
                    {project.title}
                  </Link>
                </h2>
                <Badge>{project.category}</Badge>
              </div>

              <p className="mt-2 max-w-[60ch] text-sm text-muted-foreground">{project.summary}</p>

              {project.updates.length > 0 ? (
                <div className="mt-6 border-l border-border pl-5">
                  {/* Two, not all: this page is a status board. The full history lives on the
                      project page, which is one click away and linked from the title. */}
                  <ProjectUpdates updates={project.updates} limit={2} />
                  {project.updates.length > 2 && (
                    <Link
                      href={`/projects/${project.slug}`}
                      className="link-wipe mt-4 inline-block font-mono text-xs text-muted-foreground hover:text-primary"
                    >
                      {project.updates.length - 2} earlier update
                      {project.updates.length - 2 === 1 ? "" : "s"} &rarr;
                    </Link>
                  )}
                </div>
              ) : // Nothing rendered. A project with no dated updates yet shows its summary
              // and stops there, rather than captioning its own emptiness.
              null}
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
