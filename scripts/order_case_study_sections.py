"""Put the case-study sections of each project file into narrative order.

A case study reads problem -> what you built -> what failed -> what it measured. Four of the
six project files had it the other way round, opening with `## Architecture` and reaching
`## The problem` third, because the skeleton (D-073) was appended to files that already had
an architecture paragraph rather than woven into them.

That ordering is invisible today, since the sections it misplaces are all still unwritten and
`dropUnwritten` removes them. It stops being invisible the moment Victor writes the prose,
which is why this runs before that and not after.

This moves whole sections. It never edits a line inside one, and it never reorders anything it
does not recognise: an unknown heading keeps its position relative to the sections around it.
Line endings are preserved per file — the vault is mixed CRLF and LF.

Idempotent. Run it again and it reports no change.

    python scripts/order_case_study_sections.py [--check]
"""

from __future__ import annotations

import glob
import io
import re
import sys

# Lower sorts earlier. Headings not listed keep their place, so `## Post-mortem` trails the
# four case-study sections and `## Notes` (stripped from public output anyway) stays last.
ORDER = {
    "the problem": 0,
    "architecture": 1,
    "design decisions": 1,  # solenoid-bit-reader's name for the same role (D-073)
    "what did not work": 2,
    "measured results": 3,
    "results": 3,  # ditto
    "post-mortem": 4,
    "notes": 5,
}

HEADING = re.compile(r"^##[ \t]+(.+?)[ \t]*$")


def split_sections(body: str, eol: str) -> tuple[str, list[tuple[str, str]]]:
    """Returns the preamble and a list of (heading-text, raw-section-including-heading)."""
    lines = body.split(eol)
    preamble: list[str] = []
    sections: list[tuple[str, list[str]]] = []

    for line in lines:
        match = HEADING.match(line)
        if match:
            sections.append((match.group(1).strip(), [line]))
        elif sections:
            sections[-1][1].append(line)
        else:
            preamble.append(line)

    return eol.join(preamble), [(h, eol.join(ls)) for h, ls in sections]


def reorder(sections: list[tuple[str, str]]) -> list[tuple[str, str]]:
    """Stable sort on the rank table. Unranked headings hold their original position.

    A plain `sorted` with a default rank would drag every unknown heading to one end. Instead
    an unknown section inherits the rank of the last known one before it, so it stays attached
    to the section it was written next to.
    """
    ranked: list[tuple[float, int, tuple[str, str]]] = []
    carried = -1.0
    for index, (heading, raw) in enumerate(sections):
        rank = ORDER.get(heading.lower().strip())
        if rank is None:
            # Half a step after whatever it followed, so it cannot jump ahead of it.
            rank = carried + 0.5
        else:
            carried = float(rank)
        ranked.append((rank, index, (heading, raw)))

    ranked.sort(key=lambda item: (item[0], item[1]))
    return [item[2] for item in ranked]


def process(path: str, check: bool) -> bool:
    raw = io.open(path, "rb").read().decode("utf-8")
    eol = "\r\n" if "\r\n" in raw else "\n"

    # Frontmatter is fenced by --- and holds no `## ` lines, but splitting it off first means
    # this cannot corrupt it even if one is added later.
    parts = raw.split("---" + eol, 2)
    if len(parts) == 3 and parts[0] == "":
        head, body = "---" + eol + parts[1] + "---" + eol, parts[2]
    else:
        head, body = "", raw

    preamble, sections = split_sections(body, eol)
    ordered = reorder(sections)

    if [h for h, _ in sections] == [h for h, _ in ordered]:
        return False

    rebuilt = head + preamble.rstrip(eol) + eol * 2
    rebuilt += (eol * 2).join(section.rstrip(eol) for _, section in ordered) + eol

    if not check:
        io.open(path, "wb").write(rebuilt.encode("utf-8"))

    before = " -> ".join(h for h, _ in sections)
    after = " -> ".join(h for h, _ in ordered)
    print(f"{path}\n    was: {before}\n    now: {after}")
    return True


def main() -> int:
    check = "--check" in sys.argv
    changed = 0
    for path in sorted(glob.glob("context/01_engineering/projects/*.md")):
        if process(path, check):
            changed += 1

    if changed == 0:
        print("All project files are already in narrative order.")
        return 0
    print(f"\n{changed} file(s) {'would be' if check else ''} reordered.")
    return 1 if check else 0


if __name__ == "__main__":
    raise SystemExit(main())
