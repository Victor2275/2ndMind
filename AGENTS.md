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
| Courses, grades, academic background, labs | `context/01_engineering/coursework_and_labs.md` |
| Jobs, internships, leadership roles | `context/01_engineering/experience_and_roles.md` |
| Projects, portfolio, "what have you built" | `context/01_engineering/project_catalog.md` |
| Dragon boat, erg, PRs, nutrition, recovery | `context/02_physical_performance/benchmarks_and_logs.md` |
| Workout programming, weekly split, tapering | `context/02_physical_performance/training_blocks.md` |
| Cooking, baking, recipes, dining hall | `context/03_craft_and_creative/culinary_formulas.md` |
| CAD, 3D printing, makerspace, the Turret | `context/03_craft_and_creative/fabrication_and_cad.md` |
| This week's priorities, scheduling | `context/04_operations/current_sprint.md` |
| Applications, cover letters, interview prep | `context/04_operations/internship_pipeline.md` |
| Past sprints, parked automation ideas | `context/04_operations/logbook_archive.md` |

## Rules for reading this vault

- **Never glob `context/99_archive/`.** It holds full lab reports, superseded resumes, and
  transcripts. Open a file there only when Victor names that specific document. The one-line
  summaries in `context/01_engineering/coursework_and_labs.md` are sufficient for every normal
  question.
- **Never read `context/assets/`.** Binary images only.
- **Check the `updated:` frontmatter field.** A file marked `stability: volatile` whose
  `updated:` date is more than ~14 days old should be treated as suspect — say so rather than
  presenting it as current fact.
- **Canonical sources:** career facts come from `experience_and_roles.md` and
  `project_catalog.md`, never from `99_archive/resume.md` — that file is a generated view and
  explicitly marks itself non-canonical.
- **Dimaag.ai:** the technical specifics in `experience_and_roles.md` (PPO, Isaac Lab, LiDAR
  raycasting, sim-to-real validation, tracking accuracy) are shareable — use them freely.
  Anything beyond that documented scope is not recorded in this vault; say so rather than
  guessing at it.
- **Dates are ISO 8601.** Write new dates that way.

## When you change something

If Victor tells you a fact that contradicts this vault, or you notice something stale:
update the file, bump its `updated:` field to today, and say what you changed.

## Structure

```
context/
├── 00_meta/                  identity + behavioral directives
├── 01_engineering/           academics, projects, experience, standards
├── 02_physical_performance/  dragon boat training and benchmarks
├── 03_craft_and_creative/    cooking, CAD, fabrication
├── 04_operations/            sprints, internship pipeline, logbook
├── assets/labs/               extracted lab report images (binary)
└── 99_archive/                full lab reports, transcripts, superseded docs
```
