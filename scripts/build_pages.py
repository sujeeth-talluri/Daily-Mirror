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

SITE_URL = "https://sujeeth-talluri.github.io/Daily-Mirror/"

ROOT = Path(__file__).parent.parent
ENTRIES_JSON = ROOT / "entries.json"
PAGES_DIR = ROOT / "entry"
OG_IMAGES_DIR = ROOT / "og"

FAVICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E%F0%9F%AA%9E%3C/text%3E%3C/svg%3E"

FONTS_LINK = (
    'https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,400;'
    '0,8..60,500;0,8..60,600;1,8..60,400;1,8..60,500&family=Fraunces:ital,opsz,wght@0,9..144,400;'
    '0,9..144,500;0,9..144,600;1,9..144,400&family=IBM+Plex+Mono:wght@400;500&display=swap'
)


def escape_html(text):
    return _escape(text or "", quote=False)


def meta_line(parts):
    return " · ".join(p for p in parts if p)


def format_date(iso):
    if not iso:
        return ""
    try:
        from datetime import datetime
        return datetime.strptime(iso, "%Y-%m-%d").strftime("%B %-d, %Y")
    except ValueError:
        return ""


def render_body(body, closing_question):
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", body) if p.strip()]
    if closing_question and paragraphs and paragraphs[-1].strip() == closing_question.strip():
        paragraphs.pop()
    parts = []
    for p in paragraphs:
        if p.startswith("🪞"):
            parts.append(f'<div class="mirror-marker">{escape_html(p)}</div>')
        else:
            parts.append(f"<p>{escape_html(p)}</p>")
    return "".join(parts)


def meta_description(entry):
    if entry.get("closing_question"):
        return entry["closing_question"]
    text = re.sub(r"\s+", " ", entry.get("body", "")).strip()
    return (text[:155] + "…") if len(text) > 155 else text


def render_page(entry, older, newer):
    slug = entry["slug"]
    title = entry["title"]
    canonical = f"{SITE_URL}entry/{slug}/"
    description = meta_description(entry)
    meta = meta_line([f"Day {entry['day']}", format_date(entry.get("date")), entry.get("passage") or ""])
    themes_html = "".join(f'<span class="tag">{escape_html(t)}</span>' for t in entry.get("themes") or [])
    body_html = render_body(entry.get("body", ""), entry.get("closing_question", ""))
    # Falls back to the shared image if generate_og_images.py (optional, needs
    # Pillow) hasn't been run for this entry yet.
    has_custom_image = (OG_IMAGES_DIR / f"{slug}.png").exists()
    og_image = f"{SITE_URL}og/{slug}.png" if has_custom_image else f"{SITE_URL}og-image.png"

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

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{escape_html(title)} — The Daily Mirror</title>
<meta name="description" content="{escape_html(description)}">
<link rel="canonical" href="{canonical}">

<link rel="icon" href="{FAVICON}">
<link rel="apple-touch-icon" href="../../apple-touch-icon.png">
<link rel="manifest" href="../../manifest.json">
<meta name="theme-color" content="#876522">

<meta property="og:title" content="{escape_html(title)}">
<meta property="og:description" content="{escape_html(description)}">
<meta property="og:type" content="article">
<meta property="og:url" content="{canonical}">
<meta property="og:image" content="{og_image}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{escape_html(title)}">
<meta name="twitter:description" content="{escape_html(description)}">
<meta name="twitter:image" content="{og_image}">

<script type="application/ld+json">{json.dumps(json_ld, ensure_ascii=False)}</script>

<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="{FONTS_LINK}" rel="stylesheet">
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
    <div class="entry-meta">{escape_html(meta)}</div>
    <h2 id="entry-title">{escape_html(title)}</h2>
    <div class="entry-chips">{themes_html}</div>
    <div class="entry-body">{body_html}</div>
    <p class="closing-question">{escape_html(entry.get("closing_question", ""))}</p>

    <div class="entry-actions">
      <a class="action-btn" href="../../index.html#/entry/{slug}">Open in full site</a>
    </div>
  </article>
</main>

{nav_html}

<footer class="site-footer">
  <div class="wrap">
    <p>Written each morning, one reading at a time. Est. 2026.</p>
  </div>
</footer>

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

    for i, entry in enumerate(entries):
        older = entries[i + 1] if i + 1 < len(entries) else None  # smaller day number
        newer = entries[i - 1] if i > 0 else None                  # larger day number
        page_dir = PAGES_DIR / entry["slug"]
        page_dir.mkdir(parents=True, exist_ok=True)
        (page_dir / "index.html").write_text(render_page(entry, older, newer), encoding="utf-8")

    (ROOT / "sitemap.xml").write_text(build_sitemap(entries), encoding="utf-8")
    (ROOT / "robots.txt").write_text(build_robots(), encoding="utf-8")

    print(f"Wrote {len(entries)} entry pages to {PAGES_DIR}, plus sitemap.xml and robots.txt")


if __name__ == "__main__":
    main()
