"""Cut the FRC reference photographs into the figures the site publishes.

The sources are phone photographs in `context/assets/originals/`, which nothing publishes —
`web/scripts/sync-vault-assets.mjs` copies only top-level files out of `context/assets/`, so
a subdirectory is enough to keep 22 MB of 4032x3024 frames off the public site (D-338). This
writes the cropped, resized derivatives back up into `context/assets/`, where the sync script
finds them and `airhead.md`, `slipknot.md` and `lemonlight.md` reference them.

Two things this does that a manual crop in an image editor would not record:

- **The EXIF rotation is baked in.** All four JPEGs carry orientation 6 — portrait shots that
  display upright only because a viewer honours the tag. Crop boxes are in display space, so
  a box applied to the unrotated buffer takes the wrong region. `exif_transpose` rotates the
  pixels and drops the tag, and nothing downstream has to know.
- **Crop boxes are fractions, not pixels**, so a re-shoot at a different resolution keeps the
  same framing.

Idempotent, and safe to re-run after adjusting a box.

    python scripts/crop_robot_photos.py
"""

from __future__ import annotations

import os

from PIL import Image, ImageOps

SRC = os.path.join("context", "assets", "originals")
DST = os.path.join("context", "assets")

# (source, output, (left, top, right, bottom) as fractions of the upright frame, max width)
JOBS = [
    # 2023 — Airhead in the pit at the regional. A full-width band of a portrait photo: it
    # keeps the whole stack of pneumatic cylinders and the 1458 bumper, and drops the
    # ceiling truss above and the floor below.
    ("2023RobotImage.jpg", "airhead_image1.jpg", (0.0, 0.256, 1.0, 0.678), 1600),
    # 2024 — Slipknot on the field at the Crescendo speaker. The only match-play photograph
    # in the set, which is why it leads despite being the smallest source.
    ("2024RobotImage1.png", "slipknot_image1.jpg", (0.0, 0.236, 1.0, 0.925), 1600),
    # 2024 — the same robot isolated on a red field. 391x306 source, so no crop and no
    # upscale; it is a gallery figure, and the gallery renders `contain`.
    ("2024RobotImage2.png", "slipknot_image2.jpg", (0.0, 0.0, 1.0, 1.0), 800),
    # 2025 — Lemonlight beside the reef on the practice field. Reads as 16:9 and shows the
    # robot against the thing it scores on, so it is the hero.
    ("2025RobotImage2.jpg", "lemonlight_image1.jpg", (0.066, 0.325, 0.9, 0.676), 1600),
    # 2025 — the elevator close-up, the clearest look at the mechanism Victor wrote. Kept
    # portrait rather than forced into 16:9, which would cut the top off the elevator.
    ("2025RobotImage3.jpg", "lemonlight_image2.jpg", (0.066, 0.125, 0.816, 0.862), 1200),
    # 2025 — staged on the practice field with the elevator down.
    ("2025RobotImage1.jpg", "lemonlight_image3.jpg", (0.033, 0.3, 0.933, 0.65), 1400),
]


def main() -> None:
    for name, out, box, max_w in JOBS:
        im = ImageOps.exif_transpose(Image.open(os.path.join(SRC, name)))
        w, h = im.size
        left, top, right, bottom = box
        im = im.crop((round(left * w), round(top * h), round(right * w), round(bottom * h)))
        if im.width > max_w:
            im = im.resize((max_w, round(im.height * max_w / im.width)), Image.LANCZOS)
        im = im.convert("RGB")
        path = os.path.join(DST, out)
        im.save(path, "JPEG", quality=82, optimize=True, progressive=True)
        print(
            f"{out:26} {im.width}x{im.height}  {im.width / im.height:.3f}  "
            f"{os.path.getsize(path) / 1024:.0f} KB"
        )


if __name__ == "__main__":
    main()
