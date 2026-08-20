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
