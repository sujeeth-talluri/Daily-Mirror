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


def _normalize(text):
    """Lowercase, trailing-punctuation-insensitive comparison key — so
    "Rest." (a hook) and "Rest" (a title) are correctly recognized as the
    same content instead of one redundantly repeating the other."""
    return (text or "").strip().rstrip(".…!?\"'").strip().lower()


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

    # Brand row + day: a fixed identity anchor, not part of the centered
    # block below — the mark should land in the same place on every card,
    # scanning a feed of shared links.
    mark_w = draw_mirror_mark(draw, x, 44, 32)
    draw.text((x + mark_w + 18, 56), tracked("THE DAILY MIRROR"), font=mono(18), fill=INK_SOFT)
    day = entry.get("day")
    if day:
        draw.text((x, 108), tracked(f"DAY {day}"), font=mono(20, semibold=True), fill=GOLD)

    # Title — the largest element, sized for legibility at small link-preview
    # sizes. Hook is dropped if it's the same content as the title (e.g. a
    # one-word entry where hook falls back to the title itself).
    title_font, title_lines = fit_text(
        draw, entry.get("title", ""), OG_W - margin * 2, 2,
        fraunces, start_size=88, min_size=52, weight=580,
    )
    hook = (entry.get("hook") or "").strip()
    show_hook = bool(hook) and _normalize(hook) != _normalize(entry.get("title", ""))
    hook_font, hook_lines = (None, [])
    if show_hook:
        hook_font, hook_lines = fit_text(
            draw, hook, OG_W - margin * 2, 3,
            source_serif, start_size=34, min_size=26, italic=True, weight=420,
        )

    # Measure the title+hook block, then center it in the space below the
    # identity row (QA round-4 item 3: this was hugging the top-left with
    # the bottom half of the canvas empty). Rounded, deterministic — no
    # iterative layout, just sum of the same line-heights used to draw it.
    RULE_GAP_ABOVE, RULE_GAP_BELOW = 20, 30
    block_h = sum(title_font.size + 12 for _ in title_lines)
    if show_hook:
        block_h += RULE_GAP_ABOVE + 3 + RULE_GAP_BELOW + sum(hook_font.size + 14 for _ in hook_lines)
    zone_top, zone_bottom = 168, OG_H - 56
    y = zone_top + max(0, (zone_bottom - zone_top - block_h) // 2)

    for line in title_lines:
        draw.text((x, y), line, font=title_font, fill=INK)
        y += title_font.size + 12

    if show_hook:
        y += RULE_GAP_ABOVE
        draw.line([(x, y), (x + 88, y)], fill=GOLD, width=3)
        y += RULE_GAP_BELOW
        for line in hook_lines:
            draw.text((x, y), line, font=hook_font, fill=INK_SOFT)
            y += hook_font.size + 14

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
STORY_SAFE_TOP = 210      # below Instagram's own avatar/username row
STORY_FOOTER_Y = 1654     # fixed regardless of content length — the gap above
                          # it (variable, since hook length varies) is the
                          # intentional quiet zone for the native Link sticker.
                          # Pushed lower than the hook block (QA round-5: keep
                          # it clearly subordinate, reading as a signature, not
                          # competing content) while staying clear of both the
                          # Link sticker's usual placement and Instagram's own
                          # reply bar at the very bottom.


def render_story_image(entry):
    img = Image.new("RGB", (STORY_W, STORY_H), PAPER)
    draw = ImageDraw.Draw(img)
    dawn_strip(draw, 0, 0, STORY_W, 10)

    x = STORY_MARGIN
    y = STORY_SAFE_TOP

    # Brand + day, one quiet line — the publication eyebrow.
    mark_w = draw_mirror_mark(draw, x, y - 2, 28)
    label = tracked(f"THE DAILY MIRROR · DAY {entry.get('day', '')}")
    draw.text((x + mark_w + 16, y + 4), label, font=mono(20), fill=INK_SOFT)
    y += 88

    # The hook — the dominant element on the card, sized and given room to
    # actually use the canvas (QA round-4 item 1: this was reading as empty
    # rather than intentionally minimal). Still capped and truncated rather
    # than shrunk to illegibility on a long day (item 2).
    hook = (entry.get("hook") or entry.get("title") or "").strip()
    hook_font, hook_lines = fit_text(
        draw, hook, STORY_W - STORY_MARGIN * 2, 7,
        fraunces, start_size=94, min_size=54, weight=560,
    )
    for line in hook_lines:
        draw.text((x, y), line, font=hook_font, fill=INK)
        y += hook_font.size + 16

    y += 36
    draw.line([(x, y), (x + 110, y)], fill=GOLD, width=4)
    y += 44

    # Title — secondary, smaller, supporting context for the hook above it.
    title = entry.get("title", "")
    if title and _normalize(title) != _normalize(hook):
        title_font, title_lines = fit_text(
            draw, title, STORY_W - STORY_MARGIN * 2, 3,
            source_serif, start_size=42, min_size=30, italic=True, weight=420,
        )
        for line in title_lines:
            draw.text((x, y), line, font=title_font, fill=INK_SOFT)
            y += title_font.size + 12

    # A quiet label, not a call to action — the image itself isn't tappable,
    # only the Link sticker the reader adds in Instagram will be (item 1's
    # CTA reconsideration: "TODAY'S REFLECTION" reads as a caption for what
    # comes next, not a promise that the graphic itself is clickable).
    content_end_y = y + 44
    draw.text((x, content_end_y), tracked("TODAY'S REFLECTION"), font=mono(20, semibold=True), fill=GOLD)

    # Deliberately quiet from here to the footer — intentional whitespace
    # (not empty whitespace) left for Instagram's own native Link sticker,
    # which the reader places by hand; nothing here pretends to be it.
    draw.text((x, STORY_FOOTER_Y), tracked("THE DAILY MIRROR"), font=mono(18, semibold=True), fill=INK_SOFT)
    tagline_font, tagline_lines = fit_text(
        draw, "Truth reveals who God is. This helps me discover who I am.",
        STORY_W - STORY_MARGIN * 2, 2, source_serif, start_size=22, min_size=18, italic=True, weight=400,
    )
    ty = STORY_FOOTER_Y + 34
    for line in tagline_lines:
        draw.text((x, ty), line, font=tagline_font, fill=INK_SOFT)
        ty += tagline_font.size + 8

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
