import "server-only";

import { loadExperience, loadLabs, loadProjects, loadResumeConfig } from "./vault/load";
import { publicProfile } from "./vault/public";
import type { Project, ResumeVariant } from "./vault/schemas";

/**
 * Assembles a resume variant from the vault.
 *
 * The resume is a generated artifact, never a maintained document. Every bullet here comes
 * from the same canonical entry that feeds the public site, so the two cannot drift. What
 * decides membership is each entry's own `resume_variants` field — this module only filters,
 * orders, and formats.
 */

export type ResumeEntry = {
  slug: string;
  title: string;
  org: string;
  dates: string;
  bullets: string[];
};

export type ResumeDocument = {
  variant: ResumeVariant;
  label: string;
  headline: string;
  name: string;
  contact: { email: string; phone: string; github: string; linkedin: string };
  education: {
    school: string;
    degree: string;
    graduation: string;
    gpa: string;
    coursework: string[];
  };
  skills: { group: string; items: string[] }[];
  experience: ResumeEntry[];
  projects: ResumeEntry[];
};

export const RESUME_VARIANTS: ResumeVariant[] = ["robotics", "ml", "swe"];

/** 2026-06 -> "June 2026"; a bare year stays as-is; "Present" and friends pass through. */
export function formatResumeDate(value: string): string {
  const match = value.match(/^(\d{4})-(\d{2})/);
  if (!match) return value;
  const [, year, month] = match;
  const name = new Date(Date.UTC(Number(year), Number(month) - 1, 1)).toLocaleString("en-US", {
    month: "long",
    timeZone: "UTC",
  });
  return `${name} ${year}`;
}

/**
 * How many bullets an entry may contribute to a printed resume.
 *
 * The vault keeps every bullet — the project and experience pages still show all of them.
 * These caps exist because the resume is a one-page document and, measured, it was not one:
 * before this the SWE variant printed at 1.33 pages, spilling onto a second sheet that was
 * about 70% white. Height broke down as Projects 443px against Experience 366px, which is
 * the wrong way round for a resume and pointed at the projects section as what to trim.
 *
 * Experience gets one more than projects because a role is the thing a reader is buying.
 * Bullets are taken in vault order, so the first bullet in a file is the one that survives —
 * write the strongest one first.
 */
const MAX_EXPERIENCE_BULLETS = 4;
const MAX_PROJECT_BULLETS = 3;

/**
 * Whether a project may appear on a printed resume variant.
 *
 * Lifted out of `buildResume` so the draft half of it can be tested against a project this
 * module is handed rather than one the vault happens to contain (D-340). The guard in
 * `__tests__/resume.test.ts` asserted over vault content, which meant it tested nothing at all
 * on the day the vault stopped holding a draft — and 2026-09-23 was that day, when the last two
 * draft entries were finished. A `draft: true` entry reaching a resume is the failure that
 * costs the most (a bullet reading PLACEHOLDER in front of a recruiter), so it is the one that
 * should not depend on a fixture surviving.
 */
export function isResumeProject(
  project: Pick<Project, "resume_variants" | "bullets" | "draft">,
  variant: ResumeVariant,
): boolean {
  return project.resume_variants.includes(variant) && project.bullets.length > 0 && !project.draft;
}

export function buildResume(variant: ResumeVariant): ResumeDocument {
  const config = loadResumeConfig();
  const profile = publicProfile();

  const meta = config.variants.find((v) => v.id === variant);
  if (!meta) throw new Error(`resume_config.md has no variant "${variant}"`);

  const experience: ResumeEntry[] = loadExperience()
    .filter((e) => e.resume_variants.includes(variant) && e.bullets.length > 0)
    .map((e) => ({
      slug: e.slug,
      title: e.title,
      org: e.org,
      dates: `${formatResumeDate(e.date_start)} – ${formatResumeDate(e.date_end)}`,
      bullets: e.bullets.slice(0, e.resume_bullets?.[variant] ?? MAX_EXPERIENCE_BULLETS),
    }));

  // Projects and labs land in one section. A reader does not care which vault directory an
  // entry came from, only what was built.
  const projectEntries: ResumeEntry[] = loadProjects()
    .filter((p) => isResumeProject(p, variant))
    .map((p) => ({
      slug: p.slug,
      title: p.title,
      org: p.event ?? p.category,
      dates: String(p.year),
      bullets: p.bullets.slice(0, p.resume_bullets?.[variant] ?? MAX_PROJECT_BULLETS),
    }));

  const labEntries: ResumeEntry[] = loadLabs()
    .filter((l) => l.resume_variants.includes(variant) && l.bullets.length > 0)
    .map((l) => ({
      slug: l.slug,
      title: l.title,
      org: l.course,
      dates: formatResumeDate(l.date),
      bullets: l.bullets.slice(0, MAX_PROJECT_BULLETS),
    }));

  const projects = [...projectEntries, ...labEntries].sort((a, b) =>
    b.dates.localeCompare(a.dates),
  );

  return {
    variant,
    label: meta.label,
    headline: meta.headline,
    name: profile.name,
    contact: profile.contact,
    education: {
      school: profile.school,
      degree: profile.degree,
      graduation: formatResumeDate(profile.graduation),
      gpa: `${profile.gpa.toFixed(2)} / ${profile.gpaScale.toFixed(2)}`,
      coursework: config.coursework,
    },
    skills: config.skills
      .filter((s) => s.variants.includes(variant))
      .map((s) => ({ group: s.group, items: s.items })),
    experience,
    projects,
  };
}

/**
 * The same document as markdown, for `99_archive/resume.md`. Generating both from one
 * function is the point: the archived copy cannot say something the site does not.
 */
export function resumeToMarkdown(doc: ResumeDocument): string {
  const lines: string[] = [];
  const e = doc.education;

  lines.push(`## ${doc.label} variant`, "");
  lines.push(`*${doc.headline}*`, "");
  lines.push(
    `${doc.contact.phone} | [${doc.contact.email}](mailto:${doc.contact.email}) | ` +
      `[LinkedIn](${doc.contact.linkedin}) | [GitHub](${doc.contact.github})`,
    "",
  );

  lines.push("### Education", "");
  lines.push(`**${e.school}** — ${e.degree}  `);
  lines.push(`Expected ${e.graduation} · GPA ${e.gpa}  `);
  lines.push(`*Coursework:* ${e.coursework.join(", ")}`, "");

  lines.push("### Technical Skills", "");
  for (const s of doc.skills) lines.push(`**${s.group}:** ${s.items.join(", ")}  `);
  lines.push("");

  const section = (heading: string, entries: ResumeEntry[]) => {
    if (entries.length === 0) return;
    lines.push(`### ${heading}`, "");
    for (const entry of entries) {
      lines.push(`**${entry.title}** | *${entry.org}* — ${entry.dates}`, "");
      for (const b of entry.bullets) lines.push(`- ${b}`);
      lines.push("");
    }
  };

  section("Experience", doc.experience);
  section("Projects", doc.projects);

  return lines.join("\n").trimEnd();
}
