import Link from "next/link";
import { notFound } from "next/navigation";

import { Prose } from "@/components/site/prose";
import { Badge } from "@/components/ui/badge";
import { publicProjects } from "@/lib/vault/public";

export function generateStaticParams() {
  return publicProjects().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/projects/[slug]">) {
  const { slug } = await params;
  const project = publicProjects().find((p) => p.slug === slug);
  if (!project) return {};
  return { title: project.title, description: project.summary };
}

const LINK_LABELS: Record<string, string> = {
  live: "Live app",
  github: "GitHub",
  itch: "Itch.io",
  org: "Organization",
};

export default async function ProjectPage({ params }: PageProps<"/projects/[slug]">) {
  const { slug } = await params;
  const project = publicProjects().find((p) => p.slug === slug);
  if (!project) notFound();

  const meta = [
    { label: "Status", value: project.status },
    { label: "Year", value: String(project.year) },
    { label: "Category", value: project.category },
    ...(project.event ? [{ label: "Built at", value: project.event }] : []),
  ];

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
      <Link
        href="/projects"
        className="font-mono text-xs text-muted-foreground transition-colors hover:text-primary"
      >
        &larr; Projects
      </Link>

      <h1 className="mt-6 text-4xl font-extrabold tracking-tight">{project.title}</h1>
      <p className="mt-3 max-w-[60ch] text-muted-foreground">{project.summary}</p>

      <dl className="mt-8 grid grid-cols-2 gap-px border border-border bg-border sm:grid-cols-4">
        {meta.map((m) => (
          <div key={m.label} className="bg-background p-3">
            <dt className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground">
              {m.label}
            </dt>
            <dd className="mt-1 text-sm text-foreground">{m.value}</dd>
          </div>
        ))}
      </dl>

      <section className="mt-8">
        <h2 className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-foreground">
          Stack
        </h2>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {project.stack.map((s) => (
            <Badge key={s} variant="secondary" className="text-[0.7rem]">
              {s}
            </Badge>
          ))}
          {project.tags.map((t) => (
            <Badge key={t} variant="outline" className="text-[0.7rem]">
              {t}
            </Badge>
          ))}
        </div>
      </section>

      {Object.keys(project.links).length > 0 && (
        <section className="mt-8 flex flex-wrap gap-3">
          {Object.entries(project.links).map(([key, href]) => (
            <a
              key={key}
              href={href}
              className="rounded border border-primary/40 px-3 py-1.5 text-sm text-primary transition-colors hover:border-primary hover:bg-primary/10"
            >
              {LINK_LABELS[key] ?? key} &rarr;
            </a>
          ))}
        </section>
      )}

      {project.bullets.length > 0 && (
        <section className="mt-12">
          <h2 className="text-lg font-bold tracking-tight">Highlights</h2>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            {project.bullets.map((b) => (
              <li
                key={b}
                className="relative pl-4 before:absolute before:left-0 before:text-primary/60 before:content-['—']"
              >
                {b}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-12">
        <Prose>{project.body}</Prose>
      </section>
    </main>
  );
}
