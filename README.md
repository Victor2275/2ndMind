# 2ndMind

A structured personal-context vault. Its purpose is to give AI assistants accurate context
about Victor quickly, so sessions start informed instead of starting with twenty questions.

The vault renders itself as **[victorgusev.com](https://victorgusev.com)** — a public
portfolio built from a whitelisted subset of this repository, plus an authenticated private
app (training log, task tracker, resume tooling) that only Victor can reach. See
`web/context.md` for how the two surfaces stay separate from one source of truth.

This repository is public so the code is visible; the private surface and Victor's own data
are still gated behind passkey authentication regardless of repo visibility — nothing under
`context/` besides project/experience/lab write-ups is served publicly, and `.env.example`
never carries a real secret. See `web/DECISIONS.md` D-240 and the repo's `LICENSE`.

## For AI agents

Read **`CLAUDE.md`** (or the identical `AGENTS.md`) first. It contains the load order and
routing table.

## For humans

| Folder | Contents |
|---|---|
| `context/00_meta/` | Identity facts and the behavioral directives AI assistants follow |
| `context/01_engineering/` | Coursework, technical standards, career targets |
| `context/01_engineering/projects/` | One file per project — **canonical** |
| `context/01_engineering/experience/` | One file per role — **canonical** |
| `context/02_physical_performance/` | Dragon boat training blocks, benchmarks, nutrition |
| `context/03_craft_and_creative/` | Culinary formulas, CAD and fabrication |
| `context/04_operations/` | Current sprint, internship pipeline, logbook |
| `context/99_archive/` | Full lab reports, transcripts, superseded documents |
| `context/assets/` | Project hero images and the profile photograph — synced into `web/public/` at build |
| `docs/` | Plans and migration notes: `V2_PLAN`, `V3_PLAN`, `UPLOADS_NEEDED`, `REVIEW_ROUND_PLAN` |
| `private/` | **Gitignored.** Source documents downloaded to be parsed, never committed — saved DARS audits and the like |
| `scripts/` | Maintenance scripts (see below) |
| `web/` | Next.js app — public portfolio and private second brain |

## Conventions

- Every markdown file carries YAML frontmatter: `updated`, `domain`, `stability`,
  `summary`, `read_when`.
- All dates are ISO 8601.
- `stability: volatile` files are expected to change weekly. `stable` files rarely change.
- Canonical career data lives in `01_engineering/projects/` and
  `01_engineering/experience/`, one file per entry, structured fields in frontmatter.
- `project_catalog.md`, `experience_and_roles.md`, and `99_archive/resume.md` are
  **generated views**. Do not edit them; regenerate instead.
- `CLAUDE.md` and `AGENTS.md` are identical copies — **edit both** or regenerate one
  with `cp CLAUDE.md AGENTS.md`.

## Maintenance

```bash
python scripts/audit_freshness.py         # list files overdue for an update
python scripts/build_indexes.py           # regenerate the project/experience indexes
python scripts/build_indexes.py --check   # exit 1 if those indexes are stale
```

Run `build_indexes.py` after adding or editing anything in `projects/` or `experience/`.

Weekly ritual: update `context/04_operations/current_sprint.md`, append the closed week to
`context/04_operations/logbook_archive.md`, bump both `updated:` fields, commit.

## Scripts

| Script | Purpose |
|---|---|
| `strip_base64.py` | Extract inlined base64 images from lab reports into `context/assets/` |
| `fix_corruption.py` | Remove Google-Docs escape artifacts and citation markers |
| `strip_dataview.py` | Convert legacy Obsidian Dataview inline fields to plain markdown |
| `audit_freshness.py` | Report files whose `updated:` date is overdue |
| `build_indexes.py` | Regenerate `project_catalog.md` and `experience_and_roles.md` |
| `parse_dars.py` | Derive `01_engineering/degree_audit.md` from a saved DARS audit in `private/` |
