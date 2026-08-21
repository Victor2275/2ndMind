import "server-only";

import { loadExperience, loadLabs, loadProjects, loadResumeConfig } from "./vault/load";
import { publicProfile } from "./vault/public";
import type { ResumeVariant } from "./vault/schemas";

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
      bullets: e.bullets,
    }));

  // Projects and labs land in one section. A reader does not care which vault directory an
  // entry came from, only what was built.
  const projectEntries: ResumeEntry[] = loadProjects()
    .filter((p) => p.resume_variants.includes(variant) && p.bullets.length > 0 && !p.draft)
    .map((p) => ({
      slug: p.slug,
      title: p.title,
      org: p.event ?? p.category,
      dates: String(p.year),
      bullets: p.bullets,
    }));

  const labEntries: ResumeEntry[] = loadLabs()
    .filter((l) => l.resume_variants.includes(variant) && l.bullets.length > 0)
    .map((l) => ({
      slug: l.slug,
      title: l.title,
      org: l.course,
      dates: formatResumeDate(l.date),
      bullets: l.bullets,
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
