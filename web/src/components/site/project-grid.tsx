"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { ProjectFigure } from "@/components/site/project-figure";
import type { ProjectCard } from "@/lib/vault/public";
import { cn } from "@/lib/utils";

type Filter = "all" | ProjectCard["category"];

export function ProjectGrid({ projects }: { projects: ProjectCard[] }) {
  const [filter, setFilter] = useState<Filter>("all");

  const categories = useMemo(
    () => [...new Set(projects.map((p) => p.category))].sort(),
    [projects],
  );
  const shown = filter === "all" ? projects : projects.filter((p) => p.category === filter);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: projects.length };
    for (const p of projects) c[p.category] = (c[p.category] ?? 0) + 1;
    return c;
  }, [projects]);

  return (
    <>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter projects by category">
        {(["all", ...categories] as Filter[]).map((c) => {
          const active = filter === c;
          return (
            <button
              key={c}
              type="button"
              onClick={() => setFilter(c)}
              aria-pressed={active}
              className={cn(
                "rounded-full border px-3.5 py-1.5 font-mono text-xs transition-all duration-250 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                active
                  ? "border-primary bg-primary text-primary-foreground shadow-[0_0_18px_-4px_var(--primary)]"
                  : "border-border text-muted-foreground hover:-translate-y-0.5 hover:border-primary/60 hover:text-foreground",
              )}
            >
              {c} <span className="tabular opacity-60">{counts[c] ?? 0}</span>
            </button>
          );
        })}
      </div>

      {/* Re-keying on the filter restarts the stagger, so switching categories
          replays the reveal instead of swapping content in place. */}
      {/* `items-start`, so a card is as tall as its content.
          The grid stretched rows to equal height, which was invisible while at most one
          project had an image. With four of six carrying one, a card without an image was
          being stretched to match its neighbour and opening ~200px of void above its tags.
          Uneven card heights read as a set; a void reads as a missing image. */}
      <div key={filter} className="mt-8 grid items-start gap-4 sm:grid-cols-2">
        {shown.map((p, i) => (
          <Link
            key={p.slug}
            href={`/projects/${p.slug}`}
            style={{ animationDelay: `${i * 60}ms` }}
            className="rise card-scan group flex flex-col overflow-hidden rounded-lg border border-border bg-card/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {/* Only a real photograph earns a figure.
                Five of six projects have no image, and the generated stand-in was costing
                ~180px each — measured, the projects page ran to 6,150px on a 390px phone,
                most of it decorative charts of nothing. Collapsing them cuts that by more
                than half and, by contrast, gives the one project that *does* have a
                photograph some weight. */}
            {p.image ? (
              <div className="relative aspect-16/9 w-full shrink-0 overflow-hidden border-b border-border bg-background/40">
                <ProjectFigure
                  slug={p.slug}
                  title={p.title}
                  image={p.image}
                  priority={i < 2}
                  className={`transition-transform duration-500 ease-out group-hover:scale-105 ${
                    p.imageFit === "contain" ? "object-contain p-3" : "object-cover"
                  }`}
                />
              </div>
            ) : (
              /* A thin accent rail keeps the grid reading as a set rather than as cards that
                 lost their images. */
              <div
                aria-hidden
                className="h-1 w-full shrink-0 bg-gradient-to-r from-primary/70 via-primary/25 to-transparent"
              />
            )}

            <div className="flex flex-1 flex-col p-5">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-base font-semibold tracking-tight transition-colors group-hover:text-primary">
                {p.title}
              </h2>
              <span className="tabular shrink-0 font-mono text-xs text-muted-foreground">
                {p.year}
              </span>
            </div>

            <p className="mt-2 flex-1 text-sm text-muted-foreground">{p.summary}</p>

            <div className="mt-4 flex flex-wrap items-center gap-1.5">
              <Badge
                variant={p.status === "active" ? "default" : "outline"}
                className="text-[0.65rem]"
              >
                {p.status}
              </Badge>
              {p.stack.slice(0, 3).map((s) => (
                <Badge key={s} variant="secondary" className="text-[0.65rem]">
                  {s}
                </Badge>
              ))}
              {p.stack.length > 3 && (
                <span className="font-mono text-[0.65rem] text-muted-foreground">
                  +{p.stack.length - 3}
                </span>
              )}
            </div>

            {/* Hover-only, so it must not exist at all where hovering does not.
                It was `opacity-0` and still occupied its box on a phone: ~32px of permanently
                invisible space per card, which no touch user could ever resolve into text. */}
            <span
              aria-hidden
              className="mt-4 hidden font-mono text-xs text-primary opacity-0 transition-all duration-300 group-hover:opacity-100 [@media(hover:hover)]:block"
            >
              Read more &rarr;
            </span>
            </div>
          </Link>
        ))}
      </div>

      {shown.length === 0 && (
        <p className="mt-8 text-sm text-muted-foreground">No projects in this category yet.</p>
      )}
    </>
  );
}
