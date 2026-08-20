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
UNESCAPE = re.compile(r"\\([#*_`\[\]().\-+!>~|=])")
CITE_START = re.compile(r"\[cite_start\]\s*")
CITE_REF = re.compile(r"\s*\[cite:\s*[\d,\s]+\]")


def main() -> None:
    for rel in TARGETS:
        path = ROOT / rel
        if not path.exists():
            print(f"SKIP (missing): {rel}")
            continue

        original = path.read_text(encoding="utf-8")
        text = UNESCAPE.sub(r"\1", original)
        text = CITE_START.sub("", text)
        text = CITE_REF.sub("", text)

        if text != original:
            path.write_text(text, encoding="utf-8")
            removed = original.count("\\") - text.count("\\")
            print(f"FIXED  {rel:<45} -{removed} escapes, "
                  f"-{len(original) - len(text)} bytes")
        else:
            print(f"CLEAN  {rel}")


if __name__ == "__main__":
    main()
