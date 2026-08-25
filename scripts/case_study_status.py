"""Reports which case-study sections are still unwritten, per project.

V2_PLAN §1.3 is the last item blocking the portfolio, and it is Victor's alone: an agent
filling in a `> **To write:**` prompt produces D-069, which is fabricated technical detail on
a hiring-facing page. So this counts the work rather than doing it.

A section counts as written when it has prose under it that is not a prompt. That is the same
rule `dropUnwritten` applies in `web/src/lib/vault/public.ts`, so what this reports as written
is exactly what the public site will publish.

    python scripts/case_study_status.py

Exits non-zero while anything is still unwritten, so it can gate a release check.
"""

from __future__ import annotations

import glob
import io
import os
import re

# Strongest first, per V2_PLAN §1.3 — the order that gets the most portfolio value soonest.
SUGGESTED = [
    "solenoid-bit-reader",
    "proof",
    "water-bottle-scale",
    "taskable",
    "micromouse-simulator",
    "five-second-rule",
]

# `## Notes` is internal plumbing and is stripped from public output; it is not a case-study
# section and must not be counted as one.
IGNORED = {"notes"}

HEADING = re.compile(r"^##[ \t]+(.+?)[ \t]*$")
PROMPT = re.compile(r"^>[ \t]*\*\*To write:?\*\*", re.IGNORECASE)


def sections(path: str) -> list[tuple[str, bool]]:
    """Returns (heading, is_written) for each section, in file order."""
    raw = io.open(path, encoding="utf-8").read().replace("\r\n", "\n")
    body = raw.split("---\n", 2)[-1]

    found: list[tuple[str, list[str]]] = []
    for line in body.split("\n"):
        match = HEADING.match(line)
        if match:
            found.append((match.group(1), []))
        elif found:
            found[-1][1].append(line)

    out = []
    for heading, lines in found:
        if heading.strip().lower() in IGNORED:
            continue
        text = "\n".join(lines).strip()
        written = bool(text) and not PROMPT.match(text)
        out.append((heading, written))
    return out


def main() -> int:
    rows = []
    for path in glob.glob("context/01_engineering/projects/*.md"):
        slug = os.path.basename(path)[:-3]
        entries = sections(path)
        missing = [h for h, written in entries if not written]
        draft = "draft: true" in io.open(path, encoding="utf-8").read()
        rows.append((slug, len(entries) - len(missing), len(entries), missing, draft))

    rows.sort(key=lambda r: (SUGGESTED.index(r[0]) if r[0] in SUGGESTED else 99))

    outstanding = 0
    print(f"{'project':<24} {'written':>9}  still to write")
    print("-" * 88)
    for slug, done, total, missing, draft in rows:
        outstanding += len(missing)
        flag = "  [draft: off every resume]" if draft else ""
        print(f"{slug:<24} {done:>4}/{total:<4}  {', '.join(missing) or '- complete -'}{flag}")

    print()
    if outstanding == 0:
        print("Every case-study section is written.")
        return 0
    print(f"{outstanding} section(s) still to write. The prompts are in each file.")
    print("No agent writes these: see DECISIONS.md D-073, and D-069 for why.")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
