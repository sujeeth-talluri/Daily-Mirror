#!/usr/bin/env python3
"""
Processes a source image into an entry's header image: converts to JPEG,
resizes if wider than MAX_WIDTH, saves to images/<slug>.jpg, and adds (or
updates) the `image:` field in that entry's frontmatter automatically.

Usage:
  python3 scripts/add_image.py day-46-the-potters-hands path/to/source.png

Needs Pillow (`pip install Pillow`) but no special fonts — unlike
generate_og_images.py/generate_icons.py, this is fully portable.
"""
import re
import sys
from pathlib import Path
from PIL import Image

MAX_WIDTH = 1600
QUALITY = 82

ROOT = Path(__file__).parent.parent
IMAGES_DIR = ROOT / "images"
ENTRIES_DIR = ROOT / "entries"


def find_entry_file(slug):
    matches = list(ENTRIES_DIR.glob(f"{slug}.md"))
    if not matches:
        raise SystemExit(f"No entries/{slug}.md found")
    return matches[0]


def process_image(source_path, slug):
    img = Image.open(source_path).convert("RGB")
    if img.width > MAX_WIDTH:
        ratio = MAX_WIDTH / img.width
        img = img.resize((MAX_WIDTH, int(img.height * ratio)), Image.LANCZOS)
    IMAGES_DIR.mkdir(exist_ok=True)
    out_path = IMAGES_DIR / f"{slug}.jpg"
    img.save(out_path, "JPEG", quality=QUALITY, optimize=True)
    return out_path


def set_frontmatter_image(entry_path, image_rel_path):
    text = entry_path.read_text(encoding="utf-8")
    if re.search(r"^image:.*$", text, re.MULTILINE):
        text = re.sub(r"^image:.*$", f'image: "{image_rel_path}"', text, count=1, flags=re.MULTILINE)
    else:
        text = re.sub(r"\n---\n", f'\nimage: "{image_rel_path}"\n---\n', text, count=1)
    entry_path.write_text(text, encoding="utf-8")


def main():
    if len(sys.argv) != 3:
        raise SystemExit("Usage: python3 scripts/add_image.py <slug> <path-to-source-image>")
    slug, source = sys.argv[1], Path(sys.argv[2])
    if not source.exists():
        raise SystemExit(f"Source image not found: {source}")
    entry_path = find_entry_file(slug)
    out_path = process_image(source, slug)
    rel_path = f"images/{slug}.jpg"
    set_frontmatter_image(entry_path, rel_path)
    size_kb = out_path.stat().st_size / 1024
    print(f"Wrote {out_path} ({size_kb:.0f} KB) and updated {entry_path.name}'s frontmatter")


if __name__ == "__main__":
    main()
