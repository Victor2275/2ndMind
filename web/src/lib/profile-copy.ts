/**
 * The prose about Victor that is written rather than derived (V4 items 6.3 and 6.4, Q307, Q321).
 *
 * Everything else on the About page comes out of the vault: the name, the degree, the school, the
 * graduation year, the GPA, the roles, the projects. These two strings do not — they are claims,
 * not fields, and Q307 and Q321 asked for both.
 *
 * They live here rather than inside `app/page.tsx` because the OG card needs the positioning line
 * too (`scripts/render-og.mjs`), and a headline that says one thing on the page and another in
 * the link preview is worse than either. `lib/__tests__/og.test.ts` pins the rendered card to
 * this file.
 *
 * ## Sourcing
 *
 * Drafted 2026-09-10 from `core_profile.md`, `career_targets.md` and `experience/dimaag.md`, for
 * Victor to approve or replace. Every number below is one that `dimaag.md`'s `confidential_scope`
 * names as **shareable**: the hybrid RL/classical local planner, sub-decimeter tracking above
 * 10 mph, and the 80% reduction in mean tracking error over the classical planner. Nothing here
 * touches the paper's specifics, which are internal until Dimaag clears them — no vehicle class,
 * no TRPO/IPO detail, no simulation-measured figures.
 *
 * Nothing here is sensitive; it is written to be read by strangers, and compiles into client
 * chunks like any other public copy.
 */

/**
 * One line, below the name, larger than the eyebrow (Q307).
 *
 * Deliberately not "Robotics Engineer" restated — Q308 keeps that as the eyebrow and the first
 * text on the page, so repeating it here would spend the largest line on the page saying nothing
 * new. This says the part that is actually distinguishing: the work had to leave the simulator.
 */
export const POSITIONING = "Autonomous systems that have to work outside the simulator.";

/**
 * One paragraph, below the hero (Q321).
 *
 * Kept to what can be checked. The alternative draft opened with adjectives and was cut: a
 * recruiter reading this has the resume one click away, and a claim they can verify is worth more
 * than one they cannot.
 */
export const ABOUT_PARAGRAPH =
  "I'm a second-year at UCLA on a three-year track to a B.S. in Computer Science and " +
  "Engineering. Last summer at Dimaag.ai I built a hybrid reinforcement-learning and classical " +
  "local planner for autonomous vehicles, and took it off the simulator onto real hardware — " +
  "sub-decimeter tracking above 10 mph, and 80% less mean error than the classical planner " +
  "alone. Most of what I build outside work is instrumentation: things that measure something " +
  "nobody had measured yet.";
