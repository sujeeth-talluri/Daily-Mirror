#!/usr/bin/env python3
"""
Generates a unique share-preview image per entry (og/<slug>.png, 1200x630)
so a link to "The Two Trees" shows that day's actual title when shared,
instead of the one generic og-image.png every entry used to share.

Optional step — requires Pillow (`pip install Pillow`) and the system fonts
below. If either is missing, or this script is simply never run for a given
entry, build_pages.py falls back to the shared og-image.png automatically.
Not part of the required daily workflow for that reason.
"""
import json
import re
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).parent.parent
ENTRIES_JSON = ROOT / "entries.json"
OUT_DIR = ROOT / "og"

W, H = 1200, 630

PAPER = (251, 248, 240)
INK = (35, 42, 61)
INK_SOFT = (91, 100, 120)
GOLD = (135, 101, 34)
CLAY = (141, 91, 77)
LINE = (220, 219, 228)

FONT_DIR = "C:/Windows/Fonts/"
F_TITLE = FONT_DIR + "cambriab.ttf"
F_ITALIC = FONT_DIR + "cambriai.ttf"
F_MONO = FONT_DIR + "consola.ttf"
F_MONO_BOLD = FONT_DIR + "consolab.ttf"
F_EMOJI = FONT_DIR + "seguiemj.ttf"

MIRROR_EMOJI = "\U0001FA9E"


def tracked(text):
    """Fake letter-spacing for uppercase mono labels (Pillow has no tracking)."""
    return " ".join(text)


def wrap_text(draw, text, font, max_width):
    words = text.split()
    lines, current = [], ""
    for word in words:
        trial = f"{current} {word}".strip()
        if draw.textlength(trial, font=font) <= max_width:
            current = trial
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def fit_title(draw, text, max_width, max_lines, start_size, min_size):
    size = start_size
    while size >= min_size:
        font = ImageFont.truetype(F_TITLE, size)
        lines = wrap_text(draw, text, font, max_width)
        if len(lines) <= max_lines:
            return font, lines
        size -= 4
    font = ImageFont.truetype(F_TITLE, min_size)
    return font, wrap_text(draw, text, font, max_width)[:max_lines]


def render_entry(entry):
    img = Image.new("RGB", (W, H), PAPER)
    draw = ImageDraw.Draw(img)

    # Dawn-line signature strip, same gradient family as the site header.
    stops = [(0.0, (107, 115, 148)), (0.55, GOLD), (1.0, CLAY)]
    for x in range(W):
        t = x / W
        for i in range(len(stops) - 1):
            t0, c0 = stops[i]
            t1, c1 = stops[i + 1]
            if t0 <= t <= t1 or i == len(stops) - 2:
                local_t = 0 if t1 == t0 else (t - t0) / (t1 - t0)
                local_t = max(0, min(1, local_t))
                color = tuple(int(c0[j] + (c1[j] - c0[j]) * local_t) for j in range(3))
                draw.line([(x, 0), (x, 6)], fill=color)
                break

    margin = 80

    # Header mark
    emoji_font = ImageFont.truetype(F_EMOJI, 40)
    draw.text((margin, 50), MIRROR_EMOJI, font=emoji_font, embedded_color=True)
    label_font = ImageFont.truetype(F_MONO, 20)
    draw.text((margin + 56, 62), tracked("THE DAILY MIRROR"), font=label_font, fill=INK_SOFT)

    # Day label
    day_font = ImageFont.truetype(F_MONO_BOLD, 22)
    day_text = tracked(f"DAY {entry['day']}")
    draw.text((margin, 150), day_text, font=day_font, fill=GOLD)

    # Title
    title_font, title_lines = fit_title(draw, entry["title"], W - margin * 2, 2, 72, 44)
    y = 195
    line_height = title_font.size + 12
    for line in title_lines:
        draw.text((margin, y), line, font=title_font, fill=INK)
        y += line_height

    # Closing question
    question = (entry.get("closing_question") or "").strip()
    if question:
        y += 20
        draw.line([(margin, y), (margin + 90, y)], fill=GOLD, width=3)
        y += 24
        q_font = ImageFont.truetype(F_ITALIC, 30)
        q_lines = wrap_text(draw, question, q_font, W - margin * 2)[:3]
        for line in q_lines:
            draw.text((margin, y), line, font=q_font, fill=INK_SOFT)
            y += q_font.size + 14

    # Footer domain, bottom-right
    domain_font = ImageFont.truetype(F_MONO, 18)
    domain = "sujeeth-talluri.github.io/Daily-Mirror"
    tw = draw.textlength(domain, font=domain_font)
    draw.text((W - margin - tw, H - 60), domain, font=domain_font, fill=INK_SOFT)

    return img


def main():
    entries = json.loads(ENTRIES_JSON.read_text(encoding="utf-8"))
    OUT_DIR.mkdir(exist_ok=True)
    for entry in entries:
        img = render_entry(entry)
        img.save(OUT_DIR / f"{entry['slug']}.png")
    print(f"Wrote {len(entries)} share images to {OUT_DIR}")


if __name__ == "__main__":
    main()
