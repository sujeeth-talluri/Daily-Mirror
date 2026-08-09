# The Daily Mirror

A permanent, public archive of Sujeeth Talluri's daily Bible reading reflections.

> The Bible reveals who God is. The Daily Mirror helps the reader discover who they are.

## Structure

```
daily-mirror/
├── entries/              ← source of truth. One markdown file per day.
├── site/                 ← the public website (GitHub Pages serves this)
│   ├── index.html
│   ├── style.css
│   ├── script.js
│   └── entries.json      ← auto-generated index, powers search/themes
├── scripts/
│   └── build_index.py    ← regenerates entries.json from entries/*.md
├── TEMPLATE.md            ← copy this for each new entry
└── README.md
```

## Daily Workflow

1. Complete Bible reading + write today's mirror (with GPT, using your Project).
2. Copy `TEMPLATE.md` → `entries/day-NN-short-slug.md` (or `YYYY-MM-DD-slug.md` once you're tracking dates consistently).
3. Fill in the frontmatter (day number, date if known, themes, closing question) and paste the final mirror text below it.
4. Run `python3 scripts/build_index.py` to regenerate `site/entries.json`
5. `git add . && git commit -m "Day N: <title>" && git push`

That's it — the live site updates automatically once pushed (GitHub Pages rebuilds on every push).

## One-time setup (do this once)

1. Create a new **public** GitHub repo, e.g. `daily-mirror`
2. Push this entire folder's contents to it
3. Go to repo **Settings → Pages** → set source to the `main` branch, folder `/site`
4. Your site will be live at `https://<your-username>.github.io/daily-mirror/`
5. (Optional) Add a custom domain later under Settings → Pages

## Before you go live — two things only you can fill in

1. **Your email**, in `site/script.js` — find `REPLY_EMAIL = 'your-email@example.com'` near the top and replace it. This powers the "Reply to me" button (no public comments, by design — see below).
2. **Your GitHub Pages URL**, in `scripts/build_feed.py` — find `SITE_URL = "https://YOUR-USERNAME.github.io/daily-mirror/"` and set it to your actual URL once you know it. Needed for the RSS feed's links to work. Re-run `python3 scripts/build_feed.py` after editing.

## What's new in this version

- **Fixed:** entries no longer repeat their closing line twice (body + styled box).
- **Prev/Next day navigation** — arrows on wide screens sit at the left/right edges; on phone they sit inline above the footer.
- **Share button** — uses your phone's native share sheet; falls back to "copy link" on desktop.
- **"Reply to me"** — opens an email draft addressed to you, referencing the entry. No public comments or likes, since real ones need a server — this keeps the site dependency-free, as discussed. You can revisit this later if it matters enough to add a backend.
- **Subtle background texture** — soft CSS-only gradient, no photo file, so no licensing risk on something meant to last decades.
- **About section** — a short expandable blurb under the header so a cold visitor knows what they're looking at. Edit the text in `site/index.html` (search for "About this series") to sound like you.
- **Favicon, share-preview image (og-image.png), RSS feed, print-friendly styling** — the last one matters for your own annual PDF backup idea; printing any entry now drops the nav/controls and just prints the reading text.



## Notes on this backfill (Days 1-22)

These entries were recovered from your Word doc, which had no dates recorded — only day numbers. The `date` field is left blank for Days 1-22; sorting falls back to day number, so ordering is still correct. If you ever find the actual dates (email drafts, WhatsApp sends, etc.), fill them in later — it won't break anything.

Day 16 originally appeared twice in the source doc with two different titles ("Your Daily Report Is Ready" and "Your InsightOS Report Is Ready"). Per your instruction, only the InsightOS version was kept.

Themes/tags on Days 1-22 were auto-suggested by scanning each entry against the core human-condition list from your Writing Philosophy doc (pride, comparison, fear, etc.) — review and adjust them since this was automated, not hand-picked the way future entries will be.

## Backup (belt and suspenders)

Since this is meant to last 10-20+ years:
- Keep a second local clone of the repo (or a synced copy in Google Drive/iCloud) — don't rely on GitHub alone.
- Once a year, consider exporting `entries/` to a single PDF as a physical/printable backup.
- Tell one trusted person (e.g. Abhishiktha) where this repo lives, in case it matters to family someday.
