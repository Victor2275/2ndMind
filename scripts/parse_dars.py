"""Turns a saved UCLA DARS audit into `context/01_engineering/degree_audit.md`.

Why a derived file rather than reading the audit directly:

The saved DARS page carries Victor's student ID, his high school, every grade he has ever
received, and roughly 900 KB of page furniture. The site needs none of that — the private
Academics page needs to know which requirements are unfulfilled and what satisfies them.
So the parse happens here, once, on this machine, and the site reads a small derived file
that never contained the identifiers in the first place.

It also means the audit is not a runtime dependency. `99_archive/` is deliberately excluded
from the Next.js file trace (see `web/next.config.ts`), so a page that read the raw HTML
would work locally and 404 in production — the exact failure mode that exclusion exists to
document.

Usage:
    python scripts/parse_dars.py path/to/DARS.html

Re-run it whenever a fresh audit is saved. The output is generated; edit the audit, not it.
"""

from __future__ import annotations

import html
import io
import os
import re
import sys
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "context", "01_engineering", "degree_audit.md")

# A course row arrives as five consecutive lines: term, "DEPT NUM", units, grade, title.
TERM = re.compile(r"^(FA|WI|SP|SU)\d{2}$")
UNITS = re.compile(r"^\d+\.\d{2}$")
STATUSES = ("Complete", "In Progress", "Unfulfilled", "Planned")


def to_text(raw: str) -> list[str]:
    """HTML to a flat list of non-empty lines, which is the shape DARS renders in."""
    # Tags collapse to a space, not a newline: DARS puts a whole labelled row on one source
    # line ("Requirement Unfulfilled Requirement Unfulfilled -->"), and splitting on tags
    # would shred exactly the markers this parser keys on.
    raw = re.sub(r"(?is)<(script|style)[^>]*>.*?</\1>", " ", raw)
    text = html.unescape(re.sub(r"(?s)<[^>]+>", " ", raw))
    text = re.sub(r"[ \t]+", " ", text)
    return [ln.strip() for ln in text.split("\n") if ln.strip()]


def status_of(line: str, kind: str) -> str | None:
    """`Requirement Unfulfilled Requirement Unfulfilled -->` -> "Unfulfilled"."""
    if not line.startswith(kind + " ") and line != kind + " " + kind + " -->":
        return None
    for s in STATUSES:
        if line.startswith(f"{kind} {s} {kind} {s}"):
            return s
    if line.startswith(f"{kind} {kind}"):
        return "Unfulfilled"
    return None


def parse(lines: list[str]) -> dict:
    audit: dict = {"prepared": None, "major": None, "requirements": []}

    for i, ln in enumerate(lines):
        if ln.startswith("Audit Prepared On"):
            m = re.search(r"(\d{2})/(\d{2})/(\d{4})", ln)
            if m:
                audit["prepared"] = f"{m.group(3)}-{m.group(1)}-{m.group(2)}"
        if ln == "MAJOR1" and i + 3 < len(lines):
            audit["major"] = lines[i + 3]

    req = None
    sub = None
    i = 0
    while i < len(lines):
        ln = lines[i]

        st = status_of(ln, "Requirement")
        if st and not ln.startswith("Sub-"):
            title = lines[i + 1] if i + 1 < len(lines) else ""
            req = {"title": title, "status": st, "subs": []}
            audit["requirements"].append(req)
            sub = None
            i += 2
            continue

        st = status_of(ln, "Sub-Requirement")
        if st and req is not None:
            title = lines[i + 1] if i + 1 < len(lines) else ""
            sub = {"title": title, "status": st, "needs": [], "options": [], "courses": []}
            req["subs"].append(sub)
            i += 2
            continue

        if sub is not None and ln == "NEEDS:":
            j = i + 1
            parts: list[str] = []
            while j < len(lines) and lines[j] not in ("SELECT FROM:", "-> NOT FROM:") \
                    and not lines[j].startswith(("Requirement", "Sub-Requirement")):
                parts.append(lines[j])
                j += 1
            sub["needs"] = " ".join(parts).strip()
            i = j
            continue

        if sub is not None and ln in ("SELECT FROM:", "-> NOT FROM:"):
            key = "options" if ln == "SELECT FROM:" else "excluded"
            j = i + 1
            parts = []
            while j < len(lines) and not lines[j].startswith(
                ("Requirement", "Sub-Requirement", "NEEDS:", "SELECT FROM:", "-> NOT FROM:")
            ):
                parts.append(lines[j])
                j += 1
            sub[key] = " ".join(parts).strip()
            i = j
            continue

        # A taken/in-progress course.
        if (
            sub is not None
            and TERM.match(ln)
            and i + 4 < len(lines)
            and UNITS.match(lines[i + 2])
        ):
            sub["courses"].append(
                {
                    "term": ln,
                    "code": lines[i + 1],
                    "units": lines[i + 2],
                    "grade": lines[i + 3],
                    "title": lines[i + 4],
                }
            )
            i += 5
            continue

        i += 1

    return audit


# A GE subgroup's "SELECT FROM" is every qualifying course at UCLA — thousands of codes,
# tens of kilobytes, and unreadable. The useful part is the first screenful plus how much
# was left; the audit itself is the place to go for the rest.
OPTIONS_LIMIT = 320


def shorten(options: str) -> str:
    if len(options) <= OPTIONS_LIMIT:
        return options
    head = options[:OPTIONS_LIMIT].rsplit(",", 1)[0].strip().rstrip(",")
    remaining = options.count(",") - head.count(",")
    return f"{head}, … and ~{remaining} more (see the audit)"


def render(audit: dict) -> str:
    reqs = audit["requirements"]
    # The restrictions block is enrolment warnings, not requirements: its sub-entries are
    # numbered "1)" through "6)" with no title, and nothing about them is plannable.
    unfulfilled = [
        r
        for r in reqs
        if r["status"] == "Unfulfilled" and not r["title"].startswith("RESTRICTIONS")
    ]

    out = [
        "---",
        f"updated: {date.today().isoformat()}",
        "domain: engineering",
        "stability: volatile",
        "summary: Degree requirements outstanding, derived from the UCLA DARS audit.",
        "read_when: Course planning, what is left to graduate, the three-year plan.",
        f"audit_prepared: {audit['prepared'] or 'unknown'}",
        f"major: {audit['major'] or 'unknown'}",
        f"requirements_total: {len(reqs)}",
        f"requirements_unfulfilled: {len(unfulfilled)}",
        "---",
        "",
        "<!-- GENERATED by scripts/parse_dars.py from a saved DARS audit. Do not edit. -->",
        "",
        "# Degree Audit",
        "",
        f"Derived from the DARS audit prepared {audit['prepared']}. Identifiers, grade history,",
        "and high-school records in the source page are deliberately not carried across.",
        "",
        "## Outstanding",
        "",
    ]

    if not unfulfilled:
        out += ["Nothing unfulfilled.", ""]

    for r in unfulfilled:
        out.append(f"### {r['title']}")
        out.append("")
        for s in r["subs"]:
            if s["status"] != "Unfulfilled":
                continue
            out.append(f"- **{s['title']}**")
            if s["needs"]:
                out.append(f"  - Needs: {s['needs']}")
            if s.get("options"):
                out.append(f"  - Select from: {shorten(s['options'])}")
            if s.get("excluded"):
                out.append(f"  - Not from: {shorten(s['excluded'])}")
            for c in s["courses"]:
                out.append(
                    f"  - Applied: {c['code']} ({c['term']}, {c['units']}, {c['grade']})"
                )
        out.append("")

    out += ["## All requirements", "", "| Requirement | Status |", "|---|---|"]
    for r in reqs:
        title = r["title"].replace("|", "/")
        out.append(f"| {title} | {r['status']} |")
    out.append("")

    return "\n".join(out)


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    src = sys.argv[1]
    raw = io.open(src, encoding="utf-8", errors="replace").read()
    audit = parse(to_text(raw))
    io.open(OUT, "w", encoding="utf-8", newline="\n").write(render(audit))

    reqs = audit["requirements"]
    print(f"wrote {os.path.relpath(OUT, ROOT)}")
    print(
        f"  {len(reqs)} requirements, "
        f"{sum(1 for r in reqs if r['status'] == 'Unfulfilled')} unfulfilled, "
        f"{sum(1 for r in reqs if r['status'] == 'In Progress')} in progress"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
