# 2ndMind — AI Context Vault

Personal context for Victor Gusev. Read this file first; it tells you what else to open.

## Load order

1. **Always load:** `context/00_meta/core_profile.md` (identity) and
   `context/00_meta/ai_directives.md` (how to respond).
2. **Always check:** `context/04_operations/current_sprint.md` for what is active right now.
3. **Then load by topic** using the routing table below. Load only what the question needs.

Total across all live files is roughly 27 KB (~7k tokens), so loading everything is affordable
if the question is broad. It is not affordable to touch `99_archive/`.

## Routing table

| If the question is about… | Read |
|---|---|
| Who Victor is, school, year, timezone | `context/00_meta/core_profile.md` |
| How to respond, tone, domain mode | `context/00_meta/ai_directives.md` |
| Design, branding, colors, portfolio site | `context/00_meta/brand_and_voice.md` |
| Target roles, companies, locations, timeline | `context/01_engineering/career_targets.md` |
| Languages, tooling, OS, code standards | `context/01_engineering/technical_standards.md` |
| Courses, grades, academic background | `context/01_engineering/coursework_and_labs.md` |
| What is left to graduate, course planning | `context/01_engineering/degree_audit.md` (generated — see below) |
| Physics labs, ESP32 instrumentation work | `context/01_engineering/labs/` |
| Jobs, internships, leadership roles | `context/01_engineering/experience/` (fast index: `experience_and_roles.md`) |
| Projects, portfolio, "what have you built" | `context/01_engineering/projects/` (fast index: `project_catalog.md`) |
| What Victor is working on *right now* | the `status: active` projects and their `## Updates` sections — same files; published at `/now` |
| Dragon boat, erg, PRs, nutrition, recovery | `context/02_physical_performance/benchmarks_and_logs.md` |
| Workout programming, weekly split, tapering | `context/02_physical_performance/training_blocks.md` |
| Cooking, baking, recipes | **Proof** — https://proof-cdvj.onrender.com. Not in this vault. |
| CAD, 3D printing, makerspace, the Turret | `context/03_craft_and_creative/fabrication_and_cad.md` |
| This week's priorities, scheduling | `context/04_operations/current_sprint.md` |
| Applications, cover letters, interview prep | `context/04_operations/internship_pipeline.md` |
| Past sprints, parked automation ideas | `context/04_operations/logbook_archive.md` |
| The website, the web app, deploying it | `web/context.md` |
| Why the site looks/works the way it does; undoing a choice | `web/DECISIONS.md` |

## Rules for reading this vault

- **Never glob `context/99_archive/`.** It holds full lab reports, superseded resumes, and
  transcripts. Open a file there only when Victor names that specific document. The one-line
  summaries in `context/01_engineering/coursework_and_labs.md` are sufficient for every normal
  question.
- **Never read `context/assets/`.** Binary images only.
- **Never glob `web/`.** That is the Next.js app that renders this vault as a website. It
  carries its own `AGENTS.md` and `context.md` — read those instead. `web/node_modules/`
  will swamp any search that reaches it.
- **Check the `updated:` frontmatter field.** A file marked `stability: volatile` whose
  `updated:` date is more than ~14 days old should be treated as suspect — say so rather than
  presenting it as current fact.
- **Canonical sources:** career facts come from the per-entry files in
  `01_engineering/projects/`, `01_engineering/experience/`, and `01_engineering/labs/` —
  one file per project, role, or lab,
  structured data in frontmatter. `project_catalog.md` and `experience_and_roles.md` are
  **generated indexes**: read them for a one-file overview, never edit them. Same for
  `99_archive/resume.md`, and the `## Lab Experiments` section of `coursework_and_labs.md`.
  After changing any entry, run `python scripts/build_indexes.py`.
- **`degree_audit.md` is generated too**, by `python scripts/parse_dars.py <saved DARS.html>`.
  Never edit it, and never read a raw `DARS*.html` — those carry Victor's student ID, high
  school, and full grade history, and are gitignored for that reason (`web/DECISIONS.md`
  D-113). Re-run the script when he saves a fresh audit.
- **Projects are ordered by their `order:` field**, not by tier — tiers were removed on
  2026-08-29 (D-107). A new project appends to the bottom by taking the next number. Project
  `status:` is `active` or `done`; `active` is what puts it on the public `/now` page.
- **`## Updates` in a project file is published.** `### YYYY-MM-DD` entries under that heading
  render on the public `/now` page and on the project page, newest first — see `web/DECISIONS.md`
  D-099. A project reaches `/now` by its frontmatter saying `status: active`, so that field is
  now load-bearing rather than descriptive. Write updates for a stranger, not as notes to self;
  anything internal belongs under `## Notes`, which is stripped.
- **Dimaag.ai:** the boundary is stated in full in `experience/dimaag.md` under
  `confidential_scope` — read it there rather than assuming, because it changed on
  2026-08-29. Summary: the bullets in that file are shareable; the research paper's technical
  specifics are **internal until Dimaag clears them**, and the source repository is private
  and has not been read. Anything beyond the documented scope is not recorded in this vault;
  say so rather than guessing at it.
- **Dates are ISO 8601.** Write new dates that way.

## When you change something

If Victor tells you a fact that contradicts this vault, or you notice something stale:
update the file, bump its `updated:` field to today, and say what you changed.

## Structure

```
context/
├── 00_meta/                  identity + behavioral directives
├── 01_engineering/           academics, standards, career targets
│   ├── projects/             one file per project (canonical)
│   ├── experience/           one file per role (canonical)
│   └── labs/                 one file per physics lab (canonical)
├── 02_physical_performance/  dragon boat training and benchmarks
├── 03_craft_and_creative/    cooking, CAD, fabrication
├── 04_operations/            sprints, internship pipeline, logbook
├── assets/labs/               extracted lab report images (binary)
└── 99_archive/                full lab reports, transcripts, superseded docs

web/                          Next.js app — public portfolio + private second brain
```
