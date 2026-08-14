The live site's actual webfonts — Fraunces, Source Serif 4, and IBM Plex
Mono, self-hosted so the site doesn't depend on `fonts.googleapis.com` at
runtime. Loaded via `@font-face` at the top of `style.css`.

Converted from the TTFs in `fonts/` (same files `generate_social_images.py`
uses — see `fonts/README.md`), not fetched separately. To regenerate after
updating a font there:

```python
from fontTools import ttLib
font = ttLib.TTFont("fonts/<name>.ttf")
font.flavor = "woff2"
font.save("webfonts/<name>.woff2")
```

(`pip install "fonttools[woff]" brotli` if `fontTools.ttLib.woff2` isn't
available.) One file per family+style — Fraunces/Source Serif 4 are
variable fonts, so a single file covers every weight `style.css` uses; IBM
Plex Mono is static, so Regular (400) and Medium (500) are separate files,
matching the only two weights the CSS actually requests.

Same SIL Open Font License 1.1 as `fonts/OFL.txt`.
