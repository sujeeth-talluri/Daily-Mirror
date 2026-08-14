Fonts used by `scripts/generate_social_images.py` to render the OG/Story
images in CI (a GitHub Actions Ubuntu runner has none of the site's actual
webfonts installed, and the old approach of pointing at `C:/Windows/Fonts/`
only ever worked on a local Windows machine — see that script's history).

Same three families the live site already uses (Fraunces / Source Serif 4 /
IBM Plex Mono), fetched from Google's official `google/fonts` repository —
not a different look, just bundled so image generation doesn't depend on
network access to Google Fonts at build time, and stays deterministic.

| File | Family | License |
|---|---|---|
| `Fraunces-Variable.ttf` | Fraunces (variable) | SIL Open Font License 1.1 |
| `SourceSerif4-Variable.ttf` | Source Serif 4 (variable) | SIL Open Font License 1.1 |
| `SourceSerif4-Italic-Variable.ttf` | Source Serif 4 Italic (variable) | SIL Open Font License 1.1 |
| `IBMPlexMono-Medium.ttf` | IBM Plex Mono Medium (static) | SIL Open Font License 1.1 |
| `IBMPlexMono-SemiBold.ttf` | IBM Plex Mono SemiBold (static) | SIL Open Font License 1.1 |

Full license text: `OFL.txt` (applies to all fonts here — all published
under the same SIL OFL 1.1 by their respective foundries/authors).

The Fraunces and Source Serif 4 files are variable fonts; a specific
weight/optical-size instance is selected at render time via Pillow's
`set_variation_by_axes()` rather than needing separate static files per
weight.
