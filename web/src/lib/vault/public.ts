import "server-only";

import { loadExperience, loadLabs, loadProfile, loadProjects, loadPursuits } from "./load";
import type { Experience, Lab, Project, Pursuit } from "./schemas";
import { splitUpdates, type ProjectUpdate } from "./updates";

/**
 * Projections from vault entries to the shapes public pages are allowed to render.
 *
 * The rule that makes this safe: every projection is built by naming each field
 * explicitly. Never spread the source entry and delete fields afterwards. A field added
 * to the vault tomorrow is therefore private by default, and reaching a public page
 * requires a deliberate edit here plus a test update.
 *
 * Deliberately excluded everywhere:
 *   - resume_variants, public   internal routing flags
 *   - updated/domain/stability/read_when   vault housekeeping metadata
 *   - confidential_scope        the Dimaag.ai boundary note itself
 *   - report                    a path into 99_archive, which is never served
 *   - collaborators             real names of private individuals; see below
 */

/**
 * `## Notes` is the vault's convention for internal plumbing — relative links into
 * 99_archive, reminders about where figures live, notes-to-self about frontmatter.
 * It is written for a reader with the repo checked out, and means nothing to a hiring
 * manager. Bodies render verbatim on public pages, so the section is dropped here
 * rather than by hand in each file, which would only hold until the next file is added.
 */
export function stripInternalSections(body: string): string {
  // Two things this has to get right: `\r?\n`, because vault files are CRLF on Windows and
  // a bare \n silently matches nothing; and no `m` flag, so `$` means end-of-input rather
  // than end-of-line.
  const withoutNotes = body
    .replace(/(?:^|\r?\n)##[ \t]+Notes[ \t]*\r?\n[\s\S]*?(?=\r?\n##[ \t]|$)/gi, "")
    .trimEnd();

  return dropUnwritten(withoutNotes);
}

/** Marks a case-study prompt: a question to Victor, never a claim about the work. */
const TO_WRITE = /^>[ \t]*\*\*To write:?\*\*/i;

/**
 * Removes case-study prompts, and any heading left with nothing under it.
 *
 * The case-study skeleton lives in the vault file itself, so Victor sees the questions where
 * he edits. They must never reach a public page — a prompt reading "what did you try that
 * failed?" published under a project would be worse than no section at all, and an empty
 * `## Measured results` heading is worse still: it advertises a gap.
 *
 * So a section is published only once it has real prose under it. Nothing is invented to
 * fill one, which is the failure this whole convention exists to prevent.
 *
 * Line-based rather than one multi-line regex, for the reasons in `frontmatter.ts`: the vault
 * is CRLF and `$` under the `m` flag does not mean end of input.
 */
export function dropUnwritten(body: string): string {
  const lines = body.split(/\r?\n/);
  const eol = body.includes("\r\n") ? "\r\n" : "\n";

  type Block = { heading: string | null; lines: string[] };
  const blocks: Block[] = [{ heading: null, lines: [] }];

  // A prompt runs to the end of its blockquote. Matching only the first line published the
  // rest of it — the wrap of "> **To write:** …" is still the prompt, not prose.
  let inPrompt = false;

  for (const line of lines) {
    if (/^##[ \t]+/.test(line)) {
      inPrompt = false;
      blocks.push({ heading: line, lines: [] });
      continue;
    }

    if (TO_WRITE.test(line)) {
      inPrompt = true;
      continue;
    }
    if (inPrompt) {
      // Still inside the quote: skip. Anything else ends it.
      if (/^>/.test(line) || line.trim() === "") continue;
      inPrompt = false;
    }

    blocks[blocks.length - 1].lines.push(line);
  }

  const kept: string[] = [];
  for (const block of blocks) {
    const hasProse = block.lines.some((l) => l.trim() !== "");
    if (block.heading === null) {
      if (hasProse) kept.push(block.lines.join(eol).trim());
      continue;
    }
    if (!hasProse) continue; // heading with nothing written under it
    kept.push([block.heading, ...block.lines].join(eol).trim());
  }

  return kept.filter((b) => b !== "").join(eol + eol);
}

export type PublicProject = {
  slug: string;
  title: string;
  summary: string;
  order: number;
  status: "active" | "done";
  year: number;
  category: "software" | "hardware" | "robotics";
  tags: string[];
  stack: string[];
  links: Record<string, string>;
  event?: string;
  image?: string;
  imageFit: "cover" | "contain";
  figures: string[];
  groupSize?: number;
  draft: boolean;
  bullets: string[];
  body: string;
  /** Dated entries from the file's `## Updates` section, newest first. */
  updates: ProjectUpdate[];
};

export type PublicExperience = {
  slug: string;
  title: string;
  summary: string;
  org: string;
  type: "internship" | "leadership" | "other";
  dateStart: string;
  dateEnd: string;
  ongoing: boolean;
  seasonal: boolean;
  links: Record<string, string>;
  bullets: string[];
  body: string;
};

export type PublicLab = {
  slug: string;
  title: string;
  summary: string;
  course: string;
  term: string;
  date: string;
  groupSize: number;
  tags: string[];
  stack: string[];
  heroImage: string;
  imageCount: number;
  figures: string[];
  bullets: string[];
  body: string;
};

export function toPublicProject(p: Project): PublicProject {
  // Split before stripping. Left in the body, an update would be published twice: once as
  // raw markdown under its heading, and once as the dated entry the Working page renders.
  const { body, updates } = splitUpdates(p.body);

  return {
    slug: p.slug,
    title: p.title,
    summary: p.summary,
    order: p.order,
    status: p.status,
    year: p.year,
    category: p.category,
    tags: p.tags,
    stack: p.stack,
    links: p.links ?? {},
    ...(p.event ? { event: p.event } : {}),
    ...(p.image ? { image: p.image } : {}),
    imageFit: p.image_fit ?? "cover",
    figures: p.image && p.figure_count ? labFigures(p.image, p.figure_count) : [],
    ...(p.group_size ? { groupSize: p.group_size } : {}),
    draft: p.draft,
    bullets: p.bullets,
    body: stripInternalSections(body),
    updates,
  };
}

export function toPublicExperience(e: Experience): PublicExperience {
  return {
    slug: e.slug,
    title: e.title,
    summary: e.summary,
    org: e.org,
    type: e.type,
    dateStart: e.date_start,
    dateEnd: e.date_end,
    ongoing: e.ongoing,
    seasonal: e.seasonal ?? false,
    links: e.links ?? {},
    bullets: e.bullets,
    body: stripInternalSections(e.body),
  };
}

/**
 * Vault figures are named `<lab>_lab_image<N>.png`, so the full set is derivable from the
 * hero image plus the count. Doing it here keeps the naming convention in one place, and
 * a test asserts every derived filename actually exists on disk.
 */
export function labFigures(heroImage: string, imageCount: number): string[] {
  const match = heroImage.match(/^(.*?)(\d+)(\.[a-z]+)$/i);
  if (!match) return [heroImage];
  const [, base, , ext] = match;
  return Array.from({ length: imageCount }, (_, i) => `${base}${i + 1}${ext}`);
}

export function toPublicLab(l: Lab): PublicLab {
  return {
    slug: l.slug,
    title: l.title,
    summary: l.summary,
    course: l.course,
    term: l.term,
    date: l.date,
    groupSize: l.collaborators.length + 1,
    tags: l.tags,
    stack: l.stack,
    heroImage: l.hero_image,
    imageCount: l.image_count,
    figures: labFigures(l.hero_image, l.image_count),
    bullets: l.bullets,
    body: stripInternalSections(l.body),
  };
}

/** Field allowlists, exported so the security test asserts against one source of truth. */
export const PUBLIC_PROJECT_KEYS = [
  "slug",
  "title",
  "summary",
  "order",
  "status",
  "year",
  "category",
  "tags",
  "stack",
  "links",
  "event",
  "image",
  "imageFit",
  "figures",
  "groupSize",
  "draft",
  "bullets",
  "body",
  "updates",
] as const;

export const PUBLIC_EXPERIENCE_KEYS = [
  "slug",
  "title",
  "summary",
  "org",
  "type",
  "dateStart",
  "dateEnd",
  "ongoing",
  "seasonal",
  "links",
  "bullets",
  "body",
] as const;

export const PUBLIC_LAB_KEYS = [
  "slug",
  "title",
  "summary",
  "course",
  "term",
  "date",
  "groupSize",
  "tags",
  "stack",
  "heroImage",
  "imageCount",
  "figures",
  "bullets",
  "body",
] as const;

/**
 * The subset the projects grid needs. The grid is a Client Component, so anything handed
 * to it is serialised into the RSC payload and shipped to the browser whether or not it
 * is rendered. Passing full entries sent every project body over the wire; this type is
 * the fix, and a test asserts `body` stays out of it.
 */
export type ProjectCard = Pick<
  PublicProject,
  "slug" | "title" | "summary" | "order" | "status" | "year" | "category" | "stack"
> & { image?: string; imageFit: "cover" | "contain"; draft: boolean };

export const PROJECT_CARD_KEYS = [
  "slug",
  "title",
  "summary",
  "order",
  "status",
  "year",
  "category",
  "stack",
  "image",
  "imageFit",
  "draft",
] as const;

export function toProjectCard(p: PublicProject): ProjectCard {
  return {
    slug: p.slug,
    title: p.title,
    summary: p.summary,
    order: p.order,
    status: p.status,
    year: p.year,
    category: p.category,
    stack: p.stack,
    ...(p.image ? { image: p.image } : {}),
    imageFit: p.imageFit,
    draft: p.draft,
  };
}

export function projectCards(): ProjectCard[] {
  return publicProjects().map(toProjectCard);
}

export function publicProjects(): PublicProject[] {
  return loadProjects()
    .filter((p) => p.public)
    .map(toPublicProject);
}

export function publicExperience(): PublicExperience[] {
  return loadExperience()
    .filter((e) => e.public)
    .map(toPublicExperience);
}

export function publicLabs(): PublicLab[] {
  return loadLabs()
    .filter((l) => l.public)
    .map(toPublicLab);
}

/**
 * Pursuits carry no body on the public side. Their bodies are notes about which private
 * file the framing was drawn from and what should replace it later — useful in the repo,
 * meaningless and slightly odd on a portfolio.
 */
export type PublicPursuit = {
  slug: string;
  title: string;
  kicker: string;
  discipline: string;
  summary: string;
  bullets: string[];
};

export const PUBLIC_PURSUIT_KEYS = [
  "slug",
  "title",
  "kicker",
  "discipline",
  "summary",
  "bullets",
] as const;

export function toPublicPursuit(p: Pursuit): PublicPursuit {
  return {
    slug: p.slug,
    title: p.title,
    kicker: p.kicker,
    discipline: p.discipline,
    summary: p.summary,
    bullets: p.bullets,
  };
}

export function publicPursuits(): PublicPursuit[] {
  return loadPursuits()
    .filter((p) => p.public)
    .map(toPublicPursuit);
}

export type PublicProfile = {
  name: string;
  persona: string;
  degree: string;
  school: string;
  schoolShort: string;
  academicStage: string;
  admitted: string;
  graduation: string;
  fastTrack: boolean;
  gpa: number;
  gpaScale: number;
  contact: { email: string; phone: string; github: string; linkedin: string };
};

export const PUBLIC_PROFILE_KEYS = [
  "name",
  "persona",
  "degree",
  "school",
  "schoolShort",
  "academicStage",
  "admitted",
  "graduation",
  "fastTrack",
  "gpa",
  "gpaScale",
  "contact",
] as const;

/**
 * Victor publishes his GPA but not per-course grades, and all four contact channels are
 * public by his decision. `timezone`, `primary_os`, and `post_graduation` are deliberately
 * withheld — they are vault context, not portfolio content.
 */
export function publicProfile(): PublicProfile {
  const p = loadProfile();
  return {
    name: p.name,
    persona: p.persona,
    degree: p.degree,
    school: p.school,
    schoolShort: p.school_short,
    academicStage: p.academic_stage,
    admitted: p.admitted,
    graduation: p.graduation,
    fastTrack: p.fast_track,
    gpa: p.gpa,
    gpaScale: p.gpa_scale,
    contact: {
      email: p.contact.email,
      phone: p.contact.phone,
      github: p.contact.github,
      linkedin: p.contact.linkedin,
    },
  };
}
