# The Daily Mirror

A permanent, public archive of Sujeeth Talluri's daily Bible reading reflections.

> The Bible reveals who God is. The Daily Mirror helps the reader discover who they are.

## Structure

```
daily-mirror/                    ← repo root, served directly by GitHub Pages
├── entries/                     ← source of truth. One markdown file per day.
├── images/                      ← optional per-entry header images (entries/*.md `image:` field)
├── entry/                       ← auto-generated. One static, crawlable, shareable page per entry.
├── index.html, style.css, script.js   ← the interactive site (search/filter/related)
├── entries.json                 ← auto-generated index, powers search/themes
├── feed.xml, feed.xsl           ← auto-generated RSS feed
├── sitemap.xml, robots.txt      ← auto-generated, for search engines
├── scripts/
│   ├── build_index.py           ← regenerates entries.json from entries/*.md
│   ├── build_feed.py            ← regenerates feed.xml from entries.json
│   ├── build_pages.py           ← regenerates entry/*, sitemap.xml, robots.txt from entries.json
│   ├── add_image.py             ← optional, needs Pillow — processes a header image for one entry
│   ├── generate_og_images.py    ← optional, needs Pillow — see below
│   └── generate_icons.py        ← one-off, needs Pillow — see below
├── .github/workflows/build.yml  ← runs build_index/build_feed/build_pages automatically on push
├── TEMPLATE.md                  ← copy this for each new entry
└── README.md
```

## Daily Workflow

1. Complete Bible reading + write today's mirror (with GPT, using your Project).
2. Copy `TEMPLATE.md` → `entries/day-NN-short-slug.md` (or `YYYY-MM-DD-slug.md` once you're tracking dates consistently).
3. Fill in the frontmatter (day number, date if known, themes, closing question) and paste the final mirror text below it.
4. *(Optional)* If the entry has a header image: give Claude the image file directly (paste it into chat, or a local file path) rather than a cloud share link — a share link needs browser automation to resolve and download, which is the slow way. Then run `python3 scripts/add_image.py day-NN-slug path/to/source.png` — it compresses the image, saves it to `images/day-NN-slug.jpg`, and adds the `image:` field to the entry's frontmatter automatically (see `TEMPLATE.md` for the field format if doing this by hand).
5. `git add entries/day-NN-*.md images/day-NN-*.jpg && git commit -m "Day N: <title>" && git push` — **don't run `build_index.py`/`build_feed.py`/`build_pages.py` locally for a routine daily publish.** Only commit source files (the entry + its image). Letting the GitHub Action be the only thing that ever regenerates `entries.json`/`feed.xml`/`entry/*` avoids local and CI copies diverging and needing a manual rebase to reconcile — reserve running those scripts locally for when you're actually testing a change to the scripts themselves.

That's it. A GitHub Action (`.github/workflows/build.yml`) runs `build_index.py`, `build_feed.py`, and `build_pages.py` automatically on every push to `main`, and pushes a follow-up commit with the regenerated `entries.json`, `feed.xml`, `entry/*`, and `sitemap.xml` if anything changed. GitHub Pages then redeploys from that. Check the **Actions** tab on GitHub if a day's entry doesn't show up — that's where a failed build would surface.

**Optional, not automated:** `python3 scripts/generate_og_images.py` (needs `pip install Pillow` locally) regenerates `og/<slug>.png`, the unique share-preview image for each entry. It's not in the GitHub Action because it depends on Windows-specific fonts (Cambria, Consolas, Segoe UI Emoji) that don't exist on the Action's Linux runner. Run it locally when you want a custom share image for a new entry; skip it and `build_pages.py` falls back to the shared `og-image.png` automatically.

`scripts/generate_icons.py` is a separate one-off (also needs Pillow, run locally) for the home-screen install icons — only re-run it if the site's mark ever changes, not part of the daily flow.

## One-time setup (do this once)

1. Create a new **public** GitHub repo, e.g. `daily-mirror`
2. Push this entire folder's contents to it
3. Go to repo **Settings → Pages** → set source to **Deploy from a branch** → `main` branch, folder `/ (root)`
4. Your site will be live at `https://<your-username>.github.io/daily-mirror/`
5. (Optional) Add a custom domain later under Settings → Pages

## Before you go live — two things only you can fill in

1. **Your email**, in `script.js` — find `REPLY_EMAIL` near the top and replace it. This powers the "Reply to me" button (no public comments, by design — see below).
2. **Your GitHub Pages URL**, in `scripts/build_feed.py` and `scripts/build_pages.py` — both have a `SITE_URL` constant near the top; set it to your actual URL once you know it, then push (the GitHub Action will pick it up on the next build).

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
