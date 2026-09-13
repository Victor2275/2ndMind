import "server-only";

import fs from "node:fs";
import path from "node:path";

/**
 * The uploaded resume PDF, if there is one (V3 §4.4, D-188).
 *
 * ## Alongside, not instead of
 *
 * §4.4 was specified with **fallback** semantics — an uploaded PDF replacing the generated
 * resume for that variant (D-138). Victor reversed that on 2026-09-06 once the actual file was
 * in front of him: it is dated 20 August and the vault's resume content was updated on the
 * 30th, so an override would have published a document that was already ten days behind and
 * would drift further every time a project changed, with nothing on screen saying so.
 *
 * So the generated resume stays primary — current, matching the site, and gated at one page by
 * `npm run shots` — and the PDF is the one download action offered on the page (a second
 * "Print / Save as PDF" button was dropped once there was an uploaded file to point at
 * instead; two ways to leave with a PDF was one too many). A recruiter who wants a file still
 * gets one; nothing goes stale silently.
 *
 * ## Why it reads the filesystem
 *
 * There is no upload path, deliberately (Victor's call): PDFs are committed into
 * `context/assets/resumes/` and `scripts/sync-vault-assets.mjs` copies them into `public/` at
 * build time. So "is there a PDF" is a question about what the build produced, and the honest
 * way to ask it is to look. The alternative — a hard-coded filename — would 404 silently the
 * first time one was renamed.
 */

/** Where the sync step puts them. Served from `/assets/resumes/…`. */
const SERVED_DIR = path.join(process.cwd(), "public", "assets", "resumes");

export type ResumeUpload = {
  /** The public URL, ready for an href. */
  url: string;
  /** Bytes, so the page can say how big the download is before it starts. */
  bytes: number;
};

/**
 * The PDF offered for a variant.
 *
 * A file named for the variant wins — `swe.pdf` on `/resume/swe` — and anything else in the
 * folder is a general fallback offered on every variant. Victor has one general-purpose PDF
 * today and chose to offer it on all three; naming a file after a variant later is how that
 * becomes specific, with no code change.
 */
export function resumeUpload(variant: string): ResumeUpload | null {
  let names: string[];
  try {
    names = fs.readdirSync(SERVED_DIR).filter((name) => name.toLowerCase().endsWith(".pdf"));
  } catch {
    // No folder at all, which is the ordinary state of a checkout with no PDFs committed.
    return null;
  }
  if (names.length === 0) return null;

  const specific = names.find((name) => name.toLowerCase() === `${variant.toLowerCase()}.pdf`);
  const chosen = specific ?? names.sort()[0];

  try {
    return {
      url: `/assets/resumes/${encodeURIComponent(chosen)}`,
      bytes: fs.statSync(path.join(SERVED_DIR, chosen)).size,
    };
  } catch {
    return null;
  }
}
