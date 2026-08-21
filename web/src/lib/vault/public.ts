import "server-only";

import { loadExperience, loadLabs, loadProfile, loadProjects } from "./load";
import type { Experience, Lab, Project } from "./schemas";

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
 */

export type PublicProject = {
  slug: string;
  title: string;
  summary: string;
  tier: number;
  status: "active" | "archived";
  year: number;
  category: "software" | "hardware" | "robotics";
  tags: string[];
  stack: string[];
  links: Record<string, string>;
  event?: string;
  bullets: string[];
  body: string;
};

export type PublicExperience = {
  slug: string;
  title: string;
  summary: string;
  org: string;
  type: "internship" | "leadership" | "other";
  dateStart: string;
  dateEnd: string;
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
  collaborators: string[];
  tags: string[];
  stack: string[];
  heroImage: string;
  imageCount: number;
  figures: string[];
  bullets: string[];
  body: string;
};

export function toPublicProject(p: Project): PublicProject {
  return {
    slug: p.slug,
    title: p.title,
    summary: p.summary,
    tier: p.tier,
    status: p.status,
    year: p.year,
    category: p.category,
    tags: p.tags,
    stack: p.stack,
    links: p.links ?? {},
    ...(p.event ? { event: p.event } : {}),
    bullets: p.bullets,
    body: p.body,
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
    seasonal: e.seasonal ?? false,
    links: e.links ?? {},
    bullets: e.bullets,
    body: e.body,
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
    collaborators: l.collaborators,
    tags: l.tags,
    stack: l.stack,
    heroImage: l.hero_image,
    imageCount: l.image_count,
    figures: labFigures(l.hero_image, l.image_count),
    bullets: l.bullets,
    body: l.body,
  };
}

/** Field allowlists, exported so the security test asserts against one source of truth. */
export const PUBLIC_PROJECT_KEYS = [
  "slug", "title", "summary", "tier", "status", "year", "category",
  "tags", "stack", "links", "event", "bullets", "body",
] as const;

export const PUBLIC_EXPERIENCE_KEYS = [
  "slug", "title", "summary", "org", "type", "dateStart", "dateEnd",
  "seasonal", "links", "bullets", "body",
] as const;

export const PUBLIC_LAB_KEYS = [
  "slug", "title", "summary", "course", "term", "date", "collaborators",
  "tags", "stack", "heroImage", "imageCount", "figures", "bullets", "body",
] as const;

/**
 * The subset the projects grid needs. The grid is a Client Component, so anything handed
 * to it is serialised into the RSC payload and shipped to the browser whether or not it
 * is rendered. Passing full entries sent every project body over the wire; this type is
 * the fix, and a test asserts `body` stays out of it.
 */
export type ProjectCard = Pick<
  PublicProject,
  "slug" | "title" | "summary" | "tier" | "status" | "year" | "category" | "stack"
>;

export const PROJECT_CARD_KEYS = [
  "slug", "title", "summary", "tier", "status", "year", "category", "stack",
] as const;

export function toProjectCard(p: PublicProject): ProjectCard {
  return {
    slug: p.slug,
    title: p.title,
    summary: p.summary,
    tier: p.tier,
    status: p.status,
    year: p.year,
    category: p.category,
    stack: p.stack,
  };
}

export function projectCards(): ProjectCard[] {
  return publicProjects().map(toProjectCard);
}

export function publicProjects(): PublicProject[] {
  return loadProjects().filter((p) => p.public).map(toPublicProject);
}

export function publicExperience(): PublicExperience[] {
  return loadExperience().filter((e) => e.public).map(toPublicExperience);
}

export function publicLabs(): PublicLab[] {
  return loadLabs().filter((l) => l.public).map(toPublicLab);
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
  "name", "persona", "degree", "school", "schoolShort", "academicStage",
  "admitted", "graduation", "fastTrack", "gpa", "gpaScale", "contact",
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
