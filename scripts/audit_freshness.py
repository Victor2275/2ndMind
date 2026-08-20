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
