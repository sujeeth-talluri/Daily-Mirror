Fonts used by `scripts/generate_social_images.py` to render the OG/Story
images in CI (a GitHub Actions Ubuntu runner has none of the site's actual
webfonts installed, and the old approach of pointing at `C:/Windows/Fonts/`
only ever worked on a local Windows machine — see that script's history).
The same TTFs here are also the source for `webfonts/*.woff2` (converted,
not re-fetched separately), which the live site self-hosts instead of
loading from `fonts.googleapis.com` — one set of font files, two consumers.

Same three families the live site already uses (Fraunces / Source Serif 4 /
IBM Plex Mono), fetched from Google's official `google/fonts` repository —
not a different look, just bundled so image generation doesn't depend on
network access to Google Fonts at build time, and stays deterministic.

| File | Family | License |
|---|---|---|
| `Fraunces-Variable.ttf` | Fraunces (variable) | SIL Open Font License 1.1 |
| `Fraunces-Italic-Variable.ttf` | Fraunces Italic (variable) | SIL Open Font License 1.1 |
| `SourceSerif4-Variable.ttf` | Source Serif 4 (variable) | SIL Open Font License 1.1 |
| `SourceSerif4-Italic-Variable.ttf` | Source Serif 4 Italic (variable) | SIL Open Font License 1.1 |
| `IBMPlexMono-Regular.ttf` | IBM Plex Mono Regular (static) | SIL Open Font License 1.1 |
| `IBMPlexMono-Medium.ttf` | IBM Plex Mono Medium (static) | SIL Open Font License 1.1 |
| `IBMPlexMono-SemiBold.ttf` | IBM Plex Mono SemiBold (static) | SIL Open Font License 1.1 |

`Fraunces-Italic-Variable.ttf` and `IBMPlexMono-Regular.ttf` aren't used by
`generate_social_images.py` itself (it only ever needs Fraunces upright and
Plex Mono 500/600) — they're here because the live site's CSS uses Fraunces
italic (the closing-question styling) and Plex Mono 400, and `webfonts/`
needed a source file for each.

Full license text: `OFL.txt` (applies to all fonts here — all published
under the same SIL OFL 1.1 by their respective foundries/authors).

The Fraunces and Source Serif 4 files are variable fonts; a specific
weight/optical-size instance is selected at render time via Pillow's
`set_variation_by_axes()` rather than needing separate static files per
weight.
