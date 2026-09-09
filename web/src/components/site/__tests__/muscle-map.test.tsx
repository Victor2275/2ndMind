import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MuscleMap, expand } from "@/components/site/muscle-map";
import { CATALOGUE, MUSCLES, type Muscle } from "@/lib/athletics/catalogue";

/**
 * The body map (V4 Phase 2.9).
 *
 * ## What can and cannot be tested here
 *
 * jsdom does not lay out SVG, so nothing here can say the drawing *looks* right — that is what
 * `/private/kitchen-sink` is for, and it is why the six cases on that page were chosen to be
 * the ones that go wrong. What is testable is the part that would silently lie: which regions
 * are marked, that every catalogue entry can be drawn, and that a `full body` tag means the
 * whole figure rather than a region nobody defined.
 */

/** Regions are marked by fill, so the count of highlighted paths is the assertion. */
function litRegions(container: HTMLElement): number {
  return container.querySelectorAll("path.fill-primary").length;
}

/** The same count, split by figure — each is a `<g>` whose `<title>` names it. */
function litOn(container: HTMLElement): { front: number; back: number } {
  const count = (label: string) => {
    const title = [...container.querySelectorAll("title")].find((t) => t.textContent === label);
    return title?.parentElement?.querySelectorAll("path.fill-primary").length ?? -1;
  };
  return { front: count("Front"), back: count("Back") };
}

describe("expand", () => {
  it("turns `full body` into every region", () => {
    const all = expand(["full body"]);
    // Every name except the sentinel itself, which is not a place on the body.
    expect(all.size).toBe(MUSCLES.length - 1);
    expect(all.has("full body" as Muscle)).toBe(false);
    expect(all.has("chest")).toBe(true);
    expect(all.has("calves")).toBe(true);
  });

  it("ignores names that are not in the vocabulary", () => {
    // The AI-add path and hand-typed entries can put anything in this column. A diagram is not
    // the place to discover it, so an unknown name is dropped rather than thrown on.
    expect([...expand(["chest", "pecs", "", "biceps"])]).toEqual(["chest", "biceps"]);
  });

  it("keeps a plain list as it is", () => {
    expect([...expand(["hamstrings", "glutes"])]).toEqual(["hamstrings", "glutes"]);
  });
});

describe("the drawing", () => {
  it("marks nothing when nothing is worked", () => {
    const { container } = render(<MuscleMap muscles={[]} />);
    expect(litRegions(container)).toBe(0);
    // The body is still drawn. A diagram that renders an empty box for stretching would read
    // as broken rather than as "nothing is loaded here".
    expect(container.querySelectorAll("path").length).toBeGreaterThan(20);
  });

  it("marks more paths for two regions than for one", () => {
    const one = render(<MuscleMap muscles={["chest"]} />);
    const two = render(<MuscleMap muscles={["chest", "triceps"]} />);
    expect(litRegions(two.container)).toBeGreaterThan(litRegions(one.container));
  });

  it("puts a region on the figure it belongs to and not the other", () => {
    // The property that makes a back-only tag visible at all. A bench press must light the front
    // and a deadlift the back; a diagram that lit both would be saying nothing.
    expect(litOn(render(<MuscleMap muscles={["chest"]} />).container)).toEqual({
      front: 4,
      back: 0,
    });

    const legs = litOn(render(<MuscleMap muscles={["hamstrings"]} />).container);
    expect(legs.front).toBe(0);
    expect(legs.back).toBeGreaterThan(0);

    // And a region that really is on both is on both.
    const delts = litOn(render(<MuscleMap muscles={["shoulders"]} />).container);
    expect(delts.front).toBeGreaterThan(0);
    expect(delts.back).toBeGreaterThan(0);
  });

  it("lights something for every muscle name in the vocabulary", () => {
    // The guard against a name that exists in `MUSCLES` and in the catalogue but was never given
    // a shape — which renders as an exercise whose diagram is simply blank, with no error.
    for (const muscle of MUSCLES) {
      const { container } = render(<MuscleMap muscles={[muscle]} />);
      expect(litRegions(container), `${muscle} lights no region on either figure`).toBeGreaterThan(
        0,
      );
    }
  });

  it("names the marked regions in its label, for a screen reader", () => {
    render(<MuscleMap muscles={["chest", "triceps"]} />);
    const label = screen.getByRole("img").getAttribute("aria-label");
    expect(label).toContain("chest");
    expect(label).toContain("triceps");
  });

  it("says so when nothing is marked", () => {
    render(<MuscleMap muscles={[]} />);
    expect(screen.getByRole("img").getAttribute("aria-label")).toContain("no muscle group");
  });
});

describe("the catalogue it is drawn from", () => {
  it("gives every seeded entry at least one region, except the three that load nothing", () => {
    // Mobility, stretching and foam rolling genuinely load nothing, so a blank figure is the
    // honest picture. Everything else — including erg pieces, which were empty until 2.9 — has
    // to light something, or the diagram is silently useless on that exercise.
    const blank = CATALOGUE.filter((entry) => expand(entry.muscles).size === 0).map((e) => e.name);
    expect(blank.sort()).toEqual(["Foam Rolling", "Mobility", "Stretching"]);
  });

  it("uses only names from the closed vocabulary", () => {
    const known = new Set<string>(MUSCLES);
    for (const entry of CATALOGUE) {
      for (const muscle of entry.muscles) {
        expect(known.has(muscle), `${entry.name} claims "${muscle}", which is not in MUSCLES`).toBe(
          true,
        );
      }
    }
  });
});
