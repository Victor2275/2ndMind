import { describe, expect, it } from "vitest";

import { publicProjects } from "@/lib/vault/public";

/**
 * Exactly one project leads (V4 items 6.4 and 6.5, Q309, Q330, D-351).
 *
 * `featured` decides two things a stranger sees first: the second call to action in the About
 * hero, and the two-column card at the top of the projects grid. Both are written assuming there
 * is precisely one, and both fail quietly in the two directions this guards:
 *
 *   - **None.** The About hero loses its second CTA and the grid loses its hero card. Nothing
 *     errors; the page is simply less than it was, which is not the kind of thing anyone notices
 *     on their own site.
 *   - **Two.** Two hero cards span two columns each at the top of the grid, which reads as a
 *     layout bug rather than as emphasis.
 *
 * This is a vault-content test rather than a code test, and that is deliberate — the failure it
 * catches is Victor editing frontmatter, not anyone editing TypeScript.
 */
describe("the featured project", () => {
  const projects = publicProjects();

  it("is set on exactly one published project", () => {
    const featured = projects.filter((p) => p.featured);
    expect(
      featured.map((p) => p.slug),
      "set `featured: true` on exactly one project in context/01_engineering/projects/",
    ).toHaveLength(1);
  });

  it("is not a draft", () => {
    // A draft is published but has unwritten sections (Q339 leaves it unmarked). Leading the
    // portfolio with one sends a stranger from the strongest position on the page to the
    // thinnest content on the site.
    const featured = projects.find((p) => p.featured);
    expect(featured?.draft, `${featured?.slug} is a draft and should not lead`).toBe(false);
  });

  it("has the summary and stack the cards render", () => {
    // Both surfaces render these unconditionally. An entry missing either draws an empty card.
    const featured = projects.find((p) => p.featured)!;
    expect(featured.summary.length).toBeGreaterThan(0);
    expect(featured.stack.length).toBeGreaterThan(0);
  });
});
