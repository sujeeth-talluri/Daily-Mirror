#!/usr/bin/env python3
"""
Generates one static, crawlable HTML page per entry (entry/<slug>/index.html),
plus sitemap.xml and robots.txt.

Why this exists: the main site (index.html) is a hash-routed single-page app
(#/entry/<slug>), and hash fragments are never sent to the server or reliably
indexed as distinct pages. That means individual reflections were invisible to
search engines, and sharing a link on social/iMessage always showed the same
generic site-wide preview instead of that day's actual title and question.

These pages are the real, canonical, shareable URL for each entry
(https://.../entry/<slug>/) with correct per-entry <title>/OG/Twitter meta and
JSON-LD, and the full reading text rendered as real HTML for crawlers. The
"Read in the full archive" link sends readers into the interactive SPA
(search, related entries, share/reply) if they want it.

Run after build_index.py, before committing.
"""
import json
import re
from html import escape as _escape
from pathlib import Path
from urllib.parse import quote

SITE_URL = "https://sujeeth-talluri.github.io/Daily-Mirror/"

# Must match script.js's REPLY_EMAIL — duplicated here the same way SITE_URL
# already is (see README's "Before you go live" section), since a static
# build-time page and a client-side SPA can't share one JS constant directly.
REPLY_EMAIL = "suji056@gmail.com"

ROOT = Path(__file__).parent.parent
ENTRIES_JSON = ROOT / "entries.json"
PAGES_DIR = ROOT / "entry"
OG_IMAGES_DIR = ROOT / "og"


def get_goatcounter_code():
    """Reads the GoatCounter site code straight from index.html's script tag —
    single source of truth, so these pages can't drift out of sync with it the
    way index.html itself once did (see git history: YOUR-CODE placeholder)."""
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    match = re.search(r"https://([^.]+)\.goatcounter\.com", html)
    if not match:
        raise SystemExit("Could not find a GoatCounter site code in index.html")
    return match.group(1)

FAVICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E%F0%9F%AA%9E%3C/text%3E%3C/svg%3E"


def escape_html(text):
    return _escape(text or "", quote=False)


def escape_attr(text):
    """For text landing inside an HTML attribute value (content="...") rather
    than element text — quotes must be entity-escaped there or a title/hook
    containing a literal " truncates the attribute and corrupts every tag
    after it. escape_html() deliberately leaves quotes literal for element
    text (cleaner raw HTML, harmless there); this is the attribute-safe twin."""
    return _escape(text or "", quote=True)


def meta_line(parts):
    return " · ".join(p for p in parts if p)


def format_date(iso):
    if not iso:
        return ""
    try:
        from datetime import datetime
        dt = datetime.strptime(iso, "%Y-%m-%d")
    except ValueError:
        return ""
    # %-d (no leading zero) is a glibc extension, unsupported on Windows — build
    # the string manually instead of relying on a platform-specific strftime flag.
    return f"{dt.strftime('%B')} {dt.day}, {dt.year}"


def format_themes(themes):
    """"SELF-EXAMINATION · REFUSAL TO CHANGE" — mirrors script.js's
    formatThemes() exactly: "self-*" slugs keep their grammatical hyphen,
    every other hyphen (a slug word-separator) becomes a space."""
    parts = []
    for t in themes or []:
        upper = t.upper()
        parts.append("SELF-" + upper[5:].replace("-", " ") if upper.startswith("SELF-") else upper.replace("-", " "))
    return " · ".join(parts)


def is_isolated_beat(p):
    """A paragraph stays on its own line rather than merging with its
    neighbors when it's dialogue (quoted), trails off with an ellipsis, or
    is three words or fewer on its own ("Think." "Change." "It looked
    easy.") — all deliberate pacing choices in the writing, not just short
    sentences. Mirrors script.js's isIsolatedBeat() exactly."""
    return (
        p.startswith('"') or p.endswith('"') or p.endswith("...") or p.endswith("…")
        or len(p.split()) <= 3
    )


def is_dramatic_beat(p):
    """Only an ellipsis trail-off is an unambiguous "this deserves a pause"
    signal. Mirrors script.js's isDramaticBeat() exactly."""
    return p.endswith("...") or p.endswith("…")


def continues_ellipsis_question(prev_line, line):
    """A line ending in "…" signals more is coming; if the next line
    completes that as a question, it belongs in the same group even though
    it's too long to be "isolated" alone. Mirrors script.js's
    continuesEllipsisQuestion() exactly."""
    return bool(prev_line) and is_dramatic_beat(prev_line) and line.strip().endswith("?")


def continues_sequence(prev_line, line):
    """Mid-sequence continuation that isn't independently "isolated" and
    doesn't complete a question: when the open beat line trails off with
    "…" (an explicit unfinished-thought signal) and the next line starts
    lowercase, it's this writer's grammatical continuation of that same
    sentence ("...different people... / until someone finally says," / a
    dialogue tag; "...isn't clear... / but because I don't like the answer
    I've already received."), not a new independent line or a fresh prose
    sentence (those start uppercase by ordinary grammar). Deliberately
    narrower than "any lowercase line while a group is open" — that also
    swallowed short, independently-isolated lines that just happened to
    follow another isolated line, merging otherwise-separate beats/lists
    that had no unfinished-thought signal between them. Requiring the
    ellipsis keeps this to true sentence-continuations. Mirrors script.js's
    continuesSequence() exactly."""
    return bool(prev_line) and is_dramatic_beat(prev_line) and bool(line) and line[0].islower()


def render_body(body, closing_question):
    """Three rhythms — normal prose, an intentional pause, and a grouped
    multi-line sequence (tight internal line breaks, one pause-or-normal
    margin for the whole group) — plus the Mirror/Think major-transition
    markers. Mirrors script.js's renderBody() block-by-block exactly, so the
    canonical shared URL reads identically to the SPA."""
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", body) if p.strip()]
    if closing_question and paragraphs and paragraphs[-1].strip() == closing_question.strip():
        paragraphs.pop()

    blocks = []
    prose_buffer = []
    beat_buffer = []
    last_beat_line = [None]  # mutable cell so the nested functions can update it

    def flush_prose():
        if prose_buffer:
            blocks.append({"kind": "text", "pause": False, "grouped": False, "lines": [" ".join(prose_buffer)]})
            prose_buffer.clear()

    def flush_beats():
        if beat_buffer:
            pause = any(is_dramatic_beat(line) for line in beat_buffer)
            blocks.append({"kind": "text", "pause": pause, "grouped": len(beat_buffer) > 1, "lines": list(beat_buffer)})
        beat_buffer.clear()
        last_beat_line[0] = None

    for p in paragraphs:
        if p.startswith("🪞"):
            flush_prose(); flush_beats()
            blocks.append({"kind": "mirror", "lines": [p]})
            continue
        if p.startswith("💭"):
            flush_prose(); flush_beats()
            blocks.append({"kind": "think", "lines": [p]})
            continue
        if is_isolated_beat(p) or continues_ellipsis_question(last_beat_line[0], p) or continues_sequence(last_beat_line[0], p):
            flush_prose()
            beat_buffer.append(p)
            last_beat_line[0] = p
            if p.strip().endswith("?"):
                flush_beats()  # a completed question always ends its group
        else:
            flush_beats()
            prose_buffer.append(p)
    flush_prose()
    flush_beats()

    parts = []
    for b in blocks:
        if b["kind"] == "mirror":
            parts.append(f'<div class="mirror-marker">{escape_html(b["lines"][0])}</div>')
        elif b["kind"] == "think":
            parts.append(f'<div class="think-marker">{escape_html(b["lines"][0])}</div>')
        else:
            classes = [c for c, on in (("pause", b["pause"]), ("sequence", b["grouped"])) if on]
            class_attr = f' class="{" ".join(classes)}"' if classes else ""
            html = "<br>".join(escape_html(line) for line in b["lines"]) if b["grouped"] else escape_html(b["lines"][0])
            parts.append(f"<p{class_attr}>{html}</p>")
    return "".join(parts)


def meta_description(entry):
    # "hook" is resolved once in build_index.py (social_hook -> closing_question
    # -> body excerpt) and reused everywhere — here, in the OG/Story images, and
    # in the Share sheet's platform text — rather than each consumer re-deriving
    # its own fallback. The inline fallback below only matters if this ever runs
    # against an entries.json built before that field existed.
    if entry.get("hook"):
        return entry["hook"]
    if entry.get("closing_question"):
        return entry["closing_question"]
    text = re.sub(r"\s+", " ", entry.get("body", "")).strip()
    return (text[:155] + "…") if len(text) > 155 else text


def render_page(entry, older, newer, gc_code):
    slug = entry["slug"]
    title = entry["title"]
    canonical = f"{SITE_URL}entry/{slug}/"
    description = meta_description(entry)
    meta = meta_line([f"Day {entry['day']}", format_date(entry.get("date")), entry.get("passage") or ""])
    themes_html = escape_html(format_themes(entry.get("themes")))
    body_html = render_body(entry.get("body", ""), entry.get("closing_question", ""))
    # Optional per-entry header image (entries/*.md `image:` field). Most entries
    # won't have one — this is opt-in, not required.
    header_image_html = (
        f'<img class="entry-header-image" src="../../{entry["image"]}" alt="" loading="eager">'
        if entry.get("image") else ""
    )
    # generate_social_images.py runs automatically in CI and produces this for
    # every entry — this fallback exists for resilience (that step is allowed
    # to fail without blocking publishing; see its docstring) rather than as
    # the normal case.
    has_custom_image = (OG_IMAGES_DIR / f"{slug}.png").exists()
    og_image = f"{SITE_URL}og/{slug}.png" if has_custom_image else f"{SITE_URL}og-image.png"
    has_story_image = (ROOT / "stories" / f"{slug}.png").exists()
    story_image = f"{SITE_URL}stories/{slug}.png" if has_story_image else ""

    # Mirrors script.js's wireReply() exactly, computed at build time instead
    # of on click since this page has no SPA data to build it from client-side.
    reply_subject = quote(f'Re: "{title}" — The Daily Mirror', safe="")
    reply_body = quote(f'I read Day {entry["day"]}, "{title}", and wanted to share a thought:\n\n', safe="")
    reply_href = f"mailto:{REPLY_EMAIL}?subject={reply_subject}&body={reply_body}"

    share_data_json = json.dumps({
        "title": title,
        "day": entry.get("day"),
        "date": entry.get("date"),
        "hook": entry.get("hook") or description,
        "url": canonical,
        "storyImageUrl": story_image,
    }, ensure_ascii=False)

    json_ld = {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        "headline": title,
        "description": description,
        "url": canonical,
        "author": {"@type": "Person", "name": "Sujeeth Talluri"},
        "isPartOf": {"@type": "Blog", "name": "The Daily Mirror", "url": SITE_URL},
    }
    if entry.get("date"):
        json_ld["datePublished"] = entry["date"]

    nav_links = []
    if older:
        nav_links.append(f'<a class="day-nav-btn day-nav-prev" href="../{older["slug"]}/">'
                          f'<span class="day-nav-arrow">←</span><span class="day-nav-label">Day {older["day"]}</span></a>')
    if newer:
        nav_links.append(f'<a class="day-nav-btn day-nav-next" href="../{newer["slug"]}/">'
                          f'<span class="day-nav-label">Day {newer["day"]}</span><span class="day-nav-arrow">→</span></a>')
    nav_html = f'<nav class="day-nav" aria-label="Previous and next entries">{"".join(nav_links)}</nav>' if nav_links else ""

    # Same virtual path the SPA already tracks entries under (script.js's trackView),
    # so views recorded here and views recorded via #/entry/<slug> browsing accumulate
    # under one count instead of silently splitting into two untracked totals.
    gc_path = f"/entry/{slug}"
    gc_title_json = json.dumps(title, ensure_ascii=False)

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{escape_html(title)} — The Daily Mirror</title>
<meta name="description" content="{escape_attr(description)}">
<link rel="canonical" href="{canonical}">

<link rel="icon" href="{FAVICON}">
<link rel="apple-touch-icon" href="../../apple-touch-icon.png">
<link rel="manifest" href="../../manifest.json">
<meta name="theme-color" content="#F7F5F0" id="theme-color-meta">
<!-- Applies a saved theme choice before first paint and syncs theme-color to
     match — same pattern and same ordering requirement as index.html (the
     meta tag above must exist in the DOM before this script runs). -->
<script>(function(){{
  var saved = localStorage.getItem('daily-mirror-theme');
  var dark = saved === 'dark' || (saved !== 'light' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  if (saved === 'light' || saved === 'dark') document.documentElement.setAttribute('data-theme', saved);
  var meta = document.getElementById('theme-color-meta');
  if (meta) meta.setAttribute('content', dark ? '#1A1815' : '#F7F5F0');
}})();</script>

<meta property="og:title" content="{escape_attr(title)}">
<meta property="og:description" content="{escape_attr(description)}">
<meta property="og:type" content="article">
<meta property="og:url" content="{canonical}">
<meta property="og:image" content="{og_image}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{escape_attr(title)}">
<meta name="twitter:description" content="{escape_attr(description)}">
<meta name="twitter:image" content="{og_image}">

<script type="application/ld+json">{json.dumps(json_ld, ensure_ascii=False)}</script>

<link rel="stylesheet" href="../../style.css">
</head>
<body>

<div class="dawn-line" aria-hidden="true"></div>

<header class="site-header">
  <div class="wrap">
    <a href="../../index.html" style="text-decoration:none; color:inherit;">
      <div class="mark">🪞</div>
      <h1 class="wordmark">The Daily Mirror</h1>
    </a>
  </div>
</header>

<main class="wrap">
  <article id="entry-view">
    <a class="back-link" href="../../index.html">← All entries</a>
    <div class="entry-meta" id="page-meta">{escape_html(meta)}</div>
    <h2 id="entry-title">{escape_html(title)}</h2>
    <div class="entry-chips">{themes_html}</div>
    {header_image_html}
    <div class="entry-body">{body_html}</div>
    <p class="closing-question">{escape_html(entry.get("closing_question", ""))}</p>

    <div class="entry-actions">
      <a class="action-btn primary" href="{reply_href}">Reply to me</a>
      <button type="button" class="action-btn" id="share-btn">Share reflection</button>
    </div>
    <p style="margin-top: var(--space-4);"><a class="view-all-link" href="../../index.html#/entry/{slug}">Open in the full site (search, related entries) →</a></p>
  </article>
</main>

{nav_html}

<footer class="site-footer">
  <div class="wrap">
    <p>Written each morning, one reading at a time. Est. 2026.</p>
  </div>
</footer>

<!-- no_onload: true, matching index.html — tracked manually below under the same
     virtual path the SPA uses, so this page's views (arrived at via share links,
     RSS, or search) count toward the same total instead of going unrecorded.
     Recorded but not displayed — same policy as the SPA (reader counts are
     tracked for the site owner via the GoatCounter dashboard, not shown
     publicly; see script.js's history for why). -->
<script data-goatcounter="https://{gc_code}.goatcounter.com/count" data-goatcounter-settings='{{"no_onload": true}}' async src="//gc.zgo.at/count.js"></script>
<script>
(function() {{
  var path = {json.dumps(gc_path)}, title = {gc_title_json};
  function track() {{
    if (window.goatcounter && window.goatcounter.count) {{
      window.goatcounter.count({{ path: path, title: title, event: false }});
    }} else {{
      setTimeout(track, 300);
    }}
  }}
  window.addEventListener('load', function() {{ setTimeout(track, 300); }});
}})();
</script>
<script src="../../theme-toggle.js"></script>
<script src="../../share.js"></script>
<script>
document.getElementById('share-btn').addEventListener('click', function() {{
  window.DailyMirrorShare.open({share_data_json});
}});
</script>

</body>
</html>
"""


def build_sitemap(entries):
    urls = [SITE_URL] + [f"{SITE_URL}entry/{e['slug']}/" for e in entries]
    items = "\n".join(f"  <url><loc>{u}</loc></url>" for u in urls)
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
{items}
</urlset>
"""


def build_robots():
    return f"User-agent: *\nAllow: /\nSitemap: {SITE_URL}sitemap.xml\n"


def main():
    entries = json.loads(ENTRIES_JSON.read_text(encoding="utf-8"))  # already day-desc sorted
    gc_code = get_goatcounter_code()

    for i, entry in enumerate(entries):
        older = entries[i + 1] if i + 1 < len(entries) else None  # smaller day number
        newer = entries[i - 1] if i > 0 else None                  # larger day number
        page_dir = PAGES_DIR / entry["slug"]
        page_dir.mkdir(parents=True, exist_ok=True)
        (page_dir / "index.html").write_text(render_page(entry, older, newer, gc_code), encoding="utf-8")

    (ROOT / "sitemap.xml").write_text(build_sitemap(entries), encoding="utf-8")
    (ROOT / "robots.txt").write_text(build_robots(), encoding="utf-8")

    print(f"Wrote {len(entries)} entry pages to {PAGES_DIR}, plus sitemap.xml and robots.txt")


if __name__ == "__main__":
    main()
