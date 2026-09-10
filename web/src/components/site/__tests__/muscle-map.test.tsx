import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MuscleMap, expand } from "@/components/site/muscle-map";
import { CATALOGUE } from "@/lib/athletics/catalogue";
import { MUSCLES, REGIONS, type Muscle } from "@/lib/athletics/muscles";

/**
 * The body map (V4 Phase 2.9, redrawn at reference fidelity in Phase 2++ Stage 1).
 *
 * ## What can and cannot be tested here
 *
 * jsdom does not lay out SVG, so nothing here can say the drawing *looks* right — that is what
 * `/private/kitchen-sink` is for. What is testable is the part that would silently lie: which
 * regions are marked, that every vocabulary name and every catalogue entry can be drawn, that a
 * `full body` tag means the whole figure, and that primary and secondary render as visibly
 * different classes rather than collapsing to one colour.
 */

/** Regions are marked by fill, so the count of highlighted paths is the assertion. */
function litRegions(container: HTMLElement, cls = "fill-primary"): number {
  return container.querySelectorAll(`path.${cls}`).length;
}

/** The same count, split by figure — each is a `<g>` whose `<title>` names it. */
function litOn(container: HTMLElement, cls = "fill-primary"): { front: number; back: number } {
  const count = (label: string) => {
    const title = [...container.querySelectorAll("title")].find((t) => t.textContent === label);
    return title?.parentElement?.querySelectorAll(`path.${cls}`).length ?? -1;
  };
  return { front: count("Front"), back: count("Back") };
}

describe("expand", () => {
  it("turns `full body` into every drawable region", () => {
    const all = expand(["full body"]);
    expect(all.size).toBe(REGIONS.length);
    expect(all.has("full body" as Muscle)).toBe(false);
    expect(all.has("chest")).toBe(true);
    expect(all.has("calves")).toBe(true);
  });

  it("turns the legacy `core` synonym into abs and obliques", () => {
    expect([...expand(["core"])].sort()).toEqual(["abs", "obliques"]);
  });

  it("ignores names that are not in the vocabulary", () => {
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
    expect(container.querySelectorAll("path").length).toBeGreaterThan(40);
  });

  it("marks more paths for two regions than for one", () => {
    const one = render(<MuscleMap muscles={["chest"]} />);
    const two = render(<MuscleMap muscles={["chest", "triceps"]} />);
    expect(litRegions(two.container)).toBeGreaterThan(litRegions(one.container));
  });

  it("puts a region on the figure it belongs to and not the other", () => {
    // Chest has three sub-shapes, each mirrored to both sides of the body.
    expect(litOn(render(<MuscleMap muscles={["chest"]} />).container)).toEqual({
      front: 6,
      back: 0,
    });

    const legs = litOn(render(<MuscleMap muscles={["hamstrings"]} />).container);
    expect(legs.front).toBe(0);
    expect(legs.back).toBeGreaterThan(0);

    // `shoulders` is front-only and `rear delts` is back-only now — the split Stage 1 made to
    // fix the old figure drawing the same deltoid path on both views under one name.
    const front = litOn(render(<MuscleMap muscles={["shoulders"]} />).container);
    expect(front.front).toBeGreaterThan(0);
    expect(front.back).toBe(0);

    const back = litOn(render(<MuscleMap muscles={["rear delts"]} />).container);
    expect(back.front).toBe(0);
    expect(back.back).toBeGreaterThan(0);
  });

  it("lights something for every muscle name in the vocabulary", () => {
    for (const muscle of REGIONS) {
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

describe("primary and secondary", () => {
  it("renders primary and secondary as visibly different classes", () => {
    const { container } = render(<MuscleMap primary={["chest"]} secondary={["triceps"]} />);
    expect(litRegions(container, "fill-primary")).toBeGreaterThan(0);
    expect(litRegions(container, "fill-primary-300")).toBeGreaterThan(0);
  });

  it("falls back to the legacy `muscles` prop as primary, with no secondary", () => {
    const { container } = render(<MuscleMap muscles={["chest"]} />);
    expect(litRegions(container, "fill-primary")).toBeGreaterThan(0);
    expect(litRegions(container, "fill-primary-300")).toBe(0);
  });
});

describe("detail levels", () => {
  it("draws striation seams at full detail and omits them at simple detail", () => {
    const full = render(<MuscleMap muscles={["chest"]} detail="full" />);
    const simple = render(<MuscleMap muscles={["chest"]} detail="simple" />);
    expect(full.container.querySelectorAll("path").length).toBeGreaterThan(
      simple.container.querySelectorAll("path").length,
    );
  });

  it("defaults to simple below 96px and full at or above it", () => {
    const small = render(<MuscleMap muscles={["chest"]} size={40} />);
    const large = render(<MuscleMap muscles={["chest"]} size={132} />);
    expect(large.container.querySelectorAll("path").length).toBeGreaterThan(
      small.container.querySelectorAll("path").length,
    );
  });
});

describe("region taps", () => {
  it("calls onRegionTap with the region tapped", () => {
    const onRegionTap = vi.fn();
    render(<MuscleMap muscles={[]} onRegionTap={onRegionTap} />);
    const chest = screen.getByRole("button", { name: "chest" });
    fireEvent.click(chest);
    expect(onRegionTap).toHaveBeenCalledWith("chest");
  });

  it("is not interactive when no handler is given", () => {
    render(<MuscleMap muscles={[]} />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});

describe("the catalogue it is drawn from", () => {
  it("gives every seeded entry at least one region, except the three that load nothing", () => {
    // Mobility, stretching and foam rolling genuinely load nothing, so a blank figure is the
    // honest picture. Everything else has to light something, or the diagram is silently
    // useless on that exercise.
    const blank = CATALOGUE.filter((entry) => expand(entry.muscles).size === 0).map((e) => e.name);
    expect(blank.sort()).toEqual(["Foam Rolling", "Mobility", "Stretching"]);
  });

  it("uses only names from the vocabulary (including the legacy `core` and `full body`)", () => {
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
