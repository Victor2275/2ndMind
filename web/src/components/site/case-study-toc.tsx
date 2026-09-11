"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * The case-study table of contents, and the reading-progress bar (V4 items 6.6 and 6.9, Q332,
 * Q296).
 *
 * Two features in one component because they are the same measurement. Q296 asks for progress
 * "on case studies only" and Q332 for a persistent desktop TOC; both are answers to the same
 * question — how far down a long page am I — and computing scroll position twice would be two
 * listeners disagreeing by a frame.
 *
 * ## Why `IntersectionObserver` and not scroll maths
 *
 * The active section could be derived from `getBoundingClientRect()` on every scroll event, and
 * that is the version that janks: it forces layout on the main thread at 60fps for a decoration.
 * The observer hands back the same answer from the compositor. The progress bar *does* read
 * scroll position, but only `scrollY` and two cached document heights, none of which force
 * layout.
 *
 * ## Why it hides itself rather than rendering an empty rail
 *
 * A project with one written section gets no TOC at all. Q331 asked for the page to be "clean if
 * someone views it, including hiding missing information", and a table of contents listing one
 * item is an admission that there was meant to be more.
 *
 * Nothing sensitive may appear in this file; it compiles into an unauthenticated client chunk.
 */
export function CaseStudyToc({ sections }: { sections: { id: string; heading: string }[] }) {
  const [active, setActive] = useState<string | null>(sections[0]?.id ?? null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(scrollable > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  useEffect(() => {
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // The topmost section currently intersecting wins. Taking the *last* entry instead is
        // the obvious version and is wrong on a fast scroll, where several sections enter at
        // once and the one that happens to fire last is whichever the browser felt like.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      // A band across the upper third: a section counts as "the one being read" when its
      // heading is near the top of the viewport, not when it first peeks in at the bottom.
      { rootMargin: "-10% 0px -70% 0px", threshold: 0 },
    );

    for (const { id } of sections) {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, [sections]);

  if (sections.length < 2) return null;

  return (
    <>
      {/* Reading progress. Fixed to the very top, above the sticky header, and `aria-hidden`
          because a screen reader gets nothing from a decorative width. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 print:hidden"
      >
        <div
          className="h-full origin-left bg-primary transition-transform duration-fast ease-standard"
          style={{ transform: `scaleX(${progress})` }}
        />
      </div>

      {/* The rail itself. `laptop` up only — below that it would be a second navigation
          competing with the content on a screen that has room for one. */}
      <nav
        aria-label="On this page"
        className="sticky top-24 hidden h-fit w-48 shrink-0 laptop:block print:hidden"
      >
        <p className="eyebrow text-muted-foreground">On this page</p>
        <ul className="mt-3 space-y-1 border-l border-border">
          {sections.map((section) => {
            const on = active === section.id;
            return (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  aria-current={on ? "true" : undefined}
                  className={cn(
                    "-ml-px block border-l py-1.5 pl-3 text-xs transition-colors duration-fast",
                    on
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                  )}
                >
                  {section.heading}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
