"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
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
                "rounded-full border px-3 py-1 font-mono text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground",
              )}
            >
              {c} <span className="tabular opacity-60">{counts[c] ?? 0}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-8 grid gap-px border border-border bg-border sm:grid-cols-2">
        {shown.map((p) => (
          <Link
            key={p.slug}
            href={`/projects/${p.slug}`}
            className="group flex flex-col bg-background p-6 transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
          >
            <div className="flex items-baseline justify-between gap-3">
              <h2
                className={cn(
                  "font-semibold tracking-tight group-hover:text-primary",
                  p.tier === 1 ? "text-lg" : "text-base",
                )}
              >
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
          </Link>
        ))}
      </div>

      {shown.length === 0 && (
        <p className="mt-8 text-sm text-muted-foreground">No projects in this category yet.</p>
      )}
    </>
  );
}
