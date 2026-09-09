# Editable SmartJib social templates — Morocco-first

These SVGs are editable starter files for Figma, Adobe Illustrator, Affinity Designer, Sketch, or a browser-based SVG editor. Canva can import them as artwork; if Canva flattens an SVG, use it as a locked visual base and add fresh editable text above it.

| File | Use | Canvas |
| --- | --- | ---: |
| `feed-post-1080x1350.svg` | Single feed post or carousel slide | 1080 × 1350 |
| `story-1080x1920.svg` | Story artwork, question, poll, or link background | 1080 × 1920 |
| `reel-cover-1080x1920.svg` | Reel title card / thumbnail | 1080 × 1920 |
| `highlight-cover-1080x1920.svg` | Highlight cover | 1080 × 1920 |

## Typography setup

The kit includes the actual licensed production fonts under [`../fonts/`](../fonts/):

- `InstrumentSans-Variable.ttf` for French, English, and Latin labels
- `Cairo-Variable.ttf` for Arabic / Darija

Install those files in your design tool before editing. If that is not possible, use **Manrope** as a Latin fallback and **Noto Sans Arabic** as an Arabic fallback. Keep every Arabic visual line in one Arabic-capable font; never let a design tool silently fall back to a mismatched system font.

## How to keep future content on-brand

1. Duplicate the appropriate SVG instead of editing the original template.
2. Replace the `SMARTJIB` label and `00` pill with a sequence number or content pillar.
3. Keep the headline to one idea and 2–3 short lines.
4. In the feed template, replace the `LOGO` placeholder with `../brand/smartjib-logo-mark-transparent.png`. In the other templates, add the mark only when it supports the layout; do not crowd the headline.
5. Use Instrument Sans for French/English and Cairo for Arabic/Darija.
6. Keep Latin display leading compact (`0.91–0.96`) but give Arabic display lines more air (`1.24–1.28`).
7. Preserve the supplied margins and safe areas.
8. Use an icon directly from [Lucide](https://lucide.dev/icons/) if the layout needs one; do not redraw or mix icon families. The exact kit icon mapping lives in [`../ICON_SOURCES.md`](../ICON_SOURCES.md).
9. Export as **PNG** at the native pixel dimensions. Do not export a 1080 px design at a smaller size then upscale it.
10. Add a matching descriptive caption and alt text when posting.

## Localization rules

- Default to Morocco-relevant examples such as MAD, a monthly plan, cash, bank, and wallet.
- Lead a post in **one** language. Rotate Arabic/Darija and French through the feed instead of duplicating every sentence in three languages.
- Keep the tone friendly: useful direction, no shame, no promises about wealth.
- Ask a Morocco-based Arabic/Darija reviewer to approve new paid-ad, legal, or colloquial wording before it goes live.

See [`../BRAND_GUIDE.md`](../BRAND_GUIDE.md) for colors, icon treatment, exact safe areas, accessibility, and product-claim boundaries.
