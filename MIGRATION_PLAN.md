# 2ndMind Migration Plan

**Created:** 2026-08-20 · **Executor:** any capable coding model · **Estimated time:** 3–4 hours

- **Repo root:** `C:\Users\gusev\Documents\2ndMind`
- **Goal:** make this vault fast and accurate for AI assistants reading it off the filesystem (Claude Code and similar).
- **Explicitly out of scope:** Obsidian. It is being removed. Do not preserve, repair, or work around it.

---

## 0. READ BEFORE STARTING

### 0.1 What is wrong today

| # | Defect | Evidence |
|---|---|---|
| 1 | **96% of vault bytes are base64 PNGs** inlined in 5 lab reports | 3,064,109 B of 3,099,621 B total markdown |
| 2 | **No AI entry point** — an agent can't tell what to read | no `CLAUDE.md`, `AGENTS.md`, or `README.md` anywhere |
| 3 | **No metadata** — nothing is dated, so staleness is undetectable | 0 of 24 files have YAML frontmatter |
| 4 | **Corrupted directive files** — Google Docs export escapes | 419 stray backslashes, 24 `[cite:]` markers |
| 5 | **Obsidian/Dataview cruft** that serves no AI reader | 1.3 MB plugin JS, 55 `[key:: value]` fields, a dead Dashboard |
| 6 | **Contradictions with no canonical source** | GPA is 3.64 in one file and 3.89 in another |

### 0.2 Hard rules

| # | Rule |
|---|---|
| **R1** | **Phase 1 (git) must finish before anything else.** It is the only rollback. |
| **R2** | **Never delete content.** Move to `context/99_archive/superseded/`. The one exception is `context/.obsidian/` in Phase 4, which is vendored third-party code and is safe to delete outright. |
| **R3** | **Never invent facts.** Unknown value → write `TODO` and log it in §10 Open Questions. Never guess a GPA, grade, date, or metric. |
| **R4** | **Commit after each phase** using the exact message given. Do not batch phases. |
| **R5** | **Run the VERIFY block at the end of each phase.** If anything fails, stop and report. Do not continue. |
| **R6** | **Today is 2026-08-20.** Use it for every `updated:` field. |
| **R7** | Files in `context/00_meta/` are *behavioral directives*. When reformatting them you are fixing formatting, **not rewriting intent**. Preserve meaning exactly. |
| **R8** | If this plan conflicts with what you find in the repo, **stop and report**. Do not resolve it yourself. |

### 0.3 Environment

- Windows 11. PowerShell primary, Git Bash available. `python` (Python 3) is on PATH — verified.
- **Always pass `encoding='utf-8'` to every Python `open()`/`read_text()`/`write_text()`.** Windows defaults to cp1252 and *will* corrupt the `Ω ≈ – ’ ×` characters present in these files.
- Put scripts in `scripts/` at repo root. Run them from repo root.

### 0.4 Phase order

```
1  git safety net        ──► blocks everything
2  strip base64          ──► independent
3  fix text corruption   ──► independent
4  remove Obsidian       ──► independent
5  add frontmatter       ──► needs 3, 4
6  merge AI directives   ──► needs 3
7  fix contradictions    ──► needs 3
8  write CLAUDE.md       ──► needs 5, 6, 7
9  freshness script      ──► needs 5
10 final verification    ──► needs all
```

### 0.5 Target end state

```
2ndMind/
├── .gitignore                     [NEW]
├── CLAUDE.md                      [NEW]  AI entry point + routing table
├── AGENTS.md                      [NEW]  byte-identical copy of CLAUDE.md
├── README.md                      [NEW]  human-facing map
├── MIGRATION_PLAN.md              this file
├── scripts/
│   ├── strip_base64.py            [NEW]
│   ├── fix_corruption.py          [NEW]
│   ├── strip_dataview.py          [NEW]
│   └── audit_freshness.py         [NEW]
└── context/
    ├── 00_meta/
    │   ├── ai_directives.md       [NEW]        all behavioral rules, merged
    │   ├── core_profile.md        [REWRITTEN]  identity facts only
    │   └── brand_and_voice.md     [TRIMMED]    aesthetic only
    │   └── (Dashboard.md DELETED, interaction_modes.md MERGED AWAY)
    ├── 01_engineering/            (unchanged structure, + frontmatter)
    ├── 02_physical_performance/   (unchanged structure, + frontmatter)
    ├── 03_craft_and_creative/     (unchanged structure, + frontmatter)
    ├── 04_operations/             (unchanged structure, + frontmatter)
    ├── assets/labs/               [NEW]  63 extracted PNGs
    └── 99_archive/
        ├── superseded/            [NEW]
        └── *_lab.md               (base64 stripped, ~18 KB each)
```

**No `.obsidian/`. No `Dashboard.md`. No entity-per-file split. File count stays roughly flat.**

---

## PHASE 1 — Git safety net

### 1.1 Create `.gitignore` at repo root

```gitignore
# Python
__pycache__/
*.pyc
.venv/

# OS
Thumbs.db
desktop.ini
.DS_Store
```

### 1.2 Snapshot

```bash
cd /c/Users/gusev/Documents/2ndMind
git init
git add -A
git commit -m "chore: baseline snapshot before migration"
git branch -M main
git tag pre-migration
```

> The baseline commit deliberately includes `.obsidian/` so it is recoverable from history
> after Phase 4 deletes it.

### 1.3 VERIFY

```bash
git log --oneline        # exactly 1 commit
git status --porcelain   # empty
git tag                  # pre-migration
```

**Rollback at any point:** `git reset --hard pre-migration`

---

## PHASE 2 — Strip base64 images

**Impact: 3,064,109 B → ~92,601 B of markdown (−97%). 63 PNGs extracted.** These numbers come from a verified dry run; yours should match.

### 2.1 Understand the format first

Images are **reference-style Markdown definitions**, not `![](...)` and not `<img>`:

```markdown
![][image1]                                        ← usage, in the body
...
[image1]: <data:image/png;base64,iVBORw0KGgo...>   ← definition, in the Appendix
```

Every file has a perfect 1:1 def↔use mapping (verified 15/15, 12/12, 16/16, 10/10, 10/10).
**You rewrite only the definition lines.** The `![][image1]` usages are untouched and resolve
automatically to the new paths. That is what makes this safe.

### 2.2 `scripts/strip_base64.py`

```python
"""Extract inlined base64 PNGs from lab reports into context/assets/labs/.

Rewrites reference-style image definitions:
    [image1]: <data:image/png;base64,....>
into:
    [image1]: ../assets/labs/<stem>_image1.png

The `![][image1]` usages in the body are untouched and resolve automatically.
Idempotent: rewritten definitions no longer match the pattern.
"""
import base64
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
LABS = sorted((ROOT / "context" / "99_archive").glob("*_lab.md"))
ASSETS = ROOT / "context" / "assets" / "labs"

# 1 = ref name, 2 = extension, 3 = base64 payload
PATTERN = re.compile(
    r"^\[([^\]]+)\]:\s*<data:image/(\w+);base64,([A-Za-z0-9+/=\s]+?)>",
    re.MULTILINE,
)


def main() -> int:
    if not LABS:
        print("ERROR: no *_lab.md files found", file=sys.stderr)
        return 1

    ASSETS.mkdir(parents=True, exist_ok=True)
    total_before = total_after = images = 0

    for lab in LABS:
        text = lab.read_text(encoding="utf-8")
        before = len(text)
        stem = lab.stem

        def replace(match: "re.Match[str]") -> str:
            nonlocal images
            ref, ext, payload = match.group(1), match.group(2), match.group(3)
            (ASSETS / f"{stem}_{ref}.{ext}").write_bytes(base64.b64decode(payload))
            images += 1
            # Path is relative to the lab file, which lives in context/99_archive/
            return f"[{ref}]: ../assets/labs/{stem}_{ref}.{ext}"

        new_text = PATTERN.sub(replace, text)
        lab.write_text(new_text, encoding="utf-8")

        after = len(new_text)
        total_before += before
        total_after += after
        pct = (1 - after / before) * 100 if before else 0
        print(f"{stem:<16} {before:>9,} -> {after:>7,} B  (-{pct:.1f}%)")

    print(f"\nTOTAL {total_before:,} -> {total_after:,} B")
    print(f"Extracted {images} images to {ASSETS}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

### 2.3 Run

```bash
python scripts/strip_base64.py
```

Expected:

```
optics_lab       1,003,059 ->  17,833 B  (-98.2%)
resistor_lab       641,824 ->  17,195 B  (-97.3%)
rlc_lab            629,355 ->  18,554 B  (-97.1%)
solenoid_lab       518,067 ->  19,488 B  (-96.2%)
sound_lab          271,804 ->  19,531 B  (-92.8%)

TOTAL 3,064,109 -> 92,601 B
Extracted 63 images to ...\context\assets\labs
```

### 2.4 VERIFY — all must pass

```bash
# 63 PNGs extracted
ls context/assets/labs/*.png | wc -l                       # -> 63

# They are real PNGs, not truncated
file context/assets/labs/optics_lab_image1.png             # -> PNG image data, 334 x 305, ...

# Zero base64 payloads left anywhere
grep -rc 'base64' context --include=*.md | grep -v ':0'    # -> no output

# No lab file over 25 KB
find context/99_archive -name '*_lab.md' -size +25k        # -> no output

# Every image reference still resolves
python -c "
import re,glob,pathlib
ok=True
for f in sorted(glob.glob('context/99_archive/*_lab.md')):
    t=pathlib.Path(f).read_text(encoding='utf-8')
    d=set(re.findall(r'^\[([^\]]+)\]:\s*\.\./assets/',t,re.M))
    u=set(re.findall(r'!\[[^\]]*\]\[([^\]]+)\]',t))
    if d!=u: ok=False; print('MISMATCH',f,'defs-only',d-u,'uses-only',u-d)
print('ALL REFERENCES RESOLVE' if ok else 'FAILED')"
```

### 2.5 Commit

```bash
git add -A
git commit -m "perf: extract 63 base64 PNGs from lab reports to assets/ (-97% markdown size)"
```

---

## PHASE 3 — Fix text corruption

Two defects from a Google Docs / NotebookLM export pipeline.

### 3.1 Defect A — escaped markdown (419 stray backslashes)

`context/00_meta/interaction_modes.md` is the worst hit (160). Nothing in it renders:

```
\#\# 1\. Engineering Mode (\`01\_engineering/\`)
\* \[cite\_start\]\*\*Baseline Knowledge:\*\* Assume the technical understanding...
```

| File | Backslashes |
|---|---:|
| `context/00_meta/interaction_modes.md` | 160 |
| `context/99_archive/brain_structure.md` | 56 |
| `context/99_archive/rlc_lab.md` | 45 |
| `context/99_archive/sound_lab.md` | 44 |
| `context/99_archive/optics_lab.md` | 42 |
| `context/99_archive/solenoid_lab.md` | 36 |
| `context/99_archive/resistor_lab.md` | 35 |
| `context/99_archive/resume.md` | 1 |
| `context/99_archive/old_resume.md` | 1 |

### 3.2 Defect B — citation artifacts (24 markers)

In `core_profile.md` (13) and `interaction_modes.md` (11):

```
* [cite_start]**Name:** Victor [cite: 29]
* **Density & Structure:** Prioritize conciseness with structured analysis[cite: 32].
```

Strip `[cite_start]` and `[cite: N]` / `[cite: N, M]`. Watch the punctuation:
`analysis[cite: 32].` → `analysis.` **not** `analysis .`

### 3.3 `scripts/fix_corruption.py`

```python
"""Remove Google-Docs export backslash escapes and NotebookLM citation markers.

Idempotent. Run from repo root.
"""
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent

TARGETS = [
    "context/00_meta/interaction_modes.md",
    "context/00_meta/core_profile.md",
    "context/99_archive/brain_structure.md",
    "context/99_archive/rlc_lab.md",
    "context/99_archive/sound_lab.md",
    "context/99_archive/optics_lab.md",
    "context/99_archive/solenoid_lab.md",
    "context/99_archive/resistor_lab.md",
    "context/99_archive/resume.md",
    "context/99_archive/old_resume.md",
]

# Only unescape punctuation Markdown actually escapes.
# Do NOT touch \n, \t, or LaTeX-looking sequences.
UNESCAPE = re.compile(r"\\([#*_`\[\]().\-+!>~|])")
CITE_START = re.compile(r"\[cite_start\]\s*")
CITE_REF = re.compile(r"\s*\[cite:\s*[\d,\s]+\]")


def main() -> None:
    for rel in TARGETS:
        path = ROOT / rel
        if not path.exists():
            print(f"SKIP (missing): {rel}")
            continue

        original = path.read_text(encoding="utf-8")
        text = CITE_START.sub("", original)
        text = CITE_REF.sub("", text)
        text = UNESCAPE.sub(r"\1", text)

        if text != original:
            path.write_text(text, encoding="utf-8")
            removed = original.count("\\") - text.count("\\")
            print(f"FIXED  {rel:<45} -{removed} escapes, "
                  f"-{len(original) - len(text)} bytes")
        else:
            print(f"CLEAN  {rel}")


if __name__ == "__main__":
    main()
```

### 3.4 Two one-line fixes

```bash
# Stray "x" on line 1 of coursework_and_labs.md
sed -i '1{/^x$/d}' context/01_engineering/coursework_and_labs.md
sed -i '1{/^$/d}'  context/01_engineering/coursework_and_labs.md

# Normalise GitHub username casing to Victor2275 (the form the real URLs use)
grep -rl 'victor2275' context --include=*.md | xargs sed -i 's/victor2275/Victor2275/g'
```

### 3.5 Run and VERIFY

```bash
python scripts/fix_corruption.py

grep -rc 'cite_start\|\[cite:' context --include=*.md | grep -v ':0'   # -> no output
grep -rc 'victor2275' context --include=*.md | grep -v ':0'            # -> no output
head -1 context/01_engineering/coursework_and_labs.md                  # -> '# Coursework and Labs'
head -3 context/00_meta/interaction_modes.md                           # -> '# Domain Interaction Modes'

python -c "
import pathlib
t=pathlib.Path('context/00_meta/interaction_modes.md').read_text(encoding='utf-8')
print('backslashes remaining:', t.count(chr(92)))"                     # -> 0
```

### 3.6 Commit

```bash
git add -A
git commit -m "fix: remove 419 markdown escape artifacts and 24 citation markers"
```

---

## PHASE 4 — Remove Obsidian

Obsidian is being dropped. Its plugin was the only thing that could read `[key:: value]` syntax, and it served the human reader, not the AI reader. Removing it deletes 1.3 MB of vendored JS and one dead file.

### 4.1 Delete the Obsidian directory

```bash
git rm -r --cached context/.obsidian
rm -rf context/.obsidian
```

> Safe per **R2** — this is vendored third-party plugin code, recoverable from the
> `pre-migration` tag if ever needed.

### 4.2 Delete the Dashboard

`context/00_meta/Dashboard.md` contains only Dataview code fences. Without Obsidian it renders as three dead code blocks containing zero facts — actively misleading to an AI, which sees a file named "Dashboard" and finds no data.

```bash
mkdir -p context/99_archive/superseded
git mv context/00_meta/Dashboard.md context/99_archive/superseded/Dashboard.md
```

### 4.3 Convert Dataview inline fields to plain markdown

**55 fields across 4 files.** Purely mechanical — content is preserved, only syntax changes.

| Found in | Count | Syntax |
|---|---:|---|
| `01_engineering/coursework_and_labs.md` | 30 | `[date:: Fall 2024]`, `[grade:: In Progress]` |
| `01_engineering/project_catalog.md` | 8 | `[status:: Active]`, `[date:: 2026]` |
| `01_engineering/experience_and_roles.md` | 4 + 4 | `[date:: June 2026 – August 2026]`, `**Role**::` |
| `02_physical_performance/benchmarks_and_logs.md` | 5 | `[nutrition:: Protein]` |

#### `scripts/strip_dataview.py`

```python
"""Convert Obsidian Dataview inline fields to plain markdown.

    [date:: Fall 2024]   ->  Fall 2024
    [grade:: A]          ->  A
    [status:: Active]    ->  Active
    - **Role**:: text    ->  - **Role:** text

Content is preserved exactly; only syntax changes. Idempotent.
"""
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent

TARGETS = [
    "context/01_engineering/coursework_and_labs.md",
    "context/01_engineering/project_catalog.md",
    "context/01_engineering/experience_and_roles.md",
    "context/02_physical_performance/benchmarks_and_logs.md",
]

INLINE = re.compile(r"\[([A-Za-z_][A-Za-z0-9_]*)::\s*([^\]]*?)\s*\]")
BOLD_KEY = re.compile(r"\*\*([A-Za-z][A-Za-z0-9 ]*)\*\*::")


def main() -> None:
    total = 0
    for rel in TARGETS:
        path = ROOT / rel
        if not path.exists():
            print(f"SKIP (missing): {rel}")
            continue

        original = path.read_text(encoding="utf-8")
        n = len(INLINE.findall(original)) + len(BOLD_KEY.findall(original))

        text = INLINE.sub(r"\2", original)
        text = BOLD_KEY.sub(r"**\1:**", text)

        if text != original:
            path.write_text(text, encoding="utf-8")
            total += n
            print(f"CONVERTED {rel:<55} {n} fields")
        else:
            print(f"CLEAN     {rel}")

    print(f"\nTotal fields converted: {total}")


if __name__ == "__main__":
    main()
```

### 4.4 Fix the stale course statuses while you are here

Today is **2026-08-20**. Fall 2026 term has not started, so `In Progress` is wrong.
In `context/01_engineering/coursework_and_labs.md`, change the four Fall 2026 entries
(`M51A`, `102`, `EE 3`, `131A`) from `In Progress` to **`Enrolled`**.

Also retitle the section header that reads `### Systems & Hardware` etc. — leave those alone; only the status words change.

### 4.5 Run and VERIFY

```bash
python scripts/strip_dataview.py

# No Dataview syntax left anywhere
grep -rn '::' context --include=*.md | grep -v 'https\|http\|C:\|^Binary'   # -> no field syntax
grep -rn 'dataview' context --include=*.md                                  # -> no output

# Obsidian is gone
ls -d context/.obsidian 2>/dev/null                                         # -> No such file
ls context/00_meta/                                                         # -> no Dashboard.md

# Spot-check readability
sed -n '13,20p' context/01_engineering/coursework_and_labs.md
sed -n '3,6p'   context/01_engineering/experience_and_roles.md
```

Line 15 of `coursework_and_labs.md` should now read like:

```markdown
- **Fall 2024** Assembly Lang Prog/Comp Org (A): DVC course on low-level assembly language.
```

### 4.6 Commit

```bash
git add -A
git commit -m "refactor: remove Obsidian vault config, Dataview syntax, and dead Dashboard"
```

---

## PHASE 5 — Add YAML frontmatter

**Why:** this is what makes staleness detectable and lets `CLAUDE.md` route by metadata instead of by guesswork. `core_profile.md` already *orders* the AI to flag outdated info — this is the instrument that makes that possible.

### 5.1 Schema — exactly these 5 keys, no more

```yaml
---
updated: 2026-08-20
domain: engineering        # meta | engineering | physical | craft | operations | archive
stability: stable          # stable (rarely changes) | volatile (changes weekly)
summary: One sentence describing what is in this file.
read_when: Short phrase describing when an AI should open this file.
---
```

Keep it to 5 keys. More fields means more to maintain and this vault's failure mode is unmaintained fields.

### 5.2 Exact values for every file

Apply these verbatim. `updated: 2026-08-20` on all of them.

| File | domain | stability | summary | read_when |
|---|---|---|---|---|
| `00_meta/ai_directives.md` | meta | stable | Behavioral rules governing how AI assistants respond to Victor. | Always — load first, every session. |
| `00_meta/core_profile.md` | meta | stable | Identity facts: name, school, year, timezone, graduation timeline. | Always — load first, every session. |
| `00_meta/brand_and_voice.md` | meta | stable | Visual identity, color palette, portfolio links, logo concept. | Design, branding, portfolio, or personal-site work. |
| `01_engineering/career_targets.md` | engineering | stable | Target roles, company tiers, locations, graduation timeline. | Career strategy, job targeting, role fit questions. |
| `01_engineering/technical_standards.md` | engineering | stable | Preferred languages, tooling, OS, and code guidelines. | Writing or reviewing code; bootstrapping a project. |
| `01_engineering/coursework_and_labs.md` | engineering | volatile | All 26 courses with terms and grades, plus 5 physics lab summaries. | Academic background, prerequisite knowledge, transcript questions. |
| `01_engineering/experience_and_roles.md` | engineering | volatile | 4 professional and leadership roles with dates and contributions. | Resume work, interview prep, experience questions. |
| `01_engineering/project_catalog.md` | engineering | volatile | 4 projects with stack, architecture, lessons, and links. | Portfolio, resume bullets, or "what have you built" questions. |
| `02_physical_performance/benchmarks_and_logs.md` | physical | volatile | Dragon boat PRs, SPM targets, nutrition baseline, back rehab protocol. | Training, nutrition, recovery, or performance questions. |
| `02_physical_performance/training_blocks.md` | physical | stable | Weekly training split, strength program, technique focus, taper protocol. | Programming workouts or planning around training load. |
| `03_craft_and_creative/culinary_formulas.md` | craft | stable | Culinary skill level, target cuisines, dining-hall and home-cooking modes. | Cooking, baking, recipe, or nutrition-execution questions. |
| `03_craft_and_creative/fabrication_and_cad.md` | craft | stable | CAD stack, 3D printing setup, makerspace access, the Turret capstone. | CAD, 3D printing, hardware fabrication questions. |
| `04_operations/current_sprint.md` | operations | volatile | This week's goals, operating rules, and academic tracker. | **Always** — anything about current priorities or scheduling. |
| `04_operations/internship_pipeline.md` | operations | volatile | Application strategy, pipeline parameters, automated tracking system. | Internship applications, cover letters, interview prep. |
| `04_operations/logbook_archive.md` | operations | volatile | Past sprint summaries and a parking lot of future automation ideas. | Reviewing history or picking up a parked idea. |

For everything in `context/99_archive/`, use:

```yaml
---
updated: 2026-08-20
domain: archive
stability: stable
summary: <one line describing the document>
read_when: Only when explicitly asked for this specific document.
---
```

### 5.3 Method

Insert the block at the very top of each file, above the existing `# Heading`.
Do this file-by-file with an editor rather than a script — the `summary` and `read_when`
values differ per file and a script offers no advantage for 24 files.

**Do not modify any existing body content in this phase.**

### 5.4 VERIFY

```bash
# Every markdown file starts with ---
python -c "
import pathlib
bad=[str(p) for p in pathlib.Path('context').rglob('*.md')
     if not p.read_text(encoding='utf-8').startswith('---')]
print('MISSING FRONTMATTER:', bad if bad else 'none')"

# All 5 keys present in every file
python -c "
import pathlib
keys={'updated','domain','stability','summary','read_when'}
for p in sorted(pathlib.Path('context').rglob('*.md')):
    head=p.read_text(encoding='utf-8').split('---')[1]
    have={l.split(':')[0].strip() for l in head.strip().splitlines() if ':' in l}
    if not keys<=have: print('INCOMPLETE', p, sorted(keys-have))
print('done')"
```

### 5.5 Commit

```bash
git add -A
git commit -m "feat: add YAML frontmatter (updated/domain/stability/summary/read_when) to all files"
```

---

## PHASE 6 — Merge the AI directives into one file

**The problem:** behavioral rules are scattered across four files with duplication and one unresolved conflict.

| Source | What moves |
|---|---|
| `00_meta/core_profile.md` §2, §3, §4, §5 | communication style, anti-preferences, challenger directive, maintenance |
| `00_meta/interaction_modes.md` | all 4 domain modes (entire file) |
| `00_meta/brand_and_voice.md` §1 | tone rules — **duplicate** of core_profile §2, drop the copy |
| `01_engineering/technical_standards.md` §3 | testing / bootstrapping / style-guide rules |

**The conflict you must resolve:** `core_profile.md` §3 says *"Do not volunteer unsolicited, unrelated trivia or general advice."* §4 says *"Constantly challenge my ideas… mandatory to explicitly call out bad ideas… actively propose better architectures."* §4 is definitionally unsolicited advice. Every model resolves this differently and inconsistently.

The resolution below is baked into the new file. **Victor should confirm or edit the "Precedence" section** — it is the one judgment call in this migration.

### 6.1 Create `context/00_meta/ai_directives.md`

```markdown
---
updated: 2026-08-20
domain: meta
stability: stable
summary: Behavioral rules governing how AI assistants respond to Victor.
read_when: Always — load first, every session.
---

# AI Directives

These rules supersede default assistant behavior. They are the single source of truth for
*how* to respond. Facts about Victor live elsewhere; see `core_profile.md` and the numbered
domain folders.

## 1. Precedence

When directives conflict, apply in this order:

1. **Safety and factual accuracy** — never fabricate to satisfy a style rule.
2. **Technical judgment (§4 Challenger)** — on architecture, code, planning, and training
   decisions, unsolicited critique is *required*, not optional.
3. **Scope discipline (§3)** — everywhere else, answer exactly what was asked.

In short: **challenge the approach, not the topic.** Critique a chosen data structure, a
training split, or a sprint plan without being asked. Do not append general life advice,
unrelated trivia, or safety boilerplate.

## 2. Communication Style

- **Density:** Concise with structured analysis. For simple queries, extreme brevity.
- **Formatting:** Default to bullet points and logical outlines over long-form paragraphs.
  Prefer raw text and code representations. Use Mermaid diagrams for system visualization.
- **Summarization:** For long or complex prompts, lead with a TLDR.
- **Tone:** Technical, direct, efficient.

## 3. Anti-Preferences (hard guardrails)

- **No pleasantries.** No conversational filler, no introductory or closing fluff.
- **Answer the prompt exactly.** No unrelated trivia or general life advice.
  (Bounded by §1 — technical critique is in scope.)
- **Code must run.** Requested features ship working, bug-free, and tested.
- **MVP exception:** incomplete logic is acceptable *only* alongside a working MVP, and every
  gap must be heavily documented — what is missing, and how to implement it.

## 4. The Challenger Directive

- **Aggressive auditing.** Constantly challenge ideas.
- **Call out flaws.** Explicitly naming a bad idea or flawed logic is mandatory, not optional.
- **Constructive iteration.** Propose better architectures and optimizations for good ideas.

## 5. Domain Interaction Modes

Calibrate tone, depth, and analytical frame to the domain of the prompt.

### Engineering — `01_engineering/`
- Assume the technical baseline of a 2nd-year CS undergrad per coursework and resume.
  Skip rudimentary explanations.
- Enforce best practices; keep code heavily documented.
- Treat `01_engineering/` as an overview of overarching skills. Deep project-specific
  architecture belongs in the project's own repo, not here.

### Physical Performance — `02_physical_performance/`
- **Recovery first.** Be highly cognizant of total physical recovery and overtraining risk.
  Evaluate the body as a whole, not just CNS load.
- **Goal alignment.** Sub-2:00 weight-adjusted 500m split, balanced against team requirements.
- **Holistic support.** Training plans, dietary guidance, and recovery work together.

### Craft & Creative — `03_craft_and_creative/`
- Drop engineering-grade tolerances. Shift to a qualitative, flow-state approach for
  recipes, baking, and creative builds.

### Operations & Planning — `04_operations/`
- **Aggressive realism.** Audit schedules strictly for realism; refuse to rubber-stamp overload.
- **Student context.** Balance that strictness against an ambitious student running several
  demanding tracks at once.
- **Milestone tracking.** Plan against active milestones on a ~30-day sprint cycle.

## 6. Engineering Project Rules

- **Testing:** automated tests written and run after any feature is added. Active projects
  maintain a large test bank that runs continuously during development.
- **Bootstrapping:** every new software project is initialized with a `context.md` stating
  project expectations.
- **Style guides:** Victor is currently unopinionated. When initializing a project, outline
  the tradeoffs (e.g. PEP 8 vs Google) so he can choose deliberately.

## 7. Context Maintenance

- **Audience:** this vault targets general AI assistants first, code copilots second.
- **Chronology:** all skills, projects, and updates are dated. Dates are ISO 8601.
- **Active updates:** when you detect contradictory or outdated information in these files
  during a session, say so and prompt Victor to update it. Check the `updated:` field in
  frontmatter — a `volatile` file older than ~14 days should be treated as suspect.
```

### 6.2 Rewrite `context/00_meta/core_profile.md` to identity facts only

```markdown
---
updated: 2026-08-20
domain: meta
stability: stable
summary: Identity facts — name, school, year, timezone, graduation timeline.
read_when: Always — load first, every session.
---

# Core Profile

Identity facts only. Behavioral rules live in `ai_directives.md`.

- **Name:** Victor Gusev
- **Academic stage:** 2nd-year undergraduate, B.S. Computer Science and Engineering, UCLA
- **Admitted:** 2025-09
- **Expected graduation:** 2028-06 (3-year fast track)
- **Post-graduation intent:** Master's degree
- **Timezone:** PST (America/Los_Angeles)
- **GPA:** TODO — see Open Questions §10
- **Primary OS:** Windows
```

### 6.3 Trim `brand_and_voice.md`

Delete section `## 1. System AI Directives` — it duplicates §2 of the new `ai_directives.md`.
Keep sections 2 (Personal Identity & Portfolio) and 3 (Aesthetic Guidelines). Renumber to 1 and 2.

### 6.4 Trim `technical_standards.md`

Delete section `## 3. Project & Code Guidelines` — it now lives in `ai_directives.md` §6.
Keep sections 1 (Programming Languages) and 2 (Environment & Tooling).

### 6.5 Archive the source file

```bash
git mv context/00_meta/interaction_modes.md context/99_archive/superseded/interaction_modes.md
```

### 6.6 VERIFY

```bash
ls context/00_meta/          # -> ai_directives.md, brand_and_voice.md, core_profile.md  (3 files)
grep -c 'Precedence' context/00_meta/ai_directives.md               # -> 1
grep -c 'System AI Directives' context/00_meta/brand_and_voice.md   # -> 0
grep -c 'Project & Code Guidelines' context/01_engineering/technical_standards.md  # -> 0
```

### 6.7 Commit

```bash
git add -A
git commit -m "refactor: consolidate scattered AI directives into 00_meta/ai_directives.md"
```

---

## PHASE 7 — Fix contradictions

### 7.1 GPA conflict — **REQUIRES VICTOR**

- `context/99_archive/resume.md` line 7 → **3.64 / 4.00**
- `context/99_archive/old_resume.md` → **3.89 / 4.00**

Neither appears in any live file. GPA is one of the most-requested facts in an internship pipeline and it currently lives only in a superseded archive document.

**Action:** ask Victor which is current. Put the answer in `core_profile.md` (replacing the `TODO`). Do **not** guess (**R3**).

### 7.2 Confidentiality contradiction — **REQUIRES VICTOR**

`project_catalog.md` states:

> **Dimaag.ai**: Contains sensitive content; project details are abridged in the resume and kept confidential.

But `experience_and_roles.md` and `resume.md` both publish specifics: PPO training pipelines, 2D LiDAR raycasting, domain randomization in NVIDIA Isaac Lab, sim-to-real validation, **>12 mph tracking at sub-decimeter accuracy**.

The rule claims a constraint that the vault does not enforce — which tells an AI the constraint is already satisfied, so it will reuse those specifics in cover letters or portfolio copy without asking.

**Action:** ask Victor which is true, then make the vault match:
- **If the details are fine to share** → soften the `project_catalog.md` note to say what is actually off-limits (e.g. internal codenames, client names, source code).
- **If they are not** → move the specifics behind a generic description and record the full version in `context/99_archive/` with a clear `confidential: true` marker.

Either way, the rule and the content must agree.

### 7.3 Resume canon — mechanical, no decision needed

Declare `experience_and_roles.md` + `project_catalog.md` the source of truth; the resume is a
*generated view* of them.

```bash
mkdir -p context/99_archive/superseded
git mv context/99_archive/old_resume.md context/99_archive/superseded/old_resume.md
```

Add to the top of `context/99_archive/resume.md`, below its frontmatter:

```markdown
> **Not canonical.** Source of truth is `01_engineering/experience_and_roles.md` and
> `01_engineering/project_catalog.md`. Regenerate this file from those; do not edit it directly.
```

### 7.4 Replace the stale architecture map

`context/99_archive/brain_structure.md` describes a structure that no longer exists — it places
`brand_and_voice.md` in `03_craft_and_creative/`, specs a `compiled_master.md` that was never
built, and omits 6 real files. A wrong map is worse than none, because an agent that finds it
will trust it.

```bash
git mv context/99_archive/brain_structure.md context/99_archive/superseded/brain_structure.md
```

It is replaced by `README.md` in Phase 8.

### 7.5 Commit

```bash
git add -A
git commit -m "fix: establish canonical sources, archive superseded resume and stale structure map"
```

---

## PHASE 8 — Write the AI entry point

**This is the phase that actually delivers the project's stated purpose.** Everything before it was cleanup.

### 8.1 Create `CLAUDE.md` at repo root

```markdown
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
| Who Victor is, school, year, timezone | `00_meta/core_profile.md` |
| How to respond, tone, domain mode | `00_meta/ai_directives.md` |
| Design, branding, colors, portfolio site | `00_meta/brand_and_voice.md` |
| Target roles, companies, locations, timeline | `01_engineering/career_targets.md` |
| Languages, tooling, OS, code standards | `01_engineering/technical_standards.md` |
| Courses, grades, academic background, labs | `01_engineering/coursework_and_labs.md` |
| Jobs, internships, leadership roles | `01_engineering/experience_and_roles.md` |
| Projects, portfolio, "what have you built" | `01_engineering/project_catalog.md` |
| Dragon boat, erg, PRs, nutrition, recovery | `02_physical_performance/benchmarks_and_logs.md` |
| Workout programming, weekly split, tapering | `02_physical_performance/training_blocks.md` |
| Cooking, baking, recipes, dining hall | `03_craft_and_creative/culinary_formulas.md` |
| CAD, 3D printing, makerspace, the Turret | `03_craft_and_creative/fabrication_and_cad.md` |
| This week's priorities, scheduling | `04_operations/current_sprint.md` |
| Applications, cover letters, interview prep | `04_operations/internship_pipeline.md` |
| Past sprints, parked automation ideas | `04_operations/logbook_archive.md` |

## Rules for reading this vault

- **Never glob `context/99_archive/`.** It holds full lab reports, superseded resumes, and
  transcripts. Open a file there only when Victor names that specific document. The one-line
  summaries in `01_engineering/coursework_and_labs.md` are sufficient for every normal question.
- **Never read `context/assets/`.** Binary images only.
- **Check the `updated:` frontmatter field.** A file marked `stability: volatile` whose
  `updated:` date is more than ~14 days old should be treated as suspect — say so rather than
  presenting it as current fact.
- **Canonical sources:** career facts come from `experience_and_roles.md` and
  `project_catalog.md`, never from `99_archive/resume.md`.
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
├── assets/labs/              extracted lab report images (binary)
└── 99_archive/               full lab reports, transcripts, superseded docs
```
```

### 8.2 Create `AGENTS.md`

A byte-identical copy, so non-Claude agents find the same entry point.

```bash
cp CLAUDE.md AGENTS.md
```

> Windows symlinks need admin rights, so copy rather than link. Note in `README.md` that
> the two must be kept in sync.

### 8.3 Create `README.md` at repo root

```markdown
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
```

### 8.4 VERIFY

```bash
ls CLAUDE.md AGENTS.md README.md              # all three exist
diff CLAUDE.md AGENTS.md                      # -> no output (identical)

# Every file named in the routing table actually exists
python -c "
import re,pathlib
t=pathlib.Path('CLAUDE.md').read_text(encoding='utf-8')
missing=[m for m in re.findall(r'\`(context/[^\`]+\.md)\`|\| \`(0\d_[^\`]+\.md)\`',t) for m in m if m]
for rel in re.findall(r'\`(0\d_[a-z_]+/[a-z_]+\.md)\`',t):
    p=pathlib.Path('context')/rel
    if not p.exists(): print('MISSING:',p)
print('routing table checked')"
```

### 8.5 Commit

```bash
git add -A
git commit -m "feat: add CLAUDE.md/AGENTS.md entry point with routing table, plus README"
```

---

## PHASE 9 — Freshness audit script

Makes the maintenance clause in `ai_directives.md` §7 executable.

### 9.1 `scripts/audit_freshness.py`

```python
"""Report context files whose `updated:` date is overdue.

Thresholds: volatile -> 14 days, stable -> 180 days.
Exit code 1 if anything is stale (usable in a pre-commit hook or cron).
"""
import datetime as dt
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
CONTEXT = ROOT / "context"
THRESHOLDS = {"volatile": 14, "stable": 180}

FRONTMATTER = re.compile(r"\A---\s*\n(.*?)\n---\s*\n", re.DOTALL)


def field(block: str, key: str) -> str | None:
    match = re.search(rf"^{key}:\s*(.+?)\s*$", block, re.MULTILINE)
    return match.group(1) if match else None


def main() -> int:
    today = dt.date.today()
    stale, missing = [], []

    for path in sorted(CONTEXT.rglob("*.md")):
        if "99_archive" in path.parts:
            continue

        header = FRONTMATTER.match(path.read_text(encoding="utf-8"))
        if not header:
            missing.append(path)
            continue

        block = header.group(1)
        raw_date = field(block, "updated")
        stability = (field(block, "stability") or "stable").strip()

        try:
            updated = dt.date.fromisoformat(raw_date)
        except (TypeError, ValueError):
            missing.append(path)
            continue

        age = (today - updated).days
        limit = THRESHOLDS.get(stability, 180)
        if age > limit:
            stale.append((age, limit, stability, path))

    for path in missing:
        print(f"NO METADATA  {path.relative_to(ROOT)}")

    for age, limit, stability, path in sorted(stale, reverse=True):
        print(f"STALE  {age:>4}d (limit {limit:>3}d, {stability:<8}) "
              f"{path.relative_to(ROOT)}")

    if not stale and not missing:
        print("All context files are fresh.")
        return 0

    print(f"\n{len(stale)} stale, {len(missing)} missing metadata")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
```

### 9.2 Run and VERIFY

```bash
python scripts/audit_freshness.py
```

Immediately after migration everything was stamped `2026-08-20`, so this should print
**`All context files are fresh.`** and exit 0. If it reports missing metadata, Phase 5 was
incomplete — go back and finish it.

### 9.3 Commit

```bash
git add -A
git commit -m "feat: add freshness audit script"
```

---

## PHASE 10 — Final verification

Run every check. All must pass.

```bash
cd /c/Users/gusev/Documents/2ndMind

echo "--- 1. Size: total markdown should be ~210 KB, not 3.1 MB ---"
find context -name '*.md' -exec cat {} \; | wc -c

echo "--- 2. No base64 anywhere ---"
grep -rc 'base64' context --include=*.md | grep -v ':0' || echo "CLEAN"

echo "--- 3. No Obsidian remnants ---"
ls -d context/.obsidian 2>/dev/null || echo "CLEAN"
grep -rn 'dataview' context --include=*.md || echo "CLEAN"

echo "--- 4. No export corruption ---"
grep -rc 'cite_start\|\[cite:' context --include=*.md | grep -v ':0' || echo "CLEAN"

echo "--- 5. Entry points exist and match ---"
ls CLAUDE.md AGENTS.md README.md && diff -q CLAUDE.md AGENTS.md && echo "IDENTICAL"

echo "--- 6. Frontmatter complete ---"
python scripts/audit_freshness.py

echo "--- 7. 63 images extracted ---"
ls context/assets/labs/*.png | wc -l

echo "--- 8. Git history clean, one commit per phase ---"
git log --oneline
git status --porcelain || echo "CLEAN TREE"

echo "--- 9. Live context fits in a small budget ---"
find context -name '*.md' -not -path '*/99_archive/*' -exec cat {} \; | wc -c
```

**Expected results**

| Check | Expected |
|---|---|
| 1. Total markdown | ~210,000 B (was 3,099,621) |
| 2. base64 | CLEAN |
| 3. Obsidian | CLEAN |
| 4. Corruption | CLEAN |
| 5. Entry points | 3 files, CLAUDE.md ≡ AGENTS.md |
| 6. Frontmatter | "All context files are fresh." |
| 7. Images | 63 |
| 8. Git | ~9 commits, clean tree |
| 9. Live context | ~28,000 B (~7k tokens) |

### Final smoke test — the one that actually matters

Start a fresh AI session in this repo and ask three questions:

1. *"What is Victor working on this week?"* → should read `current_sprint.md`, and should say the file is empty rather than inventing an answer.
2. *"What's his experience with reinforcement learning?"* → should read `experience_and_roles.md` and cite the Dimaag internship, **without** reading a single lab report.
3. *"Draft a cover letter for a robotics internship."* → should pull from `career_targets.md`, `experience_and_roles.md`, and `internship_pipeline.md`, and should apply the "1 High-Priority" tailoring rule.

If it reads `99_archive/` for any of these, `CLAUDE.md` needs a stronger prohibition.

```bash
git tag post-migration
```

---

## §10. OPEN QUESTIONS FOR VICTOR

Collect answers, then apply. **Do not guess any of these (R3).**

| # | Question | Blocks | Where the answer goes |
|---|---|---|---|
| 1 | **GPA: 3.64 or 3.89?** `resume.md` and `old_resume.md` disagree. | Phase 7.1 | `00_meta/core_profile.md` |
| 2 | **Are the Dimaag.ai technical specifics shareable?** (PPO, Isaac Lab, >12 mph, sub-decimeter) The vault says confidential but publishes them in two files. | Phase 7.2 | `01_engineering/project_catalog.md` |
| 3 | **Confirm the §1 Precedence rule** in `ai_directives.md` — "challenge the approach, not the topic." Resolves the §3-vs-§4 conflict. | Phase 6 | `00_meta/ai_directives.md` |
| 4 | **Fall 2026 course list** — are `M51A`, `102`, `EE 3`, `131A` still the enrolled set? | Phase 4.4 | `01_engineering/coursework_and_labs.md` |

---

## §11. DELIBERATELY NOT DOING

Listed so the executor does not "helpfully" add them.

| Not doing | Why |
|---|---|
| One-file-per-entity split (26 courses, 4 projects…) | Only existed to make Dataview queryable. Obsidian is gone, so it is pure overhead — more files to read means slower AI context loading, not faster. |
| `compiled_master.md` bundle generator | Only needed for pasting into chat AIs with no filesystem. Victor uses filesystem agents. |
| Retrieval layer / MCP server | Live context is ~7k tokens. It fits in a single prompt. Retrieval would be strictly slower. Revisit past ~50k tokens. |
| Filling the 15 `TBD` placeholders (culinary formulas, sprint goals) | Content authoring, not migration. Victor's call. |
| PII redaction (phone number, transcripts) | Vault is local-only and never leaves the machine. |
| Converting the 3 PDFs to markdown | Nice to have, not blocking. Do it later if transcript data is ever needed. |

---

## §12. AFTER MIGRATION — keeping it alive

The migration fixes structure. Structure decays without a ritual. The single highest-value habit:

**Every Sunday (~10 minutes):**

1. Fill in `context/04_operations/current_sprint.md` — three goals, one per domain.
2. Append last week's closed items to `context/04_operations/logbook_archive.md`.
3. Bump `updated:` on both files.
4. `python scripts/audit_freshness.py` — fix anything it flags.
5. `git add -A && git commit -m "chore: sprint YYYY-MM-DD"`

`current_sprint.md` is currently **empty**, and it is the single highest-leverage file in the
vault. Every other file describes configuration that rarely changes; this one describes what is
actually happening. An AI that can recite the race-taper protocol but cannot name one thing
Victor is working on today is not delivering the point of this project.
