import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProjectGrid, parseSort, SORT_KEYS } from "@/components/site/project-grid";
import type { ProjectCard } from "@/lib/vault/public";

/**
 * The grid's filter and sort are URL state now (V4 item 6.5, Q324, D-354), which is what makes
 * this testable without a browser: the component is a pure function of its props.
 */
function card(over: Partial<ProjectCard> = {}): ProjectCard {
  return {
    slug: "a",
    title: "A",
    summary: "s",
    order: 1,
    status: "done",
    year: 2024,
    category: "software",
    stack: ["TS"],
    imageFit: "cover",
    draft: false,
    featured: false,
    ...over,
  };
}

const PROJECTS: ProjectCard[] = [
  card({ slug: "old-robot", title: "Zeta", order: 1, year: 2021, category: "robotics" }),
  card({
    slug: "hero",
    title: "Alpha",
    order: 2,
    year: 2023,
    category: "hardware",
    featured: true,
  }),
  card({ slug: "newest", title: "Mid", order: 3, year: 2026, category: "software" }),
];

const slugs = () =>
  screen
    .getAllByRole("link")
    .map((a) => a.getAttribute("href"))
    .filter((h): h is string => !!h && h.startsWith("/projects/"))
    .map((h) => h.replace("/projects/", ""));

describe("parseSort", () => {
  it("accepts the sorts that exist", () => {
    for (const key of SORT_KEYS) expect(parseSort(key)).toBe(key);
  });

  it("falls back to the curated order for anything else", () => {
    // A query string is user input and arrives from links people paste. An unknown value must
    // land on a real sort rather than indexing into `undefined` and throwing the page away.
    expect(parseSort(undefined)).toBe("featured");
    expect(parseSort("")).toBe("featured");
    expect(parseSort("../../etc/passwd")).toBe("featured");
    expect(parseSort("constructor")).toBe("featured");
  });
});

describe("filtering", () => {
  it("shows everything by default", () => {
    render(<ProjectGrid projects={PROJECTS} />);
    expect(slugs()).toHaveLength(3);
  });

  it("narrows to one category", () => {
    render(<ProjectGrid projects={PROJECTS} category="robotics" />);
    expect(slugs()).toEqual(["old-robot"]);
  });

  it("ignores a category that does not exist rather than showing nothing", () => {
    // Same reasoning as `parseSort`. A stale or hand-edited link should show the full grid, not
    // an empty page that looks like the portfolio has no projects.
    render(<ProjectGrid projects={PROJECTS} category="underwater-basketweaving" />);
    expect(slugs()).toHaveLength(3);
  });

  it("keeps filter and sort together in every link it builds", () => {
    render(<ProjectGrid projects={PROJECTS} category="robotics" sort="name" />);
    const sortGroup = screen.getByRole("group", { name: "Sort projects" });
    // Choosing a different sort must not silently drop the category the reader chose.
    const newest = within(sortGroup).getByRole("link", { name: "Newest" });
    expect(newest.getAttribute("href")).toBe("/projects?category=robotics&sort=newest");
  });

  it("drops defaults from the query string", () => {
    render(<ProjectGrid projects={PROJECTS} category="robotics" sort="name" />);
    const filters = screen.getByRole("group", { name: "Filter projects by category" });
    expect(within(filters).getByRole("link", { name: /^all/ }).getAttribute("href")).toBe(
      "/projects?sort=name",
    );
  });
});

describe("sorting", () => {
  it("uses Victor's own order by default", () => {
    render(<ProjectGrid projects={PROJECTS} />);
    expect(slugs()).toEqual(["hero", "old-robot", "newest"]);
  });

  it("puts the most recent first for Newest", () => {
    render(<ProjectGrid projects={PROJECTS} sort="newest" />);
    expect(slugs()).toEqual(["newest", "hero", "old-robot"]);
  });

  it("sorts by title for A–Z", () => {
    render(<ProjectGrid projects={PROJECTS} sort="name" />);
    expect(slugs()).toEqual(["hero", "newest", "old-robot"]);
  });
});

describe("the hero card", () => {
  it("leads the curated order", () => {
    render(<ProjectGrid projects={PROJECTS} />);
    expect(screen.getByText("Featured")).toBeInTheDocument();
    expect(slugs()[0]).toBe("hero");
  });

  it("is not pinned above an explicit sort", () => {
    // The point of a sort control is that the first item means something. Pinning a project above
    // "Newest" would quietly break the thing the reader just asked for.
    render(<ProjectGrid projects={PROJECTS} sort="newest" />);
    expect(screen.queryByText("Featured")).not.toBeInTheDocument();
    expect(slugs()[0]).toBe("newest");
  });

  it("is not rendered twice", () => {
    // The failure this guards: the hero is pulled out of the list to be rendered first, and the
    // list it came from is not filtered, so the featured project appears as both.
    render(<ProjectGrid projects={PROJECTS} />);
    expect(slugs().filter((s) => s === "hero")).toHaveLength(1);
  });

  it("disappears with its category rather than leaking into a filtered view", () => {
    render(<ProjectGrid projects={PROJECTS} category="software" />);
    expect(screen.queryByText("Featured")).not.toBeInTheDocument();
    expect(slugs()).toEqual(["newest"]);
  });
});
