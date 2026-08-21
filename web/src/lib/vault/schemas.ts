import { z } from "zod";

/**
 * Zod schemas for the markdown vault at ../context.
 *
 * One gotcha drives several decisions here: gray-matter parses frontmatter with js-yaml
 * using the default schema, which turns a bare `2026-08-20` into a JavaScript Date, while
 * a partial date like `2026-06` stays a string and a bare `2022` becomes a number. Every
 * date field therefore accepts all three shapes and normalises to an ISO-ish string.
 */

/** A full ISO date that may arrive as a Date from the YAML parser. */
export const isoDate = z
  .union([z.string(), z.date()])
  .transform((v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v))
  .pipe(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD"));

/** A date that may be a year, a year-month, or a full date. */
export const partialDate = z
  .union([z.string(), z.number(), z.date()])
  .transform((v) => {
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    return String(v);
  })
  .pipe(z.string().regex(/^\d{4}(-\d{2}){0,2}$/, "expected YYYY, YYYY-MM, or YYYY-MM-DD"));

/** Frontmatter every file in the vault carries. */
export const baseFrontmatter = z.object({
  updated: isoDate,
  domain: z.string().min(1),
  stability: z.enum(["stable", "volatile"]),
  summary: z.string().min(1),
  read_when: z.string().min(1),
});

export const resumeVariant = z.enum(["robotics", "ml", "swe"]);
export type ResumeVariant = z.infer<typeof resumeVariant>;

/** Fields shared by every catalogued entry (project, role, lab). */
const entryFields = {
  title: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9-]+$/, "slug must be kebab-case"),
  resume_variants: z.array(resumeVariant).default([]),
  public: z.boolean(),
  bullets: z.array(z.string().min(1)).default([]),
  links: z.record(z.string(), z.url()).optional(),
};

export const projectSchema = baseFrontmatter.extend({
  ...entryFields,
  tier: z.number().int().positive(),
  status: z.enum(["active", "archived"]),
  year: z.number().int(),
  category: z.enum(["software", "hardware", "robotics"]),
  tags: z.array(z.string()).default([]),
  stack: z.array(z.string()).default([]),
  event: z.string().optional(),
});

export const experienceSchema = baseFrontmatter.extend({
  ...entryFields,
  org: z.string().min(1),
  type: z.enum(["internship", "leadership", "other"]),
  date_start: partialDate,
  date_end: partialDate,
  seasonal: z.boolean().optional(),
  confidential_scope: z.string().optional(),
});

export const labSchema = baseFrontmatter.extend({
  ...entryFields,
  course: z.string().min(1),
  term: z.string().min(1),
  date: isoDate,
  collaborators: z.array(z.string()).default([]),
  category: z.literal("hardware"),
  tags: z.array(z.string()).default([]),
  stack: z.array(z.string()).default([]),
  report: z.string().min(1),
  hero_image: z.string().min(1),
  image_count: z.number().int().nonnegative(),
});

export type Project = z.infer<typeof projectSchema> & { body: string };
export type Experience = z.infer<typeof experienceSchema> & { body: string };
export type Lab = z.infer<typeof labSchema> & { body: string };
export type VaultEntry = Project | Experience | Lab;

/** 00_meta/core_profile.md — the canonical identity record. */
export const profileSchema = baseFrontmatter.extend({
  name: z.string().min(1),
  persona: z.string().min(1),
  degree: z.string().min(1),
  school: z.string().min(1),
  school_short: z.string().min(1),
  academic_stage: z.string().min(1),
  admitted: partialDate,
  graduation: partialDate,
  fast_track: z.boolean(),
  gpa: z.number().positive(),
  gpa_scale: z.number().positive(),
  timezone: z.string().min(1),
  primary_os: z.string().min(1),
  post_graduation: z.string().min(1),
  contact: z.object({
    email: z.email(),
    phone: z.string().min(1),
    github: z.url(),
    linkedin: z.url(),
  }),
});

export type Profile = z.infer<typeof profileSchema> & { body: string };
