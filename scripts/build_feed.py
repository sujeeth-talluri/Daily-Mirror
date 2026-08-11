#!/usr/bin/env python3
"""
Generates feed.xml (RSS 2.0) from entries.json.
Run this after build_index.py, before committing.
"""
import json
import re
from datetime import datetime, timezone
from email.utils import format_datetime
from pathlib import Path
from xml.sax.saxutils import escape

SITE_URL = "https://sujeeth-talluri.github.io/Daily-Mirror/"

ROOT = Path(__file__).parent.parent
ENTRIES_JSON = ROOT / "entries.json"
OUTPUT = ROOT / "feed.xml"


def rfc822(date_str):
    dt = datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    return format_datetime(dt)


def load_existing_pubdates():
    """Reads the feed.xml already on disk (if any) so entries without an explicit
    `date` keep the pubDate they were first published with, instead of getting
    re-stamped with 'now' on every rebuild — which would make a feed reader think
    all 45+ entries just went live simultaneously, every single time we publish."""
    if not OUTPUT.exists():
        return {}
    text = OUTPUT.read_text(encoding="utf-8")
    pairs = re.findall(
        r'<guid isPermaLink="false">(.*?)</guid>\s*<pubDate>(.*?)</pubDate>', text
    )
    return dict(pairs)


def main():
    entries = json.loads(ENTRIES_JSON.read_text(encoding="utf-8"))
    existing = load_existing_pubdates()
    now = format_datetime(datetime.now(timezone.utc))

    items = []
    for e in entries:
        if e.get("date"):
            pub_date = rfc822(e["date"])
        elif e["slug"] in existing:
            pub_date = existing[e["slug"]]
        else:
            pub_date = now  # genuinely new entry, first time it's ever been built

        link = f"{SITE_URL}entry/{e['slug']}/"
        summary = (e.get("closing_question") or "").strip()
        items.append(f"""    <item>
      <title>{escape(e['title'])}</title>
      <link>{escape(link)}</link>
      <guid isPermaLink="false">{escape(e['slug'])}</guid>
      <pubDate>{pub_date}</pubDate>
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


if __name__ == "__main__":
    main()
