#!/usr/bin/env python3
"""
Generates site/feed.xml (RSS 2.0) from site/entries.json.
Run this after build_index.py, before committing.

IMPORTANT: set SITE_URL below to your actual GitHub Pages URL before first publish.
"""
import json
from datetime import datetime, timezone
from email.utils import format_datetime
from pathlib import Path
from xml.sax.saxutils import escape

SITE_URL = "https://sujeeth-talluri.github.io/Daily-Mirror/"

ROOT = Path(__file__).parent.parent
ENTRIES_JSON = ROOT / "entries.json"
OUTPUT = ROOT / "feed.xml"


def rfc822(date_str):
    """Best-effort RFC 822 date for RSS; falls back to 'now' if no date is set."""
    if date_str:
        try:
            dt = datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            return format_datetime(dt)
        except ValueError:
            pass
    return format_datetime(datetime.now(timezone.utc))


def main():
    entries = json.loads(ENTRIES_JSON.read_text(encoding="utf-8"))

    items = []
    for e in entries:
        link = f"{SITE_URL}#/entry/{e['slug']}"
        summary = (e.get("closing_question") or "").strip()
        items.append(f"""    <item>
      <title>{escape(e['title'])}</title>
      <link>{escape(link)}</link>
      <guid isPermaLink="false">{escape(e['slug'])}</guid>
      <pubDate>{rfc822(e.get('date'))}</pubDate>
      <description>{escape(summary)}</description>
    </item>""")

    rss = f"""<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="feed.xsl"?>
<rss version="2.0">
  <channel>
    <title>The Daily Mirror</title>
    <link>{escape(SITE_URL)}</link>
    <description>A daily reflection series — timeless truth translated into the ordinary moments of everyday life.</description>
    <language>en-us</language>
{chr(10).join(items)}
  </channel>
</rss>
"""
    OUTPUT.write_text(rss, encoding="utf-8")
    print(f"Wrote {len(items)} items to {OUTPUT}")
    if "YOUR-USERNAME" in SITE_URL:
        print("⚠️  SITE_URL is still a placeholder — edit scripts/build_feed.py before publishing.")


if __name__ == "__main__":
    main()
