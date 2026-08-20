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
