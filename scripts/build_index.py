#!/usr/bin/env python3
"""
Regenerates site/entries.json from entries/*.md
Run this after adding or editing any entry, before committing.
No external dependencies — plain Python 3 standard library only.
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).parent.parent
ENTRIES_DIR = ROOT / "entries"
OUTPUT = ROOT / "entries.json"


def parse_frontmatter(text):
    match = re.match(r"^---\s*\n(.*?)\n---\s*\n(.*)$", text, re.DOTALL)
    if not match:
        return None, text
    fm_text, body = match.groups()
    fm = {}
    for line in fm_text.splitlines():
        line = line.strip()
        if not line or ":" not in line:
            continue
        key, _, value = line.partition(":")
        key = key.strip()
        value = value.strip()
        if value.startswith("[") and value.endswith("]"):
            items = [v.strip().strip('"').strip("'") for v in value[1:-1].split(",") if v.strip()]
            fm[key] = items
        else:
            fm[key] = value.strip('"').strip("'")
    return fm, body.strip()


def derive_excerpt(body, max_len=155):
    """Last-resort hook when an entry has neither social_hook nor
    closing_question — same simple approach build_pages.py's meta_description()
    already used for OG descriptions, so there's one fallback formula, not two."""
    text = re.sub(r"\s+", " ", body or "").strip()
    if len(text) <= max_len:
        return text
    truncated = text[:max_len].rsplit(" ", 1)[0]
    return truncated + "…"


def main():
    entries = []
    for path in sorted(ENTRIES_DIR.glob("*.md")):
        text = path.read_text(encoding="utf-8")
        fm, body = parse_frontmatter(text)
        if fm is None:
            print(f"Skipping {path.name} — no frontmatter found")
            continue

        # Resolved once, here, so every consumer (OG meta, OG image, Story
        # image, and the Share sheet's platform templates) reads the exact
        # same value instead of recomputing their own — one fallback chain,
        # not several that could quietly drift apart.
        # social_hook is OPTIONAL and never required to publish: if it's
        # missing, closing_question (already required by convention) covers
        # it; if even that's missing, a plain excerpt does.
        hook = fm.get("social_hook") or fm.get("closing_question") or derive_excerpt(body)

        entries.append({
            "date": fm.get("date", ""),
            "day": fm.get("day", ""),
            "title": fm.get("title", path.stem),
            "passage": fm.get("passage", ""),
            "themes": fm.get("themes", []),
            "closing_question": fm.get("closing_question", ""),
            "image": fm.get("image", ""),
            "hook": hook,
            "body": body,
            "slug": path.stem,
        })

    def sort_key(e):
        try:
            return int(e.get("day") or 0)
        except ValueError:
            return 0

    entries.sort(key=sort_key, reverse=True)
    OUTPUT.write_text(json.dumps(entries, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {len(entries)} entries to {OUTPUT}")


if __name__ == "__main__":
    main()
