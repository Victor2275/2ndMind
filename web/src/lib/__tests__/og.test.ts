// @vitest-environment node
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { POSITIONING } from "@/lib/profile-copy";
import { publicProjects } from "@/lib/vault/public";

const root = process.cwd();
const ogDir = path.join(root, "public/og");

type Card = { file: string; slug: string | null; title: string };
const manifest: Card[] = JSON.parse(fs.readFileSync(path.join(ogDir, "manifest.json"), "utf8"));

/**
 * The OG cards are committed, so this is the test that keeps them honest (D-218).
 *
 * `scripts/render-og.mjs` renders them with Playwright rather than `next/og` — satori cannot read
 * WOFF2 and every face this site owns is WOFF2, so the alternative was a card set in Geist, which
 * appears nowhere else here. The cost of that choice is that a rendered image can fall behind the
 * vault, and nothing about a stale PNG is visible from inside the app.
 *
 * So the renderer writes down what it drew, and these compare that against the site's own loader.
 * Both directions matter: a project added without re-rendering has no card, and a project removed
 * without re-rendering leaves one behind that still ships.
 */
describe("every published project has a current card", () => {
  const projects = publicProjects();

  it("covers exactly the projects the site publishes", () => {
    const drawn = manifest
      .map((c) => c.slug)
      .filter((s): s is string => s !== null)
      .sort();
    const published = projects.map((p) => p.slug).sort();
    expect(drawn).toEqual(published);
  });

  it("includes the drafts, because they are published too", () => {
    // The first version of the renderer skipped `draft: true` and lost two cards. Q339 says a
    // draft is not *marked* on the public site — not that it is unpublished — and a draft
    // carries `public: true`, so it has a real page that needs a real image.
    //
    // The vault holds no draft as of 2026-09-23 (D-340), which makes this vacuous rather than
    // wrong: the sibling test above already asserts the manifest covers *exactly* what
    // `publicProjects()` returns, and drafts are in that list. That is the assertion doing the
    // work now. This one stays because it names the specific regression, and starts biting
    // again the moment a draft comes back.
    const drafts = projects.filter((p) => p.draft).map((p) => p.slug);
    for (const slug of drafts) {
      expect(
        manifest.some((c) => c.slug === slug),
        `${slug} has no card`,
      ).toBe(true);
    }
  });

  it("was drawn with the titles the vault holds now", () => {
    // The stale-image failure, stated. Rename a project, forget to re-run the renderer, and the
    // page says one thing while every link preview of it says the old one.
    for (const project of projects) {
      const card = manifest.find((c) => c.slug === project.slug);
      expect(card?.title, `no card for ${project.slug}`).toBe(project.title);
    }
  });

  it("ships a file for every card it claims", () => {
    for (const card of manifest) {
      const file = path.join(ogDir, card.file);
      expect(fs.existsSync(file), `${card.file} missing`).toBe(true);
      // A zero-byte or truncated PNG still "exists". Check the signature and a plausible size.
      const bytes = fs.readFileSync(file);
      expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
      expect(bytes.length).toBeGreaterThan(5_000);
    }
  });

  it("draws them at Open Graph's canonical size", () => {
    // Every platform that crops, crops from 1200x630. A card at another aspect gets letterboxed
    // or centre-cropped, and the crop always takes the title first.
    for (const card of manifest) {
      const bytes = fs.readFileSync(path.join(ogDir, card.file));
      expect(bytes.subarray(12, 16).toString("ascii")).toBe("IHDR");
      expect(bytes.readUInt32BE(16)).toBe(1200);
      expect(bytes.readUInt32BE(20)).toBe(630);
    }
  });
});

describe("the site card", () => {
  it("exists and is the generic one (Q44)", () => {
    const site = manifest.find((c) => c.slug === null);
    expect(site?.file).toBe("site.png");
  });
});

describe("the positioning line", () => {
  it("is the one the About hero uses", () => {
    // The line appears on the page and in the link preview, and they are rendered by different
    // toolchains — React for one, Chromium-in-a-script for the other. A headline that says one
    // thing on the page and another in the preview is worse than either, so both read this
    // constant and the renderer imports it rather than restating it.
    const script = fs.readFileSync(path.join(root, "scripts/render-og.mjs"), "utf8");
    expect(script).toContain("profile-copy.ts");
    expect(script).not.toContain(POSITIONING);
  });

  it("is short enough to set at hero size without wrapping to three lines", () => {
    // Not a style preference: the card gives it a 30ch measure at 30px, so past ~80 characters
    // it takes a third line and collides with the pillar row.
    expect(POSITIONING.length).toBeLessThanOrEqual(80);
  });
});
