#!/usr/bin/env python3
"""
One-off generator for the home-screen install icons (apple-touch-icon.png,
icon-192.png, icon-512.png). Not part of the daily publish pipeline — these
don't change per entry, so this only needs to be re-run if the mark (currently
the mirror emoji, matching the favicon in index.html) ever changes.

Requires Pillow (`pip install Pillow`) and a color-emoji font on the machine
running it — this is the one script in the repo with a dependency beyond the
standard library, precisely because it's a one-off, not something that runs
on every publish.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).parent.parent
MIRROR_EMOJI = "\U0001FA9E"
BG = (251, 248, 240, 255)  # --paper

EMOJI_FONT_CANDIDATES = [
    "C:/Windows/Fonts/seguiemj.ttf",                                  # Windows
    "/System/Library/Fonts/Apple Color Emoji.ttc",                    # macOS
    "/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf",              # Linux
]


def find_emoji_font():
    for path in EMOJI_FONT_CANDIDATES:
        if Path(path).exists():
            return path
    raise SystemExit(
        "No color emoji font found. Tried:\n  " + "\n  ".join(EMOJI_FONT_CANDIDATES)
    )


def make_icon(size, font_path, out_path):
    img = Image.new("RGBA", (size, size), BG)
    draw = ImageDraw.Draw(img)
    # Segoe UI Emoji's bitmap strikes are fixed sizes: ask for something close
    # to the canvas and let Pillow scale the whole image down for a crisp edge.
    render_size = max(size, 160)
    font = ImageFont.truetype(font_path, int(render_size * 0.72))
    draw.text((render_size // 2, render_size // 2), MIRROR_EMOJI, font=font, embedded_color=True, anchor="mm")
    if render_size != size:
        img = img.resize((size, size), Image.LANCZOS)
    img.convert("RGB").save(out_path)
    print(f"Wrote {out_path}")


def main():
    font_path = find_emoji_font()
    make_icon(180, font_path, ROOT / "apple-touch-icon.png")
    make_icon(192, font_path, ROOT / "icon-192.png")
    make_icon(512, font_path, ROOT / "icon-512.png")


if __name__ == "__main__":
    main()
