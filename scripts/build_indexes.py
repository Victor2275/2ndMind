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

    # One table in Victor's own order. Tiers were removed on 2026-08-29 (D-107) - they
    # published a ranking he did not want published, and the order he wanted was not
    # derivable from tier-then-year.
    out.append("| # | Project | Status | Year | Category | Stack | Links |")
    out.append("|---|---|---|---|---|---|---|")
    for e in sorted(entries, key=lambda x: (int(x.get("order", 99)), -int(x.get("year", 0)))):
        out.append(
            "| {order} | [{title}]({path}) | {status} | {year} | {category} | {stack} | {links} |".format(
                order=e.get("order", "-"),
                title=e["title"],
                path=e["_path"],
                status=e.get("status", "-"),
                year=e.get("year", "-"),
                category=e.get("category", "-"),
                stack=", ".join(e.get("stack", [])) or "-",
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
    # Victor's explicit order, matching the site (D-121). A generated index that
    # contradicts the page it summarises is worse than no index.
    for e in sorted(entries, key=lambda x: (int(x.get("order", 99)), str(x.get("date_start", "")))):
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


def build_labs_section(entries: list[dict]) -> str:
    """Rows for the marked labs block inside coursework_and_labs.md."""
    out = [
        "| Lab | Date | Focus | Hardware |",
        "|---|---|---|---|",
    ]
    for e in sorted(entries, key=lambda x: str(x.get("date", ""))):
        out.append(
            "| [{title}]({path}) | {date} | {summary} | {stack} |".format(
                title=e["title"],
                path=e["_path"],
                date=e.get("date", "—"),
                summary=e.get("summary", "—"),
                stack=", ".join(e.get("stack", [])) or "—",
            )
        )
    out.append("")
    out.append("Full reports live in `99_archive/`; figures in `assets/labs/`.")
    return "\n".join(out)


def replace_marked(path: Path, marker: str, body: str) -> str:
    """Swap the content between <!-- BEGIN:marker --> and <!-- END:marker -->."""
    text = path.read_text(encoding="utf-8")
    begin, end = f"<!-- BEGIN:{marker} -->", f"<!-- END:{marker} -->"
    if begin not in text or end not in text:
        raise SystemExit(f"{path} is missing the {marker} markers")
    head = text[: text.index(begin) + len(begin)]
    tail = text[text.index(end) :]
    return f"{head}\n{body}\n{tail}"


def fmt_resume_date(value) -> str:
    """2026-06 -> June 2026. A bare year passes through."""
    text = str(value)
    parts = text.split("-")
    if len(parts) < 2:
        return text
    month = dt.date(int(parts[0]), int(parts[1]), 1)
    return month.strftime("%B %Y")


def resume_entries(entries: list[dict], variant: str, org_key: str, date_fn) -> list[dict]:
    out = []
    for e in entries:
        if variant not in (e.get("resume_variants") or []):
            continue
        if not e.get("bullets"):
            continue
        if e.get("draft"):
            continue
        out.append(
            {
                "title": e["title"],
                "org": e.get(org_key) or e.get("category") or "",
                "dates": date_fn(e),
                "bullets": e["bullets"],
            }
        )
    return out


def build_resume(config: dict) -> str:
    """All three resume variants as one archived reference document.

    The site renders these from web/src/lib/resume.ts; this is the vault's copy so an AI
    reading the vault alone still sees the resume. A test in the web app asserts the two
    agree on which entries each variant contains, which is what keeps the duplicate
    implementation honest.
    """
    today = dt.date.today().isoformat()
    profile = load_single(ROOT / "context" / "00_meta" / "core_profile.md")
    projects = load_entries(ENG / "projects")
    experience = load_entries(ENG / "experience")
    labs = load_entries(ENG / "labs")

    out = [
        "---",
        f"updated: {today}",
        "domain: archive",
        "stability: stable",
        "summary: Generated resume, all three variants. Not canonical for any entry.",
        "read_when: Only when explicitly asked for this specific document.",
        "---",
        "",
        GENERATED_BANNER.format(src="01_engineering/{projects,experience,labs}"),
        "",
        f"# {profile['name']}",
        "",
        "{} | [{}](mailto:{}) | [LinkedIn]({}) | [GitHub]({})".format(
            profile["contact"]["phone"],
            profile["contact"]["email"],
            profile["contact"]["email"],
            profile["contact"]["linkedin"],
            profile["contact"]["github"],
        ),
        "",
    ]

    for variant in config["variants"]:
        vid = variant["id"]
        out += [f"## {variant['label']} variant", "", f"*{variant['headline']}*", ""]

        out += [
            "### Education",
            "",
            f"**{profile['school']}** - {profile['degree']}  ",
            "Expected {} - GPA {:.2f} / {:.2f}  ".format(
                fmt_resume_date(profile["graduation"]),
                profile["gpa"],
                profile["gpa_scale"],
            ),
            "*Coursework:* " + ", ".join(config["coursework"]),
            "",
            "### Technical Skills",
            "",
        ]
        for group in config["skills"]:
            if vid in group["variants"]:
                out.append(f"**{group['group']}:** " + ", ".join(group["items"]) + "  ")
        out.append("")

        roles = resume_entries(
            experience,
            vid,
            "org",
            lambda e: "{} - {}".format(
                fmt_resume_date(e["date_start"]), fmt_resume_date(e["date_end"])
            ),
        )
        builds = resume_entries(projects, vid, "event", lambda e: str(e["year"]))
        builds += resume_entries(labs, vid, "course", lambda e: fmt_resume_date(e["date"]))
        builds.sort(key=lambda x: x["dates"], reverse=True)

        for heading, group in (("Experience", roles), ("Projects", builds)):
            if not group:
                continue
            out += [f"### {heading}", ""]
            for entry in group:
                out += [f"**{entry['title']}** | *{entry['org']}* - {entry['dates']}", ""]
                out += [f"- {b}" for b in entry["bullets"]]
                out.append("")

        out.append("---")
        out.append("")

    return "\n".join(out).rstrip() + "\n"


def load_single(path: Path) -> dict:
    raw = path.read_text(encoding="utf-8")
    _, fm, _ = raw.split("---", 2)
    return yaml.safe_load(fm)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="verify without writing")
    args = parser.parse_args()

    coursework = ENG / "coursework_and_labs.md"
    resume_config = load_single(ENG / "resume_config.md")
    targets = {
        ROOT / "context" / "99_archive" / "resume.md": build_resume(resume_config),
        ENG / "project_catalog.md": build_projects(load_entries(ENG / "projects")),
        ENG / "experience_and_roles.md": build_experience(load_entries(ENG / "experience")),
        coursework: replace_marked(
            coursework, "labs", build_labs_section(load_entries(ENG / "labs"))
        ),
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
