# 2ndMind

A structured personal-context vault. Its purpose is to give AI assistants accurate context
about Victor quickly, so sessions start informed instead of starting with twenty questions.

## For AI agents

Read **`CLAUDE.md`** (or the identical `AGENTS.md`) first. It contains the load order and
routing table.

## For humans

| Folder | Contents |
|---|---|
| `context/00_meta/` | Identity facts and the behavioral directives AI assistants follow |
| `context/01_engineering/` | Coursework, projects, professional experience, technical standards |
| `context/02_physical_performance/` | Dragon boat training blocks, benchmarks, nutrition |
| `context/03_craft_and_creative/` | Culinary formulas, CAD and fabrication |
| `context/04_operations/` | Current sprint, internship pipeline, logbook |
| `context/99_archive/` | Full lab reports, transcripts, superseded documents |
| `scripts/` | Maintenance scripts (see below) |

## Conventions

- Every markdown file carries YAML frontmatter: `updated`, `domain`, `stability`,
  `summary`, `read_when`.
- All dates are ISO 8601.
- `stability: volatile` files are expected to change weekly. `stable` files rarely change.
- Canonical career data lives in `01_engineering/`. The resume in `99_archive/` is a
  generated view and is not authoritative.
- `CLAUDE.md` and `AGENTS.md` are identical copies — **edit both** or regenerate one
  with `cp CLAUDE.md AGENTS.md`.

## Maintenance

```bash
python scripts/audit_freshness.py   # list files that are overdue for an update
```

Weekly ritual: update `context/04_operations/current_sprint.md`, append the closed week to
`context/04_operations/logbook_archive.md`, bump both `updated:` fields, commit.

## Scripts

| Script | Purpose |
|---|---|
| `strip_base64.py` | Extract inlined base64 images from lab reports into `context/assets/` |
| `fix_corruption.py` | Remove Google-Docs escape artifacts and citation markers |
| `strip_dataview.py` | Convert legacy Obsidian Dataview inline fields to plain markdown |
| `audit_freshness.py` | Report files whose `updated:` date is overdue |
