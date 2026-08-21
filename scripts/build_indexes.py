#!/usr/bin/env python3
"""Regenerate the project and experience index files from per-entry sources.

`context/01_engineering/projects/*.md` and `experience/*.md` are canonical. The two
index files this script writes exist so an AI assistant can get the whole picture from
one read instead of eight, and are never edited by hand.

Usage:
    python scripts/build_indexes.py           # write the indexes
    python scripts/build_indexes.py --check   # exit 1 if they are out of date

Always uses UTF-8 explicitly: Windows defaults to cp1252 and corrupts the characters
present in these files.
"""

from __future__ import annotations

import argparse
import datetime as dt
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
ENG = ROOT / "context" / "01_engineering"

GENERATED_BANNER = (
    "> **Generated file — do not edit.** Source of truth is `{src}/`.\n"
    "> Regenerate with `python scripts/build_indexes.py`."
)


def load_entries(folder: Path) -> list[dict]:
    """Parse frontmatter from every markdown file in `folder`."""
    entries = []
    for path in sorted(folder.glob("*.md")):
        raw = path.read_text(encoding="utf-8")
        if not raw.startswith("---"):
            raise SystemExit(f"{path} has no frontmatter")
        _, fm, _ = raw.split("---", 2)
        data = yaml.safe_load(fm)
        data["_path"] = path.relative_to(ENG).as_posix()
        entries.append(data)
    return entries


def fmt_links(links: dict | None) -> str:
    if not links:
        return "—"
    labels = {"live": "Live", "github": "GitHub", "itch": "Itch.io", "org": "Org"}
    return " · ".join(
        f"[{labels.get(k, k.title())}]({v})" for k, v in links.items()
    )


def build_projects(entries: list[dict]) -> str:
    today = dt.date.today().isoformat()
    out = [
        "---",
        f"updated: {today}",
        "domain: engineering",
        "stability: volatile",
        "summary: Generated index of all projects. Canonical data lives in projects/.",
        'read_when: Portfolio, resume bullets, or "what have you built" questions.',
        "---",
        "",
        GENERATED_BANNER.format(src="projects"),
        "",
        "# Project Catalog",
        "",
    ]

    for tier in sorted({e.get("tier", 99) for e in entries}):
        tier_entries = [e for e in entries if e.get("tier") == tier]
        if not tier_entries:
            continue
        out.append(f"## Tier {tier}")
        out.append("")
        out.append("| Project | Status | Year | Category | Stack | Links |")
        out.append("|---|---|---|---|---|---|")
        for e in sorted(tier_entries, key=lambda x: (-int(x.get("year", 0)), x["title"])):
            out.append(
                "| [{title}]({path}) | {status} | {year} | {category} | {stack} | {links} |".format(
                    title=e["title"],
                    path=e["_path"],
                    status=e.get("status", "—"),
                    year=e.get("year", "—"),
                    category=e.get("category", "—"),
                    stack=", ".join(e.get("stack", [])) or "—",
                    links=fmt_links(e.get("links")),
                )
            )
        out.append("")

    out += [
        "## Confidentiality Notes",
        "",
        "- **Dimaag.ai**: see `experience/dimaag.md`, field `confidential_scope`. The",
        "  documented technical scope is shareable; anything beyond it is deliberately not",
        "  recorded in this vault. Say so rather than speculating.",
        "",
        "## Hardware & CAD Models",
        "",
        "- None documented yet. The Turret (see `03_craft_and_creative/fabrication_and_cad.md`)",
        "  is the intended first entry. FIRST Robotics models may be added later.",
        "",
    ]
    return "\n".join(out)


def build_experience(entries: list[dict]) -> str:
    today = dt.date.today().isoformat()
    out = [
        "---",
        f"updated: {today}",
        "domain: engineering",
        "stability: volatile",
        "summary: Generated index of professional and leadership roles. Canonical data lives in experience/.",
        "read_when: Resume work, interview prep, experience questions.",
        "---",
        "",
        GENERATED_BANNER.format(src="experience"),
        "",
        "# Professional Experience and Roles",
        "",
        "| Role | Organization | Type | Start | End | On CV |",
        "|---|---|---|---|---|---|",
    ]
    for e in sorted(entries, key=lambda x: str(x.get("date_start", "")), reverse=True):
        variants = e.get("resume_variants") or []
        out.append(
            "| [{title}]({path}) | {org} | {type} | {start} | {end} | {cv} |".format(
                title=e["title"],
                path=e["_path"],
                org=e.get("org", "—"),
                type=e.get("type", "—"),
                start=e.get("date_start", "—"),
                end=e.get("date_end", "—"),
                cv=", ".join(variants) if variants else "no",
            )
        )
    out.append("")
    return "\n".join(out)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="verify without writing")
    args = parser.parse_args()

    targets = {
        ENG / "project_catalog.md": build_projects(load_entries(ENG / "projects")),
        ENG / "experience_and_roles.md": build_experience(load_entries(ENG / "experience")),
    }

    stale = []
    for path, content in targets.items():
        current = path.read_text(encoding="utf-8") if path.exists() else None
        if current == content:
            continue
        if args.check:
            stale.append(path.relative_to(ROOT).as_posix())
        else:
            path.write_text(content, encoding="utf-8")
            print(f"wrote {path.relative_to(ROOT).as_posix()}")

    if stale:
        print("STALE (run: python scripts/build_indexes.py):", *stale, sep="\n  ")
        return 1
    if args.check:
        print("indexes are up to date")
    return 0


if __name__ == "__main__":
    sys.exit(main())
