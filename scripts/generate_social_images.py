#!/usr/bin/env python3
"""
Generates two branded share images per entry, automatically, as part of the
required publish pipeline (.github/workflows/build.yml):

  og/<slug>.png       1200x630  — link-preview card (WhatsApp/Facebook/X/iMessage)
  stories/<slug>.png  1080x1920 — Instagram Story card

Runs on the Action's plain Ubuntu runner using fonts bundled in fonts/ (see
fonts/README.md) — no local/Windows dependency, unlike the generate_og_images.py
this replaces, which only ever ran manually on Windows and was never part of
the automated pipeline.

Resilience policy: publishing the reflection matters more than generating its
share images. A failure on one entry is logged and skipped, not fatal — every
other entry still gets its images, and build_pages.py already falls back to
the shared og-image.png for anything missing here. This script exits non-zero
only if at least one entry failed, so the Action step shows a visible warning
(see build.yml's continue-on-error on this step) without blocking the commit
of everything that did build successfully.
"""
import json
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).parent.parent
ENTRIES_JSON = ROOT / "entries.json"
FONTS_DIR = ROOT / "fonts"
OG_DIR = ROOT / "og"
STORY_DIR = ROOT / "stories"

# ---- Design tokens — matches style.css's :root light-mode palette exactly.
# Deliberately the light/ivory identity regardless of the reader's own site
# theme preference: it's the publication's primary identity (warm paper,
# morning-reading), not a settings-dependent choice, and it's what these
# tokens' own comments in style.css describe as the brief's intent. ----
PAPER = (255, 253, 248)    # --paper #FFFDF8
INK = (36, 36, 43)         # --ink #24242B
INK_SOFT = (105, 102, 95)  # --ink-soft #69665F
GOLD = (140, 107, 46)      # --gold #8C6B2E
CLAY = (141, 91, 77)       # --clay #8D5B4D
LINE = (232, 226, 214)     # --line #E8E2D6
DAWN_START = (74, 68, 56)  # first stop of the site's .dawn-line gradient

def _font(filename, size):
    return ImageFont.truetype(str(FONTS_DIR / filename), size)


def fraunces(size, weight=600, optical_size=None):
    """Variable font — axis order per get_variation_axes(): [opsz, wght, SOFT, WONK]."""
    f = _font("Fraunces-Variable.ttf", size)
    opsz = optical_size if optical_size is not None else max(9, min(144, size))
    f.set_variation_by_axes([opsz, weight, 0, 0])
    return f


def source_serif(size, weight=400, italic=False, optical_size=None):
    """Variable font — axis order: [wght, opsz]."""
    name = "SourceSerif4-Italic-Variable.ttf" if italic else "SourceSerif4-Variable.ttf"
    f = _font(name, size)
    opsz = optical_size if optical_size is not None else max(8, min(60, size))
    f.set_variation_by_axes([weight, opsz])
    return f


def mono(size, semibold=False):
    return _font("IBMPlexMono-SemiBold.ttf" if semibold else "IBMPlexMono-Medium.ttf", size)


def draw_mirror_mark(draw, x, y, size, color=GOLD):
    """A small hand-mirror glyph — oval + handle — standing in for the site's
    🪞 mark. Drawn rather than rendered as emoji text: none of the bundled
    (non-emoji) fonts contain that glyph, and a color-emoji font capable of
    rendering it would add tens of megabytes for one small recurring icon.
    Returns the glyph's total width, for laying out whatever follows it."""
    w, h = size * 0.72, size * 0.86
    draw.ellipse([x, y, x + w, y + h], outline=color, width=max(2, size // 14))
    handle_top = y + h
    draw.line([(x + w / 2, handle_top), (x + w / 2, handle_top + size * 0.22)], fill=color, width=max(2, size // 14))
    return w


def tracked(text):
    """Fake letter-spacing for uppercase mono labels (Pillow has no tracking).
    Same trick the script this replaces used."""
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
    return lines or [""]


def fit_text(draw, text, max_width, max_lines, font_fn, start_size, min_size, step=4, **font_kwargs):
    """Shrinks within [min_size, start_size] to fit max_lines; if still too long
    at min_size, truncates the last line with an ellipsis rather than shrinking
    further into illegibility (brief: controlled truncation, never clip/shrink
    to unreadable)."""
    size = start_size
    font, lines = None, None
    while size >= min_size:
        font = font_fn(size, **font_kwargs)
        lines = wrap_text(draw, text, font, max_width)
        if len(lines) <= max_lines:
            return font, lines
        size -= step
    font = font_fn(min_size, **font_kwargs)
    lines = wrap_text(draw, text, font, max_width)
    if len(lines) > max_lines:
        lines = lines[:max_lines]
        last = lines[-1]
        while last and draw.textlength(last + "…", font=font) > max_width:
            last = last.rsplit(" ", 1)[0] if " " in last else last[:-1]
        lines[-1] = (last + "…") if last else "…"
    return font, lines


def dawn_strip(draw, x0, y0, x1, y1):
    """The site's signature .dawn-line gradient, reproduced exactly (same
    three color stops) so the image is recognizably Daily Mirror at a glance,
    before anyone reads a word of text."""
    stops = [(0.0, DAWN_START), (0.55, GOLD), (1.0, CLAY)]
    span = x1 - x0
    for x in range(span):
        t = x / span
        for i in range(len(stops) - 1):
            t0, c0 = stops[i]
            t1, c1 = stops[i + 1]
            if t0 <= t <= t1 or i == len(stops) - 2:
                local_t = 0 if t1 == t0 else (t - t0) / (t1 - t0)
                local_t = max(0, min(1, local_t))
                color = tuple(int(c0[j] + (c1[j] - c0[j]) * local_t) for j in range(3))
                draw.line([(x0 + x, y0), (x0 + x, y1)], fill=color)
                break


# ============================== OG card (1200x630) ==============================
# Job: read as a link preview, often rendered small (WhatsApp/iMessage/X cards
# can be quite compact). Title recognition matters more than decorative detail,
# so the title is the single largest element — bigger priority than the hook.

OG_W, OG_H = 1200, 630


def render_og_image(entry):
    img = Image.new("RGB", (OG_W, OG_H), PAPER)
    draw = ImageDraw.Draw(img)
    dawn_strip(draw, 0, 0, OG_W, 7)

    margin = 84
    x = margin

    # Brand row: mark + wordmark, small and quiet — identity, not the headline.
    mark_w = draw_mirror_mark(draw, x, 44, 32)
    brand_font = mono(18)
    draw.text((x + mark_w + 18, 56), tracked("THE DAILY MIRROR"), font=brand_font, fill=INK_SOFT)

    # Day number, gold, its own line — an editorial dateline.
    day_font = mono(20, semibold=True)
    day = entry.get("day")
    if day:
        draw.text((x, 108), tracked(f"DAY {day}"), font=day_font, fill=GOLD)

    # Title — the largest element on the card by design.
    title_font, title_lines = fit_text(
        draw, entry.get("title", ""), OG_W - margin * 2, 2,
        fraunces, start_size=80, min_size=48, weight=580,
    )
    y = 168
    for line in title_lines:
        draw.text((x, y), line, font=title_font, fill=INK)
        y += title_font.size + 10

    # Short gold rule, then the hook — supporting, not competing with the title.
    y += 18
    draw.line([(x, y), (x + 84, y)], fill=GOLD, width=3)
    y += 26

    hook = (entry.get("hook") or "").strip()
    if hook:
        hook_font, hook_lines = fit_text(
            draw, hook, OG_W - margin * 2, 2,
            source_serif, start_size=32, min_size=24, italic=True, weight=420,
        )
        for line in hook_lines:
            draw.text((x, y), line, font=hook_font, fill=INK_SOFT)
            y += hook_font.size + 12

    return img


# ============================ Story card (1080x1920) ============================
# A different job entirely: full-screen, glanced at for a second or two while
# scrolling Stories. The hook/curiosity line is the largest, most prominent
# element — the title is secondary. Deliberately left-aligned, editorial
# blocks rather than a centered "motivational quote" template. Content stays
# clear of Instagram's own chrome (profile row at top, reply bar at bottom)
# and leaves the lower third quiet for the native Link sticker.

STORY_W, STORY_H = 1080, 1920
STORY_MARGIN = 84
STORY_SAFE_TOP = 210     # below Instagram's own avatar/username row
STORY_SAFE_BOTTOM = 1920 - 420  # above Instagram's reply bar + link-sticker room


def render_story_image(entry):
    img = Image.new("RGB", (STORY_W, STORY_H), PAPER)
    draw = ImageDraw.Draw(img)
    dawn_strip(draw, 0, 0, STORY_W, 10)

    x = STORY_MARGIN
    y = STORY_SAFE_TOP

    # Brand + day, one quiet line.
    mark_w = draw_mirror_mark(draw, x, y - 2, 28)
    label = tracked(f"THE DAILY MIRROR · DAY {entry.get('day', '')}")
    draw.text((x + mark_w + 16, y + 4), label, font=mono(20), fill=INK_SOFT)
    y += 74

    # The hook — the largest, most prominent text on the card.
    hook = (entry.get("hook") or entry.get("title") or "").strip()
    hook_font, hook_lines = fit_text(
        draw, hook, STORY_W - STORY_MARGIN * 2, 6,
        fraunces, start_size=76, min_size=46, weight=560,
    )
    for line in hook_lines:
        draw.text((x, y), line, font=hook_font, fill=INK)
        y += hook_font.size + 14

    y += 30
    draw.line([(x, y), (x + 100, y)], fill=GOLD, width=4)
    y += 40

    # Title — secondary, smaller, supporting context for the hook above it.
    title = entry.get("title", "")
    if title and title.strip().lower() != hook.strip().lower():
        title_font, title_lines = fit_text(
            draw, title, STORY_W - STORY_MARGIN * 2, 3,
            source_serif, start_size=40, min_size=28, italic=True, weight=420,
        )
        for line in title_lines:
            draw.text((x, y), line, font=title_font, fill=INK_SOFT)
            y += title_font.size + 10

    # CTA, placed well clear of the reserved lower safe area.
    cta_y = min(y + 60, STORY_SAFE_BOTTOM - 60)
    draw.text((x, cta_y), "READ TODAY'S REFLECTION →", font=mono(22, semibold=True), fill=GOLD)

    # Deliberately nothing below this point — quiet space reserved for
    # Instagram's own native Link sticker (brief: no raw URL on the graphic
    # itself; the sticker is how the link actually travels on a Story).

    return img


def process_entry(entry):
    slug = entry["slug"]
    og_img = render_og_image(entry)
    og_img.save(OG_DIR / f"{slug}.png")
    story_img = render_story_image(entry)
    story_img.save(STORY_DIR / f"{slug}.png")


def main():
    entries = json.loads(ENTRIES_JSON.read_text(encoding="utf-8"))
    OG_DIR.mkdir(exist_ok=True)
    STORY_DIR.mkdir(exist_ok=True)

    failures = []
    for entry in entries:
        try:
            process_entry(entry)
        except Exception as exc:  # noqa: BLE001 — deliberately broad: one bad
            # entry must never stop the rest from generating (see module docstring).
            failures.append((entry.get("slug", "?"), exc))
            print(f"ERROR generating social images for {entry.get('slug', '?')}: {exc}", file=sys.stderr)

    ok = len(entries) - len(failures)
    print(f"Wrote OG + Story images for {ok}/{len(entries)} entries to {OG_DIR} and {STORY_DIR}")
    if failures:
        print(f"{len(failures)} entr{'y' if len(failures) == 1 else 'ies'} FAILED "
              f"(falling back to the shared og-image.png for those): "
              + ", ".join(slug for slug, _ in failures), file=sys.stderr)
        sys.exit(1)  # visible warning on the Action step; does not block the commit step


if __name__ == "__main__":
    main()
