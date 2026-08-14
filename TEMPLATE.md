---
date: YYYY-MM-DD
day: 0
title: "Entry Title"
passage: "Book Chapter:Verse"
themes: ["theme-one", "theme-two"]
closing_question: "The one line/question the entry ends on."
image: "images/day-NN-slug.jpg"
social_hook: ""
---

Paste the final published Daily Mirror text here — nothing else. No raw notes, no editorial back-and-forth. Just the finished piece, exactly as published.

`image` is required as of Day 46 onward (policy decided 2026-08-12) — every new entry gets a header image. Run `python3 scripts/add_image.py day-NN-slug path/to/source.png` to process the file and fill in this field automatically; see README's Daily Workflow. Entries before Day 46 don't have one and that's fine — it's not being backfilled.

`social_hook` is entirely OPTIONAL (policy decided 2026-08-14) — leave it blank/delete the line and publishing works exactly as before. It exists only for the rare entry where `closing_question` alone isn't the line you'd want leading a share on social media. If blank, `build_index.py` automatically falls back to `closing_question`, then to a plain excerpt of the body — this resolved value (called `hook` in `entries.json`) is what the OG image, Story image, and the Share Reflection sheet's per-platform text all use. You never have to think about this during normal publishing.
