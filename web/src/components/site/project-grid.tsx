import Link from "next/link";

import { ProjectFigure } from "@/components/site/project-figure";
import { StatusBadge } from "@/components/site/status-badge";
import { Badge } from "@/components/ui/badge";
import type { ProjectCard } from "@/lib/vault/public";
import { cn } from "@/lib/utils";

/**
 * The projects grid (V4 item 6.5, Q322–Q330).
 *
 * ## It is not a Client Component any more
 *
 * The filter was `useState`, which is why this file carried `"use client"` and why a filtered
 * view could not be linked to (Q324: _"currently it is not — a filtered view cannot be linked"_).
 * Filter and sort are URL state now, the controls are `<Link>`s, and nothing here needs a
 * browser. That also settles V4 item 7.2, which asks for exactly this boundary to be dropped
 * "now the filter is URL state" — it was scheduled for Phase 7 because the filter was expected to
 * stay stateful, and the two changes turned out to be the same change.
 *
 * What that buys beyond the link: the whole grid stops being serialised into the RSC payload and
 * shipped to the browser as props, and a filtered view is now a real, crawlable, shareable URL.
 */

const SORTS = {
  /** Victor's own `order` field (D-107). The editorial sequence, and the default. */
  featured: { label: "Curated", compare: (a: ProjectCard, b: ProjectCard) => a.order - b.order },
  newest: {
    label: "Newest",
    compare: (a: ProjectCard, b: ProjectCard) => b.year - a.year || a.order - b.order,
  },
  name: {
    label: "A–Z",
    compare: (a: ProjectCard, b: ProjectCard) => a.title.localeCompare(b.title),
  },
} as const;

export type SortKey = keyof typeof SORTS;
export const SORT_KEYS = Object.keys(SORTS) as SortKey[];

/**
 * Narrows an arbitrary query string to a sort this component actually has.
 *
 * `Object.hasOwn`, not `in`. `in` walks the prototype chain, so `?sort=constructor` passed the
 * check and resolved `SORTS[sort]` to `Object` — whose `.compare` is `undefined`, which
 * `Array.prototype.sort` silently accepts as "sort lexicographically", and whose `.label` renders
 * as nothing. A query string is user input that arrives from pasted links; it gets an
 * own-property check. Found by a test, not by a page that looked broken.
 */
export function parseSort(value: string | undefined): SortKey {
  return value && Object.hasOwn(SORTS, value) ? (value as SortKey) : "featured";
}

/** A query string with one key changed and empty defaults dropped, so URLs stay clean. */
function href(current: { category: string; sort: SortKey }, patch: Partial<typeof current>) {
  const next = { ...current, ...patch };
  const params = new URLSearchParams();
  if (next.category !== "all") params.set("category", next.category);
  if (next.sort !== "featured") params.set("sort", next.sort);
  const query = params.toString();
  return query ? `/projects?${query}` : "/projects";
}

export function ProjectGrid({
  projects,
  category = "all",
  sort = "featured",
}: {
  projects: ProjectCard[];
  category?: string;
  sort?: SortKey;
}) {
  const categories = [...new Set(projects.map((p) => p.category))].sort();
  const valid = category === "all" || categories.includes(category as ProjectCard["category"]);
  const active = valid ? category : "all";

  const counts: Record<string, number> = { all: projects.length };
  for (const p of projects) counts[p.category] = (counts[p.category] ?? 0) + 1;

  const matching = active === "all" ? projects : projects.filter((p) => p.category === active);
  const shown = [...matching].sort(SORTS[sort].compare);

  // The hero card (Q330) leads only the curated order. Pinning a project above an explicit
  // "Newest" or "A–Z" sort would silently break the thing the reader just asked for — the whole
  // point of a sort control is that the first item means something.
  const hero = sort === "featured" ? shown.find((p) => p.featured) : undefined;
  const rest = hero ? shown.filter((p) => p.slug !== hero.slug) : shown;

  const current = { category: active, sort };

  return (
    <>
      <div className="flex flex-col gap-4 tablet:flex-row tablet:items-center tablet:justify-between">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter projects by category">
          {(["all", ...categories] as string[]).map((c) => {
            const on = active === c;
            return (
              <Link
                key={c}
                href={href(current, { category: c })}
                scroll={false}
                aria-current={on ? "true" : undefined}
                className={cn(
                  "rounded-pill border px-3.5 py-1.5 font-mono text-xs transition-colors duration-fast ease-standard focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  on
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:border-primary/60 hover:text-foreground",
                )}
              >
                {c} <span className="tabular opacity-60">{counts[c] ?? 0}</span>
              </Link>
            );
          })}
        </div>

        {/* Sorting (Q325). Three links rather than a `<select>`: a native select on a phone opens
            a full-height wheel for three options, and each of these is a URL worth having. */}
        <div className="flex items-center gap-1" role="group" aria-label="Sort projects">
          <span className="mr-1 eyebrow text-muted-foreground">Sort</span>
          {SORT_KEYS.map((key) => {
            const on = sort === key;
            return (
              <Link
                key={key}
                href={href(current, { sort: key })}
                scroll={false}
                aria-current={on ? "true" : undefined}
                className={cn(
                  "rounded-control px-2.5 py-1.5 font-mono text-xs transition-colors duration-fast ease-standard focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  on
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                )}
              >
                {SORTS[key].label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* `items-start`, so a card is as tall as its content (Q329 keeps them unequal). The grid
          stretched rows to equal height, which was invisible while at most one project had an
          image; with several carrying one, a card without an image was stretched to match its
          neighbour and opened ~200px of void above its tags. Uneven heights read as a set; a void
          reads as a missing image.

          Three columns from `desktop` (1280px) up — Q325's companion ask. */}
      <div
        key={`${active}-${sort}`}
        className="mt-8 grid rise-stagger items-start gap-4 phone:grid-cols-2 desktop:grid-cols-3"
      >
        {hero && <ProjectTile project={hero} hero priority />}
        {rest.map((p, i) => (
          <ProjectTile key={p.slug} project={p} priority={!hero && i < 2} />
        ))}
      </div>

      {shown.length === 0 && (
        <p className="mt-8 text-sm text-muted-foreground">No projects in this category yet.</p>
      )}
    </>
  );
}

/**
 * One card.
 *
 * `hero` spans two columns and gives the figure and the summary more room (Q330). It is the same
 * component rather than a second one on purpose: two card implementations is how a restyle ends
 * up applied to one of them.
 */
function ProjectTile({
  project: p,
  hero = false,
  priority = false,
}: {
  project: ProjectCard;
  hero?: boolean;
  priority?: boolean;
}) {
  return (
    <Link
      href={`/projects/${p.slug}`}
      className={cn(
        // Q328 — the whole card is obviously clickable. It was a bordered panel with a
        // hover-only "Read more →" inside it, which on a touch screen is a panel with no
        // affordance at all. The border lifts to the accent on hover *and* on focus, and the
        // title carries the same change, so the target reads as one thing.
        "group card-scan flex flex-col overflow-hidden rounded-card border border-border bg-card/70 transition-colors duration-fast ease-standard hover:border-primary/60 focus-visible:border-primary/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        hero && "phone:col-span-2",
      )}
    >
      {p.image ? (
        <div
          className={cn(
            "relative w-full shrink-0 overflow-hidden border-b border-border bg-background/40",
            hero ? "aspect-16/9 phone:aspect-21/9" : "aspect-16/9",
          )}
        >
          <ProjectFigure
            slug={p.slug}
            title={p.title}
            image={p.image}
            priority={priority}
            className={cn(
              "transition-transform duration-slow ease-standard group-hover:scale-105",
              p.imageFit === "contain" ? "object-contain p-3" : "object-cover",
            )}
          />
        </div>
      ) : (
        /* A thin accent rail keeps the grid reading as a set rather than as cards that lost
           their images (Q216 — "keep the rail; it is honest"). */
        <div
          aria-hidden
          className="h-1 w-full shrink-0 bg-gradient-to-r from-primary/70 via-primary/25 to-transparent"
        />
      )}

      <div className={cn("flex flex-1 flex-col p-5", hero && "phone:p-6")}>
        {hero && <p className="mb-2 eyebrow text-primary">Featured</p>}
        <div className="flex items-baseline justify-between gap-3">
          <h2
            className={cn(
              "font-heading font-semibold tracking-tight transition-colors duration-fast group-hover:text-primary",
              hero ? "text-lg phone:text-xl" : "text-base",
            )}
          >
            {p.title}
          </h2>
          <span className="tabular shrink-0 font-mono text-xs text-muted-foreground">{p.year}</span>
        </div>

        <p className={cn("mt-2 flex-1 text-sm text-muted-foreground", hero && "max-w-[60ch]")}>
          {p.summary}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          <StatusBadge status={p.status} />
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
      </div>
    </Link>
  );
}
