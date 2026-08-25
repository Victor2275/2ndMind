import Link from "next/link";
import { notFound } from "next/navigation";

import Image from "next/image";

import { ProjectFigure } from "@/components/site/project-figure";
import { CaseStudy } from "@/components/site/case-study";
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
    ...(project.groupSize ? [{ label: "Team", value: `${project.groupSize} people` }] : []),
  ];

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
      <Link
        href="/projects"
        className="link-wipe font-mono text-xs text-muted-foreground transition-colors hover:text-primary"
      >
        &larr; Projects
      </Link>

      <h1 className="mt-6 text-4xl font-extrabold tracking-tight">{project.title}</h1>
      <p className="mt-3 max-w-[60ch] text-muted-foreground">{project.summary}</p>

      {project.draft && (
        <p className="mt-6 rounded-md border border-secondary/40 bg-secondary/10 px-4 py-3 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Write-up pending.</span> This build is
          real; the description below is scaffolding and will be replaced.
        </p>
      )}

      {/* Same rule as the grid: no photograph, no figure. A 16:9 generated placeholder at the
          top of a detail page pushes the actual writing below the fold on a phone for no
          information gain. */}
      {project.image && (
        <div className="relative mt-8 aspect-16/9 w-full overflow-hidden rounded-lg border border-border bg-card/70">
          <ProjectFigure
            slug={project.slug}
            title={project.title}
            image={project.image}
            priority
            className={
              project.imageFit === "contain" ? "object-contain p-3" : "object-cover"
            }
          />
        </div>
      )}

      <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {meta.map((m) => (
          <div
            key={m.label}
            className="rounded-lg border border-border bg-card/70 p-3 transition-colors duration-300 hover:border-primary/50"
          >
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
              className="rounded-md border border-primary/40 px-3.5 py-1.5 text-sm text-primary transition-all duration-300 hover:-translate-y-0.5 hover:border-primary hover:bg-primary/10 hover:shadow-[0_0_20px_-6px_var(--primary)]"
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
        <CaseStudy>{project.body}</CaseStudy>
      </section>

      {project.figures.length > 1 && (
        <section className="mt-12">
          <h2 className="text-lg font-bold tracking-tight">Figures</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {project.figures.map((file, i) => (
              <figure key={file} className="space-y-1.5">
                <div className="group/fig relative aspect-4/3 overflow-hidden rounded-md border border-border bg-background/60 transition-colors duration-300 hover:border-primary/60">
                  <Image
                    src={file}
                    alt={`${project.title}, figure ${i + 1}`}
                    fill
                    sizes="(max-width: 640px) 50vw, 240px"
                    className="object-contain p-1.5 transition-transform duration-500 ease-out group-hover/fig:scale-110"
                    loading={i < 3 ? "eager" : "lazy"}
                  />
                </div>
                <figcaption className="tabular font-mono text-[0.62rem] text-muted-foreground">
                  Fig. {i + 1}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
