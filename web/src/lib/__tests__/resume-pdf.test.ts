import { describe, expect, it } from "vitest";

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * §4.4. Two things are worth a test here and neither is the download link.
 *
 * The first is that `context/assets/` is a **public** folder — everything in it becomes a URL —
 * and the file that sat next to this resume in the vault is a university transcript. The
 * per-folder allowlist in the sync script is what keeps that from being one careless copy away
 * from being served, so it is asserted rather than trusted.
 *
 * The second is that the resume PDF is offered *alongside* the generated sheet rather than
 * replacing it (D-188, reversing D-138), because the file is older than the vault content and
 * an override would publish something stale with nothing saying so.
 */

const root = path.join(process.cwd(), "..");
const sync = readFileSync(path.join(process.cwd(), "scripts", "sync-vault-assets.mjs"), "utf8");

describe("what may become a public URL", () => {
  it("copies PDFs only from the resumes folder, never from assets at large", () => {
    // `context/assets/` also holds project heroes and a profile photo, and the vault's archive
    // holds transcripts. A single widened filter is all it would take.
    const resumesPair = sync.slice(sync.indexOf('label: "public/assets/resumes"') - 400);
    expect(resumesPair).toContain("PDF_ONLY");
    expect(sync).toMatch(/const PDF_ONLY = \/\\.pdf\$\/i;/);
  });

  it("keeps the image folders on an image-only filter", () => {
    const pairs = sync.slice(sync.indexOf("const PAIRS"), sync.indexOf("];"));
    const imageOnly = [...pairs.matchAll(/allow: IMAGE_ONLY/g)];
    expect(imageOnly).toHaveLength(2);
  });

  it("never follows a directory, so a nested folder cannot be published by accident", () => {
    expect(sync).toContain("Directories are never followed");
    expect(sync).toContain("entry.isFile()");
  });

  it("has no transcript in the served folder", () => {
    // The blunt version of the rule above, checked against the real tree rather than the code.
    let names: string[] = [];
    try {
      names = readdirSync(path.join(root, "context", "assets", "resumes"));
    } catch {
      names = [];
    }
    expect(names.some((n) => /transcript/i.test(n))).toBe(false);
  });
});

describe("the resume page still leads with the generated sheet", () => {
  const page = readFileSync(
    path.join(process.cwd(), "src", "app", "resume", "[variant]", "page.tsx"),
    "utf8",
  );

  it("renders the generated document regardless of whether a PDF exists", () => {
    // The reversal of D-138 in one assertion: the sheet is not inside a conditional.
    expect(page).toContain("const doc = buildResume(variant);");
    expect(page).not.toMatch(/upload\s*\?\s*[\s\S]{0,80}buildResume/);
  });

  it("offers the upload as a download rather than a navigation", () => {
    // Without `download` a PDF opens in a viewer, which on a phone is a tab nobody asked for.
    expect(page).toMatch(/href=\{upload\.url\}\s*\n?\s*download/);
  });
});
