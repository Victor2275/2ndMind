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
  /**
   * Hero image, as a path under web/public (e.g. "/labs/solenoid_lab_image1.png").
   * Absent means the card renders a generated placeholder instead. `figure_count` > 1
   * means the file is the first of a numbered sequence and the page shows a gallery.
   */
  image: z.string().startsWith("/").optional(),
  figure_count: z.number().int().positive().optional(),
  /** Group work: shown as "N-person team" so solo work is not implied. */
  group_size: z.number().int().min(2).optional(),
  /**
   * Scaffolding awaiting real content. Draft entries render on the site (so layout can be
   * reviewed) but are excluded from resume output, because a resume bullet reading
   * PLACEHOLDER is the kind of thing that reaches a recruiter exactly once.
   */
  draft: z.boolean().default(false),
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

/**
 * 03_craft_and_creative/pursuits/ — the publishable framing of what Victor does outside
 * coursework. Deliberately a separate entity from the training and craft logs it summarises:
 * those hold bodyweight, nutrition targets, and a back rehab protocol, none of which may
 * ever reach a public bundle. Keeping the portfolio framing in its own file means the public
 * site never has to read the private one and hope the allowlist holds.
 */
export const pursuitSchema = baseFrontmatter.extend({
  ...entryFields,
  order: z.number().int().positive(),
  kicker: z.string().min(1),
  discipline: z.string().min(1),
  facts: z
    .array(z.object({ label: z.string().min(1), value: z.string().min(1) }))
    .default([]),
  carryover: z.string().min(1),
});

export type Pursuit = z.infer<typeof pursuitSchema> & { body: string };

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

/**
 * 01_engineering/resume_config.md — the connective tissue the entries do not carry.
 * Which roles and projects appear on a variant comes from each entry's `resume_variants`,
 * never from here.
 */
export const resumeConfigSchema = baseFrontmatter.extend({
  skills: z
    .array(
      z.object({
        group: z.string().min(1),
        variants: z.array(resumeVariant).min(1),
        items: z.array(z.string().min(1)).min(1),
      }),
    )
    .min(1),
  coursework: z.array(z.string().min(1)).min(1),
  variants: z
    .array(
      z.object({
        id: resumeVariant,
        label: z.string().min(1),
        headline: z.string().min(1),
      }),
    )
    .length(3),
});

export type ResumeConfig = z.infer<typeof resumeConfigSchema> & { body: string };
