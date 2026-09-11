import Link from "next/link";
import { notFound } from "next/navigation";

import Image from "next/image";

import { ImageLightbox } from "@/components/site/image-lightbox";
import { ProjectFigure } from "@/components/site/project-figure";
import { CaseStudy } from "@/components/site/case-study";
import { CaseStudyToc } from "@/components/site/case-study-toc";
import { ExternalLink } from "@/components/site/external-link";
import { StatusBadge } from "@/components/site/status-badge";
import { hasSystemDiagram, SystemDiagram } from "@/components/site/system-diagram";
import { ProjectUpdates } from "@/components/site/project-updates";
import { Badge } from "@/components/ui/badge";
import { firstSentence, roleFor, sectionId, splitCaseStudy } from "@/lib/vault/case-study";
import { publicProjects } from "@/lib/vault/public";

export function generateStaticParams() {
  return publicProjects().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/projects/[slug]">) {
  const { slug } = await params;
  const project = publicProjects().find((p) => p.slug === slug);
  if (!project) return {};

  // Per-project OG card (Q44). Rendered by `scripts/render-og.mjs` and committed; see that file
  // for why it is not `next/og`, and `lib/__tests__/og.test.ts` for the check that every
  // published project still has one and that its title has not drifted from the vault.
  const image = { url: `/og/project-${project.slug}.png`, width: 1200, height: 630 };

  return {
    title: project.title,
    description: project.summary,
    openGraph: {
      type: "article",
      title: project.title,
      description: project.summary,
      url: `/projects/${project.slug}`,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: project.title,
      description: project.summary,
      images: [image],
    },
  };
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
    { label: "Year", value: String(project.year) },
    { label: "Category", value: project.category },
    ...(project.event ? [{ label: "Built at", value: project.event }] : []),
    ...(project.groupSize ? [{ label: "Team", value: `${project.groupSize} people` }] : []),
  ];

  // The case study is split here as well as inside `CaseStudy`, so the table of contents and the
  // opening summary can be built from the same sections the page renders. Splitting a string
  // twice is cheaper than threading a callback out of a render, and keeps `CaseStudy` a
  // component rather than a component that also returns data.
  const sections = splitCaseStudy(project.body);
  const toc = sections
    .filter((section) => section.role !== null && section.heading)
    .map((section) => ({ id: sectionId(section.heading!), heading: section.heading! }));

  // The opening summary (Q333). Each row is lifted from the section that already says it, and
  // any row whose section is missing or too short to summarise is simply absent — Q331's "clean
  // if someone views it, including hiding missing information".
  const sectionBody = (role: string) =>
    sections.find((s) => s.role === role && s.heading && roleFor(s.heading) === role)?.body ?? "";
  const summary = [
    { label: "Problem", value: firstSentence(sectionBody("problem")) },
    { label: "Approach", value: firstSentence(sectionBody("architecture")) },
    { label: "Result", value: firstSentence(sectionBody("results")) },
  ].filter((row): row is { label: string; value: string } => row.value !== null);

  // Next project in Victor's own order, wrapping at the end (Q336).
  const all = publicProjects();
  const here = all.findIndex((p) => p.slug === project.slug);
  const next = all.length > 1 ? all[(here + 1) % all.length] : null;

  return (
    /* The page is wider than its prose. The article stays at `max-w-3xl` — Q334 keeps the
       reading measure narrow — and the extra width exists only so the table of contents has
       somewhere to sit at `laptop` and up, rather than pushing the text off-centre. */
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-16">
      <div className="mx-auto flex w-full max-w-3xl gap-12 laptop:max-w-none laptop:justify-center">
        <article className="w-full max-w-3xl min-w-0">
          <Link
            href="/projects"
            className="link-wipe font-mono text-xs text-muted-foreground transition-colors hover:text-primary"
          >
            &larr; Projects
          </Link>

          {/* Status, and nothing else. Q339 — a draft is deliberately not marked on the public
              site, so `project.draft` is read here by no one. */}
          <div className="mt-6">
            <StatusBadge status={project.status} />
          </div>

          <h1 className="mt-3 font-heading text-4xl font-extrabold tracking-tight">
            {project.title}
          </h1>
          <p className="mt-3 max-w-[60ch] text-lg text-muted-foreground">{project.summary}</p>

          {/* Repo and demo, at the top (Q340). They were three-quarters of the way down the page,
          below the stack and the highlights — which is the wrong place for the two links an
          engineer reading a case study is most likely to want. */}
          {Object.keys(project.links).length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2.5">
              {Object.entries(project.links).map(([key, href]) => (
                <ExternalLink
                  key={key}
                  href={href}
                  className="rounded-control border border-primary/40 px-3.5 py-1.5 text-sm text-primary transition-colors duration-fast ease-standard hover:border-primary hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {LINK_LABELS[key] ?? key}
                </ExternalLink>
              ))}
            </div>
          )}

          {/* Same rule as the grid: no photograph, no figure. A 16:9 generated placeholder at the
          top of a detail page pushes the actual writing below the fold on a phone for no
          information gain. */}
          {project.image && (
            /* Tap to open full size (Q223). Several of these figures are diagrams — the solenoid
           signal chain, the micromouse maze — whose labels are unreadable inside a 16:9 card at
           this width, and there was no way to see one properly. */
            <ImageLightbox
              src={project.image}
              alt={`${project.title} — figure`}
              className="mt-8 overflow-hidden rounded-card border border-border bg-card/70 transition-colors duration-fast hover:border-primary/60"
            >
              <div className="relative aspect-16/9 w-full">
                <ProjectFigure
                  slug={project.slug}
                  title={project.title}
                  image={project.image}
                  priority
                  className={project.imageFit === "contain" ? "object-contain p-3" : "object-cover"}
                />
              </div>
            </ImageLightbox>
          )}

          <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {meta.map((m) => (
              <div
                key={m.label}
                className="rounded-lg border border-border bg-card/70 p-3 transition-colors duration-300 hover:border-primary/50"
              >
                {/* 0.62rem, matching the identical fact cards on the About page. They were
                0.6rem here for no reason anyone recorded, which made this the only public
                page carrying a fourth label size and the smallest text on the site. */}
                <dt className="eyebrow text-muted-foreground">{m.label}</dt>
                <dd className="mt-1 text-sm text-foreground">{m.value}</dd>
              </div>
            ))}
          </dl>

          <section className="mt-8">
            <h2 className="eyebrow text-muted-foreground">Stack</h2>
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

          {/* The opening summary (Q333). Rows whose section is missing are absent rather than
          empty — Q331. On a project with no case study written yet, this whole block is gone. */}
          {summary.length > 0 && (
            <dl className="mt-12 space-y-3 rounded-card border border-border bg-card/50 p-5 tablet:p-6">
              {summary.map((row) => (
                <div
                  key={row.label}
                  className="tablet:grid tablet:grid-cols-[6rem_1fr] tablet:gap-4"
                >
                  <dt className="eyebrow text-primary">{row.label}</dt>
                  <dd className="mt-1 text-sm leading-relaxed text-foreground tablet:mt-0">
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          )}

          {/* The system diagram (Q224, Q225), above the prose that describes it: a reader who
              takes the picture and leaves has still got the mechanism. A project without one
              renders no heading at all rather than an empty section (Q331). */}
          {hasSystemDiagram(project.slug) && (
            <section className="mt-12">
              <h2 className="font-heading text-lg font-bold tracking-tight">How it works</h2>
              <SystemDiagram slug={project.slug} className="mt-4" />
            </section>
          )}

          <section className="mt-12">
            <CaseStudy>{project.body}</CaseStudy>
          </section>

          {/* The full history, where `/now` shows only the latest two. Rendered here rather than
          left in the body so an update reads the same on both pages. */}
          {project.updates.length > 0 && (
            <section className="mt-12">
              <h2 className="text-lg font-bold tracking-tight">Updates</h2>
              <div className="mt-4 border-l border-border pl-5">
                <ProjectUpdates updates={project.updates} />
              </div>
            </section>
          )}

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

          {/* Next project (Q336). Wraps at the end of the list rather than disappearing — a reader
          who finished the last case study should still have somewhere to go. */}
          {next && (
            <nav className="mt-16 border-t border-border pt-6">
              <Link
                href={`/projects/${next.slug}`}
                className="group -m-2 flex items-baseline justify-between gap-4 rounded-card p-2 transition-colors duration-fast hover:bg-accent/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <span>
                  <span className="block eyebrow text-muted-foreground">Next project</span>
                  <span className="mt-1 block font-heading text-lg font-semibold tracking-tight transition-colors group-hover:text-primary">
                    {next.title}
                  </span>
                </span>
                <span
                  aria-hidden
                  className="text-muted-foreground transition-colors group-hover:text-primary"
                >
                  &rarr;
                </span>
              </Link>
            </nav>
          )}
        </article>

        <CaseStudyToc sections={toc} />
      </div>
    </main>
  );
}
