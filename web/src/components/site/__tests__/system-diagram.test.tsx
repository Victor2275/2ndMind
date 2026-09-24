import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { hasSystemDiagram, SystemDiagram } from "@/components/site/system-diagram";
import { publicProjects } from "@/lib/vault/public";

/**
 * The hand-authored system diagrams (V4 item 6.7, Q224, Q225, D-362).
 *
 * jsdom cannot lay out an SVG, so nothing here says a diagram *looks* right — that was checked in
 * a browser at 1440px, and the four drawings were reworked twice on the strength of it. What is
 * testable is the contract around them: they exist for the projects that were chosen, they are
 * themed rather than hard-coded, they carry a text alternative, and an undrawn project renders
 * nothing at all rather than an empty figure.
 */

/** The four Victor chose. */
const DRAWN = ["solenoid-bit-reader", "proof", "micromouse-simulator", "taskable"];

describe("which projects have one", () => {
  it("covers exactly the four that were chosen", () => {
    for (const slug of DRAWN) {
      expect(hasSystemDiagram(slug), `${slug} should have a diagram`).toBe(true);
    }
  });

  it("does not claim one for the Dimaag paper", () => {
    // Deliberate and worth a test rather than a comment. A system diagram of that work would
    // cross the `confidential_scope` boundary in experience/dimaag.md, which holds the paper's
    // technical specifics internal until Dimaag clears them.
    expect(hasSystemDiagram("dimaag-paper")).toBe(false);
  });

  it("names only slugs that exist in the vault", () => {
    // The failure this catches: a project is renamed, the diagram keeps the old slug, and the
    // page silently stops rendering a figure nobody notices is missing.
    const real = new Set(publicProjects().map((p) => p.slug));
    for (const slug of DRAWN) {
      expect(real.has(slug), `${slug} is not a published project any more`).toBe(true);
    }
  });

  it("renders nothing for a project without one", () => {
    const { container } = render(<SystemDiagram slug="five-second-rule" />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("each diagram", () => {
  for (const slug of DRAWN) {
    describe(slug, () => {
      it("carries a text alternative, not just a picture", () => {
        // A diagram is the densest thing on the page and the only one that cannot be read aloud
        // from its own markup. Every one has a <title> and a <desc> that states the mechanism.
        render(<SystemDiagram slug={slug} />);
        const figure = screen.getByRole("img");
        expect(figure).toHaveAccessibleName();
        expect(figure).toHaveAccessibleDescription();
      });

      it("is scrollable and reachable without a pointer", () => {
        // It keeps its natural width rather than shrinking to unreadability, so the container
        // scrolls — and a scrollable region has to be focusable or a keyboard cannot pan it.
        render(<SystemDiagram slug={slug} />);
        const group = screen.getByRole("group");
        expect(group).toHaveAttribute("tabindex", "0");
        expect(group.className).toContain("overflow-x-auto");
      });

      it("is themed, with no colour of its own", () => {
        // Q225 asked for CSS variables specifically, so one drawing is correct in all five themes
        // and in print. A hex here would also fail `no-raw-hex.test.ts`, but this says why.
        const { container } = render(<SystemDiagram slug={slug} />);
        const markup = container.innerHTML;
        expect(markup).toContain("var(--");
        expect(markup).not.toMatch(/(?:fill|stroke)="#[0-9a-f]{3,8}"/i);
      });
    });
  }
});
